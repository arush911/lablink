import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const QuerySchema = z.object({
  query: z.string().min(2, "Query string is too short"),
});

interface ParsedQueryResult {
  intent: string;
  targetCategory: string | null;
  targetEquipment: string[];
  suggestedDurationHours: number;
  timeWindowDescription: string;
  technicalKeywords: string[];
  recommendedEquipmentIds: string[];
  explanation: string;
  confidenceScore: number;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = QuerySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query payload", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const naturalQuery = parsed.data.query.trim();

    // Fetch existing equipment from database to match against
    const eqRes = await query(
      `SELECT id, name, model, manufacturer, asset_tag, technical_specifications
       FROM equipment
       WHERE status != 'OFFLINE'
       ORDER BY name ASC`
    );
    const availableEquipment = eqRes.rows;

    let parsedResult: ParsedQueryResult;

    // 1. Try Gemini GenAI API if key is present
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 5) {
      try {
        const prompt = `You are the LabLink AI Laboratory Scheduling Arbiter.
Analyze this university student's natural language laboratory equipment booking query:
"${naturalQuery}"

Available Laboratory Instruments:
${availableEquipment.map((e: any) => `- ID: ${e.id}, Name: ${e.name}, Model: ${e.model}`).join("\n")}

Respond ONLY with valid JSON adhering to this exact schema:
{
  "intent": "EQUIPMENT_REQUISITION" | "CALENDAR_SEARCH" | "SPECIFICATION_QUERY",
  "targetCategory": string | null,
  "targetEquipment": string[],
  "suggestedDurationHours": number (between 0.5 and 12.0),
  "timeWindowDescription": string,
  "technicalKeywords": string[],
  "recommendedEquipmentIds": string[] (IDs from the list above),
  "explanation": string,
  "confidenceScore": number (between 0.0 and 1.0)
}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            parsedResult = JSON.parse(rawText);
            return NextResponse.json({
              success: true,
              source: "GEMINI_GENAI",
              parsed: parsedResult,
            });
          }
        }
      } catch (geminiErr) {
        console.warn("[Gemini GenAI Fallback Triggered]:", geminiErr);
      }
    }

    // 2. Deterministic NLP Rule-Based / Pattern Extractor (Production Fallback)
    const lower = naturalQuery.toLowerCase();

    // A. Extract duration in hours
    let durationHours = 2.0; // default 2h
    const hourMatch = lower.match(/(\d+(\.\d+)?)\s*(hours?|hrs?|h)\b/);
    if (hourMatch) {
      const val = parseFloat(hourMatch[1]);
      if (val >= 0.5 && val <= 12.0) {
        durationHours = val;
      }
    } else if (lower.includes("half hour") || lower.includes("30 min") || lower.includes("30-min")) {
      durationHours = 0.5;
    } else if (lower.includes("all day") || lower.includes("full day")) {
      durationHours = 8.0;
    }

    // B. Match equipment by keywords
    const matchedEquipment: typeof availableEquipment = [];
    const technicalKeywords: string[] = [];

    const keywordsMap = [
      { pattern: /(oscilloscope|scope|signal|waveform|keysight|tektronix)/i, tag: "Oscilloscope" },
      { pattern: /(microscope|sem|fe-sem|imaging|beam|jeol|zeiss)/i, tag: "Electron Microscopy" },
      { pattern: /(spectrometer|nmr|bruker|resonance|spectrum)/i, tag: "Spectrometry" },
      { pattern: /(cryogenic|liquid nitrogen|ln2|cooling|77k)/i, tag: "Cryogenics" },
      { pattern: /(rf|frequency|sub-nanosecond|delay line|telemetry)/i, tag: "RF Electronics" },
      { pattern: /(vacuum|high-vacuum|chamber)/i, tag: "High-Vacuum" },
    ];

    for (const kw of keywordsMap) {
      if (kw.pattern.test(lower)) {
        technicalKeywords.push(kw.tag);
      }
    }

    for (const eq of availableEquipment) {
      const eqText = `${eq.name} ${eq.model} ${eq.manufacturer}`.toLowerCase();
      let matched = false;

      for (const kw of technicalKeywords) {
        if (eqText.includes(kw.toLowerCase())) {
          matched = true;
          break;
        }
      }

      if (matched || lower.includes(eq.name.toLowerCase()) || lower.includes(eq.model.toLowerCase())) {
        matchedEquipment.push(eq);
      }
    }

    // If no specific match, recommend first 2 instruments
    const finalRecommendations = matchedEquipment.length > 0 ? matchedEquipment : availableEquipment.slice(0, 2);

    // C. Extract time window description
    let timeWindow = "Next available operational window (08:00 – 20:00)";
    if (lower.includes("tomorrow")) timeWindow = "Tomorrow operational shift";
    else if (lower.includes("wednesday")) timeWindow = "Wednesday scheduled shift";
    else if (lower.includes("friday")) timeWindow = "Friday scheduled shift";
    else if (lower.includes("afternoon")) timeWindow = "Afternoon window (14:00 – 18:00)";
    else if (lower.includes("morning")) timeWindow = "Morning window (08:00 – 12:00)";

    parsedResult = {
      intent: "EQUIPMENT_REQUISITION",
      targetCategory: technicalKeywords[0] || "General Laboratory Core",
      targetEquipment: finalRecommendations.map((e: any) => `${e.name} (${e.model})`),
      suggestedDurationHours: durationHours,
      timeWindowDescription: timeWindow,
      technicalKeywords,
      recommendedEquipmentIds: finalRecommendations.map((e: any) => e.id),
      explanation: `Parsed query requiring ${durationHours} hours of access. Matched ${finalRecommendations.length} candidate instruments with required parameters.`,
      confidenceScore: technicalKeywords.length > 0 ? 0.94 : 0.78,
    };

    return NextResponse.json({
      success: true,
      source: "DETERMINISTIC_NLP_CORE",
      parsed: parsedResult,
    });
  } catch (err: any) {
    console.error("POST /api/v1/ai/parse-query error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to parse natural query", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
