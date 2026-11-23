"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Beaker,
  FileText,
  Clock,
  Shield,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  ArrowLeft,
} from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  assetTag: string;
  status: string;
  bufferMinutes: number;
  laboratory: {
    name: string;
    roomLocation: string;
  };
  department: {
    name: string;
    code: string;
  };
}

function RequestFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("equipmentId");

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(preselectedId || "");
  const [loadingEquipment, setLoadingEquipment] = useState(true);

  // Form Fields
  const [projectTitle, setProjectTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [grantCode, setGrantCode] = useState("");
  const [durationHours, setDurationHours] = useState<number>(3.0);
  const [projectDeadline, setProjectDeadline] = useState("");
  const [preferredStart, setPreferredStart] = useState("");
  const [preferredEnd, setPreferredEnd] = useState("");
  const [hazardousMaterials, setHazardousMaterials] = useState(false);
  const [safetyNotes, setSafetyNotes] = useState("");

  // Submission States
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [createdDocket, setCreatedDocket] = useState<any | null>(null);

  useEffect(() => {
    fetchEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEquipment = async () => {
    try {
      const res = await fetch("/api/v1/equipment?status=AVAILABLE");
      if (res.ok) {
        const data = await res.json();
        setEquipmentList(data.equipment);
        if (!selectedEquipmentId && data.equipment.length > 0) {
          setSelectedEquipmentId(data.equipment[0].id);
        }
      }
    } catch {
      // Ignored
    } finally {
      setLoadingEquipment(false);
    }
  };

  const selectedEquipment = equipmentList.find((e) => e.id === selectedEquipmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setValidationErrors({});

    try {
      const payload = {
        equipmentId: selectedEquipmentId,
        projectTitle,
        abstract,
        requestedDurationHours: Number(durationHours),
        projectDeadline: projectDeadline || null,
        preferredWindowStart: preferredStart ? new Date(preferredStart).toISOString() : null,
        preferredWindowEnd: preferredEnd ? new Date(preferredEnd).toISOString() : null,
        courseCode: courseCode || null,
        grantCode: grantCode || null,
        hazardousMaterialsDeclared: hazardousMaterials,
        safetyNotes: safetyNotes || null,
      };

      const cookieMatch = typeof document !== "undefined" ? document.cookie.match(/lablink_token=([^;]+)/) : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieMatch) {
        headers["Authorization"] = `Bearer ${cookieMatch[1]}`;
      }

      const res = await fetch("/api/v1/requests", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.issues) {
          const errorsMap: Record<string, string> = {};
          data.issues.forEach((iss: any) => {
            errorsMap[iss.field] = iss.message;
          });
          setValidationErrors(errorsMap);
          throw new Error("Please correct the validation errors in the form.");
        }
        throw new Error(data.message || "Failed to submit project request docket.");
      }

      setCreatedDocket(data.request);
      // Clear form inputs
      setProjectTitle("");
      setAbstract("");
      setCourseCode("");
      setGrantCode("");
      setSafetyNotes("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#0f172a] font-sans pb-12">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#e2e8f0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/equipment")}
              className="p-1.5 text-[#64748b] hover:text-[#0f172a] rounded hover:bg-slate-100 transition-colors flex items-center gap-1 text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Catalog</span>
            </button>
            <span className="text-[#cbd5e1]">|</span>
            <div className="flex items-center gap-2 text-blue-700 font-bold text-sm tracking-tight">
              <Beaker className="w-4 h-4 text-blue-600" />
              <span>LabLink Access Request Docket</span>
            </div>
          </div>

          <div className="text-xs font-mono text-[#64748b]">
            Applicant: <span className="font-semibold text-[#0f172a]">Alex Chen (Student)</span>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        {createdDocket ? (
          /* Success Screen */
          <div className="bg-white p-8 rounded-lg border border-[#e2e8f0] shadow-xs text-center space-y-4 max-w-xl mx-auto mt-8 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-[#0f172a]">
              Request Docket Submitted Successfully
            </h2>
            <p className="text-xs text-[#64748b]">
              Your project-based access request has been filed in the laboratory queue and assigned a permanent docket reference.
            </p>

            <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded text-left font-mono text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#64748b]">Docket Reference:</span>
                <span className="font-bold text-blue-700">{createdDocket.docketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Instrument:</span>
                <span className="font-semibold text-[#0f172a]">{createdDocket.equipment.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Requested Duration:</span>
                <span className="font-semibold text-[#0f172a]">{createdDocket.requestedDurationHours} Hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Status:</span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                  {createdDocket.status}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/requests")}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <span>Track Request Docket</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatedDocket(null);
                  setProjectTitle("");
                  setAbstract("");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#475569] rounded text-xs font-semibold transition-colors"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        ) : (
          /* Request Input Form (Stitch Screen 05) */
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-b border-[#e2e8f0] pb-4">
              <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">
                Project-Based Equipment Access Request
              </h1>
              <p className="text-xs text-[#64748b] mt-0.5">
                Submit an academic project docket for faculty review, safety qualification evaluation, and intelligent slot scheduling.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Target Instrumentation */}
            <div className="bg-white p-5 rounded-lg border border-[#e2e8f0] shadow-xs space-y-4">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#0037b0] uppercase tracking-wider">
                <Beaker className="w-4 h-4 text-blue-600" />
                <span>1. Target Instrumentation & Configuration</span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-[#475569] mb-1">
                  Select Requested Hardware
                </label>
                {loadingEquipment ? (
                  <div className="h-10 bg-slate-100 rounded animate-pulse"></div>
                ) : (
                  <select
                    value={selectedEquipmentId}
                    onChange={(e) => setSelectedEquipmentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans"
                  >
                    {equipmentList.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        [{eq.assetTag}] {eq.name} — {eq.laboratory.name}
                      </option>
                    ))}
                  </select>
                )}
                {validationErrors.equipmentId && (
                  <p className="text-red-600 text-[11px] mt-1">{validationErrors.equipmentId}</p>
                )}
              </div>

              {selectedEquipment && (
                <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[#0f172a]">{selectedEquipment.name}</div>
                    <div className="text-[#64748b] text-[11px]">
                      {selectedEquipment.laboratory.name} • {selectedEquipment.laboratory.roomLocation}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                      {selectedEquipment.status}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-[#475569] text-[10px] font-mono">
                      {selectedEquipment.bufferMinutes}m Turnaround
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Academic Project & Methodology */}
            <div className="bg-white p-5 rounded-lg border border-[#e2e8f0] shadow-xs space-y-4">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#0037b0] uppercase tracking-wider">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>2. Academic Project & Faculty Sponsorship</span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-[#475569] mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="e.g. In-Situ Tensile Strain Mapping of Additive Ti-6Al-4V"
                  className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans"
                  required
                />
                {validationErrors.projectTitle && (
                  <p className="text-red-600 text-[11px] mt-1">{validationErrors.projectTitle}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-[#475569] mb-1">
                  Research Abstract & Analytical Methodology *
                </label>
                <textarea
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  rows={4}
                  placeholder="Describe your experimental goals, sample preparation, expected instrument parameters, and justification for requested duration..."
                  className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans"
                  required
                />
                {validationErrors.abstract && (
                  <p className="text-red-600 text-[11px] mt-1">{validationErrors.abstract}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-[#475569] mb-1">
                    Course Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. MSE-402, ENG-790"
                    className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-[#475569] mb-1">
                    Grant / Account Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={grantCode}
                    onChange={(e) => setGrantCode(e.target.value)}
                    placeholder="e.g. NSF-DMR-2026-04"
                    className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Scheduling & Duration Parameters */}
            <div className="bg-white p-5 rounded-lg border border-[#e2e8f0] shadow-xs space-y-4">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#0037b0] uppercase tracking-wider">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>3. Scheduling & Duration Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold uppercase font-mono text-[#475569]">
                      Requested Duration:
                    </label>
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {durationHours} Hours ({durationHours * 60} mins)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="12.0"
                    step="0.5"
                    value={durationHours}
                    onChange={(e) => setDurationHours(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#94a3b8] font-mono mt-0.5">
                    <span>30m</span>
                    <span>3h (Standard)</span>
                    <span>6h</span>
                    <span>12h (Max)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-[#475569] mb-1">
                    Project Milestone Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={projectDeadline}
                    onChange={(e) => setProjectDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans"
                  />
                  <p className="text-[10px] text-[#64748b] mt-0.5">
                    Used by the scheduling engine to prioritize urgent milestone deadlines.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#f1f5f9]">
                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-[#475569] mb-1">
                    Preferred Window Start (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={preferredStart}
                    onChange={(e) => setPreferredStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-[#475569] mb-1">
                    Preferred Window End (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={preferredEnd}
                    onChange={(e) => setPreferredEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Safety & Compliance */}
            <div className="bg-white p-5 rounded-lg border border-[#e2e8f0] shadow-xs space-y-4">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#0037b0] uppercase tracking-wider">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>4. Safety & Compliance Declarations</span>
              </div>

              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="hazardous"
                  checked={hazardousMaterials}
                  onChange={(e) => setHazardousMaterials(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 border-[#cbd5e1] focus:ring-blue-600"
                />
                <label htmlFor="hazardous" className="text-xs text-[#0f172a] cursor-pointer">
                  <span className="font-semibold">Hazardous Materials Declaration:</span> Check if your experiments involve volatile solvents, bio-agents, laser Class 3B/4, or nanomaterials.
                </label>
              </div>

              {hazardousMaterials && (
                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-[#475569] mb-1">
                    Safety Mitigation Notes
                  </label>
                  <textarea
                    value={safetyNotes}
                    onChange={(e) => setSafetyNotes(e.target.value)}
                    rows={2}
                    placeholder="List specific SDS precautions, PPE requirements, or waste disposal protocols..."
                    className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 font-sans"
                  />
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => router.push("/equipment")}
                className="px-4 py-2 text-xs font-semibold text-[#64748b] hover:bg-slate-100 rounded transition-colors"
              >
                Cancel & Return
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Filing Request Docket...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Request Docket</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-mono">Loading request workspace...</div>}>
      <RequestFormContent />
    </Suspense>
  );
}
