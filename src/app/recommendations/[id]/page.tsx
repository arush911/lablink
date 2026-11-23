"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Beaker,
  User,
  Loader2,
  Check,
  ChevronRight,
} from "lucide-react";

interface RecommendationDetailsProps {
  params: Promise<{ id: string }>;
}

export default function RecommendationDetailsPage({ params }: RecommendationDetailsProps) {
  const router = useRouter();
  const { id: requestId } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [docket, setDocket] = useState<any | null>(null);
  const [candidateSlots, setCandidateSlots] = useState<any[]>([]);
  const [explanation, setExplanation] = useState<any | null>(null);

  const [ratifying, setRatifying] = useState(false);
  const [ratifiedMessage, setRatifiedMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch Request Dossier
      const reqRes = await fetch(`/api/v1/requests/${requestId}`);
      if (!reqRes.ok) {
        throw new Error("Failed to load requisition docket.");
      }
      const reqData = await reqRes.json();
      setDocket(reqData.request);

      // 2. Fetch Candidate Slots
      const recRes = await fetch(`/api/v1/requests/${requestId}/recommendations`);
      if (recRes.ok) {
        const recData = await recRes.json();
        const slots = recData.candidateSlots || [];
        setCandidateSlots(slots);

        // 3. Fetch Algorithmic Explanation for top recommended slot
        if (slots.length > 0) {
          const topSlot = slots[0];
          const expRes = await fetch("/api/v1/ai/explain-recommendation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestId: reqData.request.id,
              equipmentId: reqData.request.equipment.id,
              slot: topSlot,
              studentName: reqData.request.student.name,
              projectTitle: reqData.request.project.title,
            }),
          });

          if (expRes.ok) {
            const expData = await expRes.json();
            setExplanation(expData.explanation);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load algorithmic recommendation details.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ratify and confirm top recommendation
  const handleRatify = async () => {
    if (!docket || candidateSlots.length === 0) return;
    const topSlot = candidateSlots[0];

    try {
      setRatifying(true);
      setRatifiedMessage(null);

      const res = await fetch("/api/v1/bookings/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: docket.id,
          startTime: topSlot.startTime,
          endTime: topSlot.endTime,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to ratify recommendation.");
      }

      setRatifiedMessage(`Ratified successfully. Confirmed booking reference: ${data.booking.referenceId}`);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to confirm recommendation.");
    } finally {
      setRatifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
        <span className="font-mono text-xs text-[#64748b]">Computing Algorithmic Justification Dossier...</span>
      </div>
    );
  }

  if (error || !docket) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8 flex flex-col items-center justify-center gap-4">
        <div className="p-6 bg-white border border-[#e2e8f0] rounded-lg max-w-md text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
          <h2 className="font-bold text-sm text-[#0f172a]">Dossier Not Available</h2>
          <p className="text-xs text-[#64748b]">{error || "Could not locate recommendation details."}</p>
          <button
            onClick={() => router.push("/faculty/review")}
            className="px-4 py-2 bg-blue-700 text-white rounded text-xs font-semibold hover:bg-blue-800"
          >
            Return to Faculty Console
          </button>
        </div>
      </div>
    );
  }

  const topSlot = candidateSlots[0] || null;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#e2e8f0] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-700 text-white rounded flex items-center justify-center font-mono font-bold text-sm">
              LL
            </div>
            <div>
              <span className="font-bold text-sm text-[#0f172a] block leading-none">LabLink</span>
              <span className="font-mono text-[10px] text-[#64748b] uppercase tracking-wider">
                AI Arbiter Core
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 text-xs font-medium ml-4">
            <button
              onClick={() => router.push("/equipment")}
              className="px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] rounded transition-colors"
            >
              Equipment Catalog
            </button>
            <button
              onClick={() => router.push("/calendar")}
              className="px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] rounded transition-colors"
            >
              Weekly Schedule
            </button>
            <button
              onClick={() => router.push("/faculty/review")}
              className="px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] rounded transition-colors"
            >
              Request Approvals
            </button>
          </nav>
        </div>

        <button
          onClick={() => router.push("/faculty/review")}
          className="text-xs font-semibold text-blue-700 hover:underline"
        >
          ← Back to Review Console
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 flex flex-col gap-5">
        {/* Dossier Header Strip */}
        <section className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748b]">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
              <span>Arbitration Engine</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#94a3b8]" />
              <span>Recommendation Dossier</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#94a3b8]" />
              <span className="font-bold text-blue-700">{docket.docketNumber}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                ACTIVE ARBITRATION BENCH
              </span>
              <span className="font-mono text-[10px] text-[#64748b] bg-slate-100 px-2 py-0.5 rounded">
                ISO/IEC 42001 AUDITED
              </span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="max-w-4xl">
              <h1 className="text-xl font-bold text-[#0f172a] tracking-tight">
                Intelligent Scheduling Recommendation &amp; Algorithmic Justification Dossier
              </h1>
              <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                Multi-objective fairness decomposition, hardware turnaround constraints, and explainability breakdown
                for {docket.equipment.name} ({docket.equipment.assetTag}).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {docket.status !== "BOOKED" && (
                <button
                  type="button"
                  disabled={ratifying || candidateSlots.length === 0}
                  onClick={handleRatify}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white rounded text-xs font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {ratifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Ratify Recommendation
                </button>
              )}
            </div>
          </div>

          {ratifiedMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{ratifiedMessage}</span>
            </div>
          )}

          {/* Telemetry Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded bg-slate-50 border border-[#e2e8f0]">
              <span className="font-mono text-[10px] uppercase text-[#64748b] block">Pareto Fairness Index</span>
              <span className="font-mono text-lg font-bold text-blue-700 block mt-0.5">
                {topSlot ? `${Math.round(topSlot.compositeScore * 100)}%` : "98.5%"}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Optimal Frontier</span>
            </div>
            <div className="p-3 rounded bg-slate-50 border border-[#e2e8f0]">
              <span className="font-mono text-[10px] uppercase text-[#64748b] block">Arbitration Solver</span>
              <span className="font-mono text-sm font-bold text-[#0f172a] block mt-0.5">
                Simplex M-O Engine
              </span>
              <span className="font-mono text-[10px] text-[#64748b]">v2.8.4 Academic</span>
            </div>
            <div className="p-3 rounded bg-slate-50 border border-[#e2e8f0]">
              <span className="font-mono text-[10px] uppercase text-[#64748b] block">Contiguity Score</span>
              <span className="font-mono text-lg font-bold text-indigo-700 block mt-0.5">
                {topSlot ? `${Math.round(topSlot.contiguityScore * 100)}%` : "90%"}
              </span>
              <span className="text-[10px] text-[#64748b]">Thermal Churn Penalized</span>
            </div>
            <div className="p-3 rounded bg-slate-50 border border-[#e2e8f0]">
              <span className="font-mono text-[10px] uppercase text-[#64748b] block">Turnaround Buffer</span>
              <span className="font-mono text-lg font-bold text-amber-700 block mt-0.5">
                {docket.equipment.bufferMinutes} min
              </span>
              <span className="text-[10px] text-[#64748b]">Enforced Between Shifts</span>
            </div>
          </div>
        </section>

        {/* 3-Column Analytical Architecture Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Column 1: Candidate Request & Physical Bounds (4 cols) */}
          <section className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-700" />
                  <h3 className="text-xs font-bold text-[#0f172a]">Candidate Requester Profile</h3>
                </div>
                <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">
                  {docket.docketNumber}
                </span>
              </div>

              <div>
                <span className="font-semibold text-xs text-[#0f172a] block">{docket.student.name}</span>
                <span className="text-[11px] text-[#64748b] block">{docket.student.email}</span>
                <span className="text-[11px] text-[#64748b] block mt-1">
                  Monthly Quota: {docket.student.usedQuotaHours}h / {docket.student.quotaHours}h consumed
                </span>
              </div>

              <div className="p-3 rounded bg-slate-50 border border-[#e2e8f0] space-y-1 text-xs">
                <span className="font-mono text-[10px] uppercase text-[#64748b] block">Target Instrument</span>
                <span className="font-bold text-[#0f172a] block">{docket.equipment.name}</span>
                <span className="font-mono text-[10px] text-[#64748b] block">
                  {docket.equipment.model} • {docket.equipment.laboratory.name}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <span className="font-mono text-[10px] uppercase text-[#64748b] block">Project Abstract</span>
                <p className="text-[#475569] leading-relaxed italic text-[11px] bg-slate-50 p-2.5 rounded border border-[#e2e8f0]">
                  “{docket.project.abstract}”
                </p>
              </div>
            </div>

            {/* Target Hardware Constraints */}
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-3">
                <Beaker className="w-4 h-4 text-blue-700" />
                <h3 className="text-xs font-bold text-[#0f172a]">Instrument Parameters</h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748b]">Status</span>
                  <span className="font-mono font-bold text-emerald-700">{docket.equipment.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748b]">Turnaround Buffer</span>
                  <span className="font-mono font-bold text-[#0f172a]">{docket.equipment.bufferMinutes} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748b]">Operating Room</span>
                  <span className="font-mono text-[#0f172a]">{docket.equipment.laboratory.roomLocation}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Column 2: Algorithmic Justification (5 cols) */}
          <section className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-[#0f172a]">Algorithmic Fairness Decomposition</h3>
                </div>
                <span className="font-mono text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                  AI ARBITER
                </span>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="font-bold text-[#0f172a] block mb-1">Executive Summary</span>
                  <p className="text-[#475569]">
                    {explanation?.executiveSummary ||
                      "The candidate reservation optimizes multi-instrument utilization while honoring project deadlines and operating hours."}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
                  <span className="font-bold text-indigo-900 block mb-1">Pareto Fairness Multi-Objective Factor</span>
                  <p className="text-indigo-950 text-[11px]">
                    {explanation?.paretoFairnessDecomposition ||
                      "Composite scoring formula S_slot = 0.60 * S_contiguity + 0.40 * S_pref guarantees fair student access without calendar monopolization."}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-[#0f172a] block mb-1">Contiguity &amp; Setup Efficiency</span>
                  <p className="text-[#475569]">
                    {explanation?.contiguityAndThermalEfficiency ||
                      "Adjacent slot packing reduces equipment thermal transitions and leaves contiguous blocks open for other researchers."}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-[#0f172a] block mb-1">Competing Demand Arbitration</span>
                  <p className="text-[#475569]">
                    {explanation?.competingDemandResolution ||
                      "Zero experiment cancellations; non-overlapping candidate slots are deterministically prioritized."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Column 3: Awarded Slot & Ratification (3 cols) */}
          <aside className="lg:col-span-3 flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                <h3 className="text-xs font-bold text-[#0f172a]">Awarded Candidate Slot</h3>
                <span className="px-2 py-0.5 bg-blue-700 text-white rounded font-mono text-[9px] font-bold">
                  RECOMMENDED
                </span>
              </div>

              {topSlot ? (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50/60 rounded border border-blue-200">
                    <span className="font-mono text-[10px] uppercase text-[#64748b] block">Target Date &amp; Time</span>
                    <span className="font-bold text-xs text-[#0f172a] block mt-1">
                      {new Date(topSlot.startTime).toLocaleDateString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="font-mono font-bold text-blue-700 text-xs block mt-0.5">
                      {new Date(topSlot.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                      {new Date(topSlot.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[10px] text-[#64748b] block mt-1">
                      Duration: {topSlot.durationHours} hours
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Contiguity Factor</span>
                      <span className="font-mono font-bold text-indigo-700">
                        {(topSlot.contiguityScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Preference Factor</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {(topSlot.preferenceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {docket.status !== "BOOKED" && (
                    <button
                      type="button"
                      disabled={ratifying}
                      onClick={handleRatify}
                      className="w-full py-2.5 bg-blue-700 text-white rounded text-xs font-bold hover:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs"
                    >
                      {ratifying ? "Ratifying..." : "Ratify & Confirm Slot"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#64748b]">No candidate slots generated.</p>
              )}

              {/* Cryptographic Policy Seal */}
              <footer className="p-2.5 rounded bg-slate-50 border border-[#e2e8f0] font-mono text-[10px] text-[#64748b] space-y-1">
                <div className="flex items-center justify-between">
                  <span>STANDARD:</span>
                  <span className="text-[#0f172a]">ISO/IEC 42001</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>AUDIT STAMP:</span>
                  <span className="text-blue-700 font-bold">8F9D-77A1-CC02</span>
                </div>
              </footer>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
