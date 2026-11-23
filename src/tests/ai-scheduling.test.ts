import { describe, it, expect } from "vitest";
import { POST as parseQuery } from "../app/api/v1/ai/parse-query/route";
import { POST as explainRecommendation } from "../app/api/v1/ai/explain-recommendation/route";

describe("Stage 7: GenAI Query Parsing & Algorithmic Explainability", () => {
  const TEST_EQUIPMENT_ID = "44444444-4444-4444-4444-444444440001"; // Keysight Oscilloscope

  it("AC-AI-01: POST /api/v1/ai/parse-query extracts structured parameters from natural language", async () => {
    const req = new Request("http://localhost:3000/api/v1/ai/parse-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Need 3.5 hours on an RF oscilloscope for high frequency signal sampling next Wednesday afternoon",
      }),
    });

    const res = await parseQuery(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.parsed).toBeDefined();
    expect(data.parsed.suggestedDurationHours).toBe(3.5);
    expect(data.parsed.targetEquipment.length).toBeGreaterThan(0);
    expect(data.parsed.technicalKeywords).toContain("Oscilloscope");
    expect(data.parsed.timeWindowDescription).toContain("Wednesday");
    expect(data.parsed.confidenceScore).toBeGreaterThanOrEqual(0.7);
  });

  it("AC-AI-02: POST /api/v1/ai/parse-query rejects empty query with HTTP 400", async () => {
    const req = new Request("http://localhost:3000/api/v1/ai/parse-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "" }),
    });

    const res = await parseQuery(req);
    expect(res.status).toBe(400);
  });

  it("AC-AI-03: POST /api/v1/ai/explain-recommendation generates ISO 42001 justification", async () => {
    const req = new Request("http://localhost:3000/api/v1/ai/explain-recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipmentId: TEST_EQUIPMENT_ID,
        studentName: "Alex Chen",
        projectTitle: "Cryogenic Superconducting Resonance",
        slot: {
          startTime: "2026-12-10T14:00:00Z",
          endTime: "2026-12-10T18:00:00Z",
          contiguityScore: 0.95,
          preferenceScore: 1.0,
        },
      }),
    });

    const res = await explainRecommendation(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.explanation).toBeDefined();
    expect(data.explanation.executiveSummary).toContain("Alex Chen");
    expect(data.explanation.paretoFairnessDecomposition).toBeDefined();
    expect(data.explanation.contiguityAndThermalEfficiency).toBeDefined();
    expect(data.explanation.iso42001Compliance.standard).toBe("ISO/IEC 42001 Audited Policy");
    expect(data.explanation.iso42001Compliance.auditStamp).toContain("ARBITER");
  });
});
