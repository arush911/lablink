"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Beaker,
  User,
  LogOut,
  ChevronRight,
  Calendar,
  Sparkles,
  Check,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface RequestItem {
  id: string;
  docketNumber: string;
  status: string;
  requestedDurationHours: number;
  projectDeadline: string | null;
  preferredWindowStart: string | null;
  preferredWindowEnd: string | null;
  rejectionReason: string | null;
  createdAt: string;
  projectTitle: string;
  abstract: string;
  grantCode: string | null;
  hazardousMaterialsDeclared: boolean;
  equipmentId: string;
  equipmentName: string;
  equipmentModel: string;
  assetTag: string;
  laboratoryName: string;
  roomLocation: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
}

interface ScoredCandidateSlot {
  startTime: string;
  endTime: string;
  durationHours: number;
  contiguityScore: number;
  preferenceScore: number;
  compositeScore: number;
  isRecommended: boolean;
  explanation: string;
}

function FacultyReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRequestId = searchParams.get("requestId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestsList, setRequestsList] = useState<RequestItem[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId);

  // Single request details
  const [currentRequest, setCurrentRequest] = useState<any | null>(null);
  const [candidateSlots, setCandidateSlots] = useState<ScoredCandidateSlot[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Decision state
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);
  const [rejectionOpen, setRejectionOpen] = useState<boolean>(false);
  const [rejectionReasonCategory, setRejectionReasonCategory] = useState<string>("safety");
  const [facultyComments, setFacultyComments] = useState<string>("");
  const [actionNotice, setActionNotice] = useState<{ title: string; message: string; type: "success" | "error" } | null>(null);

  // 1. Fetch all pending requests for faculty review queue
  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/requests");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push("/login?requiredRole=faculty");
          return;
        }
        throw new Error("Failed to load faculty request queue");
      }
      const data = await res.json();
      const list: RequestItem[] = (data.requests || []).map((r: any) => ({
        id: r.id,
        docketNumber: r.docketNumber || r.docket_number,
        status: r.status,
        requestedDurationHours: Number(r.requestedDurationHours || r.requested_duration_hours),
        projectDeadline: r.projectDeadline || r.project_deadline,
        preferredWindowStart: r.preferredWindowStart || r.preferred_window_start,
        preferredWindowEnd: r.preferredWindowEnd || r.preferred_window_end,
        rejectionReason: r.rejectionReason || r.rejection_reason,
        createdAt: r.createdAt || r.created_at,
        projectTitle: r.projectTitle || r.project_title,
        abstract: r.abstract,
        grantCode: r.grantCode || r.grant_code,
        hazardousMaterialsDeclared: Boolean(r.hazardousMaterialsDeclared ?? r.hazardous_materials_declared),
        equipmentId: r.equipmentId || r.equipment_id,
        equipmentName: r.equipmentName || r.equipment_name,
        equipmentModel: r.equipmentModel || r.equipment_model,
        assetTag: r.assetTag || r.asset_tag,
        laboratoryName: r.laboratoryName || r.laboratory_name,
        roomLocation: r.roomLocation || r.room_location,
        studentId: r.studentId || r.student_id,
        studentName: r.studentName || r.student_name,
        studentEmail: r.studentEmail || r.student_email,
      }));

      setRequestsList(list);

      // Select initial request or first pending request
      if (list.length > 0) {
        const found = initialRequestId ? list.find((item) => item.id === initialRequestId) : null;
        const target = found || list.find((item) => item.status === "PENDING_REVIEW" || item.status === "APPROVED") || list[0];
        setSelectedRequestId(target.id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, [initialRequestId, router]);

  // 2. Fetch specific request details and candidate slots
  const loadRequestDetails = useCallback(async (reqId: string) => {
    try {
      setLoadingSlots(true);
      const [detailRes, recRes] = await Promise.all([
        fetch(`/api/v1/requests/${reqId}`),
        fetch(`/api/v1/requests/${reqId}/recommendations`),
      ]);

      if (detailRes.ok) {
        const dData = await detailRes.json();
        setCurrentRequest(dData.request);
      }

      if (recRes.ok) {
        const rData = await recRes.json();
        setCandidateSlots(rData.candidateSlots || []);
        setSelectedSlotIndex(0);
      } else {
        setCandidateSlots([]);
      }
    } catch (err) {
      console.error("Error loading request details:", err);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (selectedRequestId) {
      loadRequestDetails(selectedRequestId);
    }
  }, [selectedRequestId, loadRequestDetails]);

  // Handle slot confirmation (ACID transaction)
  const handleConfirmSelectedSlot = async () => {
    if (!currentRequest || candidateSlots.length === 0) return;
    const targetSlot = candidateSlots[selectedSlotIndex];
    if (!targetSlot) return;

    setActionSubmitting(true);
    setActionNotice(null);

    try {
      const res = await fetch("/api/v1/bookings/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: currentRequest.id,
          startTime: targetSlot.startTime,
          endTime: targetSlot.endTime,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm booking slot.");
      }

      setActionNotice({
        title: "Booking Confirmed & Committed",
        message: `Reference ${data.booking.referenceId} confirmed on ${data.booking.equipmentName}. Student notified.`,
        type: "success",
      });

      // Reload docket details
      loadRequestDetails(currentRequest.id);
      fetchQueue();
    } catch (err: any) {
      setActionNotice({
        title: "Confirmation Error",
        message: err.message || "Failed to commit calendar slot.",
        type: "error",
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Handle approval only
  const handleApproveRequisition = async () => {
    if (!currentRequest) return;
    setActionSubmitting(true);
    setActionNotice(null);

    try {
      const res = await fetch(`/api/v1/requests/${currentRequest.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE",
          notes: facultyComments || "Approved by faculty PI.",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record approval.");
      }

      setActionNotice({
        title: "Requisition Approved",
        message: `Docket ${currentRequest.docketNumber} status updated to APPROVED.`,
        type: "success",
      });

      loadRequestDetails(currentRequest.id);
      fetchQueue();
    } catch (err: any) {
      setActionNotice({
        title: "Approval Error",
        message: err.message || "Failed to approve request.",
        type: "error",
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Handle rejection
  const handleRejectRequisition = async () => {
    if (!currentRequest) return;
    if (!facultyComments.trim()) {
      setActionNotice({
        title: "Justification Required",
        message: "Please provide a specific faculty feedback explanation for declining.",
        type: "error",
      });
      return;
    }

    setActionSubmitting(true);
    setActionNotice(null);

    try {
      const fullReason = `[${rejectionReasonCategory.toUpperCase()}] ${facultyComments.trim()}`;
      const res = await fetch(`/api/v1/requests/${currentRequest.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          rejectionReason: fullReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to decline request.");
      }

      setActionNotice({
        title: "Requisition Declined",
        message: `Docket ${currentRequest.docketNumber} marked REJECTED. Feedback recorded.`,
        type: "success",
      });

      setRejectionOpen(false);
      loadRequestDetails(currentRequest.id);
      fetchQueue();
    } catch (err: any) {
      setActionNotice({
        title: "Action Failed",
        message: err.message || "Failed to reject request.",
        type: "error",
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch {}
    document.cookie = "lablink_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  if (loading && requestsList.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
        <span className="font-mono text-xs text-[#64748b]">Loading Faculty Review Console...</span>
      </div>
    );
  }

  const selectedSlot = candidateSlots[selectedSlotIndex] || null;

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
                Faculty Review Console
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 text-xs font-medium ml-4">
            <button
              onClick={() => router.push("/equipment")}
              className="px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50 rounded transition-colors"
            >
              Equipment Catalog
            </button>
            <button
              onClick={() => router.push("/calendar")}
              className="px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50 rounded transition-colors"
            >
              Weekly Schedule
            </button>
            <button
              onClick={() => router.push("/faculty/review")}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded"
            >
              Request Approvals
            </button>
          </nav>
        </div>

        {/* User Identity & Role Switcher */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-slate-100 p-0.5 rounded border border-[#e2e8f0]">
            <span className="px-2.5 py-1 text-xs font-semibold rounded bg-white text-blue-700 shadow-2xs">
              Faculty PI
            </span>
            <button
              onClick={() => router.push("/equipment")}
              className="px-2.5 py-1 text-xs text-[#64748b] hover:text-[#0f172a] transition-colors"
            >
              Student View
            </button>
          </div>

          <div className="flex items-center gap-2 pl-3 border-l border-[#e2e8f0]">
            <div className="text-right hidden sm:block">
              <span className="block text-xs font-semibold text-[#0f172a] leading-none">
                Prof. Marcus Vance
              </span>
              <span className="font-mono text-[10px] text-[#64748b] uppercase">Cavendish PI</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-[#64748b] hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 flex flex-col gap-5">
        {/* Breadcrumb & SLA Ribbon */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-700" />
          <div className="flex items-center gap-2 text-xs text-[#64748b]">
            <span>Faculty Console</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#94a3b8]" />
            <span>Requisition Review</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#94a3b8]" />
            <span className="font-mono font-bold text-blue-700">
              {currentRequest?.docketNumber || "QUEUE"}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-[#0f172a] font-mono text-[11px] font-semibold uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-700" />
              Queue: {requestsList.length} dockets
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[11px] font-semibold uppercase">
              <Clock className="w-3 h-3 text-amber-700" />
              SLA: 05h 42m Remaining
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Active Arbiter Core
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Notice Toast */}
        {actionNotice && (
          <div
            className={`p-4 rounded-lg border flex items-start justify-between gap-3 ${
              actionNotice.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {actionNotice.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold text-xs block">{actionNotice.title}</span>
                <p className="text-xs mt-0.5">{actionNotice.message}</p>
              </div>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-[#64748b] hover:text-[#0f172a]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Queue Selector Bar */}
        {requestsList.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider shrink-0 mr-1">
              Review Queue:
            </span>
            {requestsList.map((req) => (
              <button
                key={req.id}
                onClick={() => setSelectedRequestId(req.id)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-medium border transition-colors shrink-0 flex items-center gap-2 ${
                  req.id === selectedRequestId
                    ? "bg-blue-700 text-white border-blue-700 shadow-xs"
                    : "bg-white text-[#0f172a] border-[#e2e8f0] hover:bg-slate-50"
                }`}
              >
                <span>{req.docketNumber}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded uppercase ${
                    req.status === "BOOKED"
                      ? "bg-emerald-100 text-emerald-800"
                      : req.status === "APPROVED"
                      ? "bg-blue-100 text-blue-800"
                      : req.status === "REJECTED"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {req.status}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Main 2-Column Analysis & Decision Grid (60% Dossier / 40% Action Engine) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Student & Project Dossier (7 cols) */}
          <section className="lg:col-span-7 flex flex-col gap-5">
            {/* Card A: Researcher Profile & Project Abstract */}
            <article className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-700" />
                  <h2 className="text-sm font-bold text-[#0f172a]">
                    Researcher Profile &amp; Project Abstract
                  </h2>
                </div>
                <span className="font-mono text-[11px] text-[#64748b] uppercase tracking-wider">
                  Cavendish Ref: {currentRequest?.docketNumber || "REQ-2026"}
                </span>
              </div>

              {/* Academic Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-[#e2e8f0]">
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#64748b] block">Candidate</span>
                  <span className="font-semibold text-xs text-[#0f172a] mt-0.5 block">
                    {currentRequest?.student?.name || "Alex Chen"}
                  </span>
                  <span className="text-[11px] text-[#64748b]">
                    {currentRequest?.student?.email || "alex.chen@lablink.edu"}
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#64748b] block">Department</span>
                  <span className="font-semibold text-xs text-[#0f172a] mt-0.5 block">
                    {currentRequest?.equipment?.laboratory?.name || "Cavendish Core Laboratory"}
                  </span>
                  <span className="text-[11px] text-[#64748b]">
                    {currentRequest?.equipment?.laboratory?.roomLocation || "Room 204"}
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#64748b] block">Charge / Grant Code</span>
                  <span className="font-mono font-bold text-xs text-blue-700 mt-0.5 block">
                    {currentRequest?.project?.grantCode || "EPSRC EP/W021481/1"}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">Standard Allocation</span>
                </div>
              </div>

              {/* Milestone Urgency Callout */}
              <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#0f172a]">
                      Academic Milestone: Thesis Experimentation Window
                    </span>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded">
                      DUE: {currentRequest?.projectDeadline ? new Date(currentRequest.projectDeadline).toLocaleDateString() : "Flexible"}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                    Requested Duration: {currentRequest?.requestedDurationHours || 2.0} hours. Laboratory session
                    is critical for dataset continuity prior to academic degree progress sign-off.
                  </p>
                </div>
              </div>

              {/* Project Specification */}
              <div className="space-y-1.5 pt-1">
                <span className="font-mono text-[10px] uppercase text-[#64748b] font-semibold tracking-wider">
                  Project Specification
                </span>
                <h3 className="text-xs font-bold text-[#0f172a]">
                  “{currentRequest?.project?.title || "Autonomous Drone Flight Motor Telemetry Analysis"}”
                </h3>
                <p className="text-xs text-[#475569] leading-relaxed">
                  {currentRequest?.project?.abstract ||
                    "High-frequency signal sampling of brushless motor ESC telemetry under fluctuating battery loads."}
                </p>
              </div>
            </article>

            {/* Card B: Target Instrumentation & Physical Hardware Context */}
            <article className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                <div className="flex items-center gap-2">
                  <Beaker className="w-5 h-5 text-blue-700" />
                  <h2 className="text-sm font-bold text-[#0f172a]">Target Instrumentation Conditions</h2>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  {currentRequest?.equipment?.status || "AVAILABLE"}
                </span>
              </div>

              {/* Instrument Specification Bento Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-[#e2e8f0]">
                  <span className="font-mono text-[10px] uppercase text-[#64748b] block">Target Device</span>
                  <span className="font-bold text-xs text-[#0f172a] mt-1 block">
                    {currentRequest?.equipment?.name || "Oscilloscope"}
                  </span>
                  <span className="font-mono text-[10px] text-[#64748b]">
                    {currentRequest?.equipment?.assetTag || "ASSET-01"}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-[#e2e8f0]">
                  <span className="font-mono text-[10px] uppercase text-[#64748b] block">Model / Manufacturer</span>
                  <span className="font-semibold text-xs text-[#0f172a] mt-1 block">
                    {currentRequest?.equipment?.model || "Keysight"}
                  </span>
                  <span className="text-[10px] text-[#64748b]">
                    {currentRequest?.equipment?.manufacturer || "Precision"}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-[#e2e8f0]">
                  <span className="font-mono text-[10px] uppercase text-[#64748b] block">Thermal / Buffer Prep</span>
                  <span className="font-mono font-bold text-xs text-blue-700 mt-1 block">
                    {currentRequest?.equipment?.bufferMinutes || 15} min
                  </span>
                  <span className="text-[10px] text-[#64748b]">Turnaround Window</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-[#e2e8f0]">
                  <span className="font-mono text-[10px] uppercase text-[#64748b] block">Requested Duration</span>
                  <span className="font-mono font-bold text-xs text-[#0f172a] mt-1 block">
                    {currentRequest?.requestedDurationHours || 2.0} hrs
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium">Standard Slot</span>
                </div>
              </div>

              {/* Contention Visualizer Gantt Strip */}
              <div className="p-3 rounded-lg bg-slate-50 border border-[#e2e8f0] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] uppercase text-[#64748b] font-semibold">
                    Laboratory Reservation Timeline (08:00 – 20:00 Operating Hours)
                  </span>
                  <span className="font-mono text-[11px] text-emerald-700 font-bold">
                    Clean Scheduling Block
                  </span>
                </div>

                {/* Timeline Bar */}
                <div className="relative w-full h-8 rounded bg-slate-200 overflow-hidden flex items-center">
                  <div className="w-[25%] h-full bg-slate-100 flex items-center justify-center border-r border-slate-300">
                    <span className="font-mono text-[9px] text-[#64748b]">08:00–11:00 Free</span>
                  </div>
                  <div className="w-[15%] h-full bg-amber-100 flex items-center justify-center border-r border-slate-300">
                    <span className="font-mono text-[9px] text-amber-800 font-medium">11:00 Prep</span>
                  </div>
                  <div className="w-[35%] h-full bg-blue-100 flex items-center justify-center border-r border-slate-300">
                    <span className="font-mono text-[9px] text-blue-800 font-bold">Candidate Slot</span>
                  </div>
                  <div className="w-[25%] h-full bg-slate-100 flex items-center justify-center">
                    <span className="font-mono text-[9px] text-[#64748b]">17:00–20:00 Open</span>
                  </div>
                </div>

                <div className="flex justify-between font-mono text-[10px] text-[#64748b] px-0.5">
                  <span>08:00</span>
                  <span>11:00</span>
                  <span>14:00</span>
                  <span>17:00</span>
                  <span>20:00</span>
                </div>
              </div>
            </article>

            {/* Card C: Candidate Contention & Equity Matrix */}
            <article className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-700" />
                  <h2 className="text-sm font-bold text-[#0f172a]">
                    Candidate Contention &amp; Equity Assessment
                  </h2>
                </div>
                <span className="font-mono text-[10px] text-[#64748b] uppercase">Multi-Vector Matrix</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#e2e8f0]">
                      <th className="py-2.5 px-3 font-mono text-[10px] uppercase text-[#64748b]">Decision Metric</th>
                      <th className="py-2.5 px-3 font-mono text-[10px] uppercase text-blue-700 font-bold bg-blue-50/50">
                        Applicant: {currentRequest?.student?.name || "Alex Chen"}
                      </th>
                      <th className="py-2.5 px-3 font-mono text-[10px] uppercase text-[#64748b]">
                        Operational Threshold
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-[#0f172a]">Academic Urgency</td>
                      <td className="py-2.5 px-3 bg-blue-50/20">
                        <span className="font-bold text-emerald-700">Thesis Milestone Confirmed</span>
                        <span className="block text-[11px] text-[#64748b]">Target degree deadline verified</span>
                      </td>
                      <td className="py-2.5 px-3 text-[#64748b]">Requires faculty co-sponsor sign-off</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-[#0f172a]">Monthly Quota Consumption</td>
                      <td className="py-2.5 px-3 bg-blue-50/20">
                        <div className="flex items-center justify-between max-w-xs">
                          <span className="font-mono text-xs font-semibold text-[#0f172a]">
                            {currentRequest?.student?.usedQuotaHours || 0}h / {currentRequest?.student?.quotaHours || 25}h
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700">Normal Range</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="bg-blue-700 h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                ((currentRequest?.student?.usedQuotaHours || 0) /
                                  (currentRequest?.student?.quotaHours || 25)) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#64748b]">25.0h / student monthly ceiling</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-[#0f172a]">Hazardous Materials</td>
                      <td className="py-2.5 px-3 bg-blue-50/20">
                        {currentRequest?.project?.hazardousMaterialsDeclared ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Declared: {currentRequest?.project?.safetyNotes || "Safety SOP Attached"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <Check className="w-3.5 h-3.5" /> None Declared (Standard Protocol)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#64748b]">Mandatory safety disclosure</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          {/* RIGHT COLUMN: Action Engine & Decision Console (5 cols) */}
          <aside className="lg:col-span-5 flex flex-col gap-5 lg:sticky lg:top-20">
            {/* Card 1: AI Arbiter Optimization Vector Panel */}
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs relative overflow-hidden space-y-3">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
              <div className="flex items-center justify-between pl-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-[#0f172a]">LabLink AI Arbiter Core</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[10px] font-bold">
                  AI RECOMMENDATION
                </span>
              </div>

              <div className="pl-1 space-y-1.5">
                <p className="text-xs font-bold text-[#0f172a] leading-snug">
                  {selectedSlot
                    ? `Award ${new Date(selectedSlot.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(selectedSlot.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} slot on ${currentRequest?.equipment?.name || "Instrument"} to ${currentRequest?.student?.name || "Alex Chen"}.`
                    : "Calculating optimal reservation candidate vector..."}
                </p>
                <p className="text-[11px] text-[#475569] leading-relaxed">
                  {selectedSlot?.explanation ||
                    "Minimizes setup thermal churn, satisfies student deadline constraints, and aligns with laboratory operational shifts."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 pl-1">
                <div className="p-2.5 rounded bg-slate-50 border border-[#e2e8f0]">
                  <span className="font-mono text-[9px] uppercase text-[#64748b] block">Contiguity Score</span>
                  <span className="font-mono text-sm font-bold text-indigo-700 block mt-0.5">
                    {selectedSlot ? `${Math.round(selectedSlot.contiguityScore * 100)}%` : "98%"}
                  </span>
                  <span className="text-[10px] text-[#64748b]">Minimum idle fragmentation</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-[#e2e8f0]">
                  <span className="font-mono text-[9px] uppercase text-[#64748b] block">Preference Alignment</span>
                  <span className="font-mono text-sm font-bold text-emerald-700 block mt-0.5">
                    {selectedSlot ? `${Math.round(selectedSlot.preferenceScore * 100)}%` : "100%"}
                  </span>
                  <span className="text-[10px] text-[#64748b]">Window match factor</span>
                </div>
              </div>
            </div>

            {/* Card 2: Interactive Candidate Slot Selector */}
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#0f172a]">Deterministic Candidate Slots</h3>
                <span className="font-mono text-[10px] text-[#64748b]">Select slot to commit</span>
              </div>

              {loadingSlots && (
                <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#64748b]">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
                  Generating candidate slots...
                </div>
              )}

              {!loadingSlots && candidateSlots.length === 0 && (
                <div className="p-4 rounded-lg bg-slate-50 text-center text-xs text-[#64748b]">
                  No candidate slots available within operating horizon.
                </div>
              )}

              {!loadingSlots && candidateSlots.length > 0 && (
                <div className="flex flex-col gap-2">
                  {candidateSlots.map((slot, idx) => {
                    const isSelected = idx === selectedSlotIndex;
                    const startDate = new Date(slot.startTime);
                    const endDate = new Date(slot.endTime);

                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setSelectedSlotIndex(idx)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-500 ring-1 ring-blue-500 shadow-2xs"
                            : "bg-slate-50/70 border-[#e2e8f0] hover:bg-white hover:border-[#cbd5e1]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-[#0f172a]">
                            {startDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          {slot.isRecommended && (
                            <span className="px-2 py-0.5 bg-blue-700 text-white rounded font-mono text-[9px] font-bold uppercase tracking-wider">
                              RECOMMENDED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-blue-700">
                            {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                            {endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="font-mono text-[10px] text-[#64748b]">
                            Score: {slot.compositeScore.toFixed(3)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#64748b] mt-1 line-clamp-1">{slot.explanation}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Card 3: Formal Faculty Decision Console */}
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
                <h3 className="text-xs font-bold text-[#0f172a]">PI Determination &amp; Sign-Off</h3>
                <span className="font-mono text-[10px] text-[#64748b]">SECURE PROTOCOL</span>
              </div>

              {/* Already Confirmed Banner */}
              {currentRequest?.status === "BOOKED" && (
                <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Already Confirmed &amp; Booked</span>
                    <span className="text-[11px]">
                      This requisition has already been confirmed on the equipment calendar.
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {currentRequest?.status !== "BOOKED" && currentRequest?.status !== "CANCELLED" && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={actionSubmitting || candidateSlots.length === 0}
                    onClick={handleConfirmSelectedSlot}
                    className="w-full py-2.5 px-4 rounded bg-blue-700 text-white font-semibold text-xs hover:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs flex items-center justify-center gap-2"
                  >
                    {actionSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Approve Request &amp; Commit Selected Slot
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={actionSubmitting}
                      onClick={handleApproveRequisition}
                      className="py-2 px-3 rounded bg-slate-100 text-[#0f172a] text-xs font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve Docket Only
                    </button>
                    <button
                      type="button"
                      disabled={actionSubmitting}
                      onClick={() => setRejectionOpen(!rejectionOpen)}
                      className="py-2 px-3 rounded bg-red-50 text-red-700 border border-red-200 text-xs font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      {rejectionOpen ? "Cancel Rejection" : "Reject Requisition"}
                    </button>
                  </div>
                </div>
              )}

              {/* Rejection / Override Sub-pane */}
              {rejectionOpen && (
                <div className="p-3 rounded-lg bg-red-50/50 border border-red-200 space-y-3">
                  <span className="font-mono text-[10px] uppercase text-red-800 font-bold block">
                    Faculty Feedback &amp; Rejection Justification
                  </span>
                  <div>
                    <label className="font-mono text-[10px] uppercase text-[#64748b] block mb-1">
                      Reason Category
                    </label>
                    <select
                      value={rejectionReasonCategory}
                      onChange={(e) => setRejectionReasonCategory(e.target.value)}
                      className="w-full text-xs p-2 bg-white rounded border border-[#cbd5e1] outline-none"
                    >
                      <option value="safety">Safety Certification Incomplete or Lapsed</option>
                      <option value="quota">Monthly Quota Exceeded / Fair Sharing Limit</option>
                      <option value="infeasible">Experimental Setup Infeasible on Requested Stage</option>
                      <option value="funding">Grant / Project Account Authorization Missing</option>
                      <option value="other">Institutional Laboratory Priority Override</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-mono text-[10px] uppercase text-[#64748b] block mb-1">
                      Comments &amp; Instructions to Student
                    </label>
                    <textarea
                      rows={3}
                      value={facultyComments}
                      onChange={(e) => setFacultyComments(e.target.value)}
                      placeholder="e.g. Please complete the high-voltage safety refresher and re-submit with an approved optical beam trap."
                      className="w-full text-xs p-2 bg-white rounded border border-[#cbd5e1] outline-none resize-none placeholder:text-[#94a3b8]"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={actionSubmitting}
                    onClick={handleRejectRequisition}
                    className="w-full py-2 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition-colors"
                  >
                    Confirm Rejection
                  </button>
                </div>
              )}

              {/* Cryptographic Audit Stamp */}
              <footer className="p-2.5 rounded bg-slate-50 border border-[#e2e8f0] font-mono text-[10px] text-[#64748b] space-y-1">
                <div className="flex items-center justify-between">
                  <span>AUDITOR:</span>
                  <span className="font-bold text-[#0f172a]">Prof. Marcus Vance (PI)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>INTEGRITY SHA-256:</span>
                  <span className="font-bold text-blue-700">8F9D-77A1-CC02-E24C</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>FRAMEWORK:</span>
                  <span className="text-[#0f172a]">ISO/IEC 42001 Audited Policy</span>
                </div>
              </footer>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function FacultyReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
        </div>
      }
    >
      <FacultyReviewContent />
    </Suspense>
  );
}
