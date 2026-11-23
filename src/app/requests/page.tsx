"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Beaker,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Calendar,
  RefreshCw,
  Ban,
  Loader2,
} from "lucide-react";

interface RequestDocket {
  id: string;
  docketNumber: string;
  status: "SUBMITTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "BOOKED" | "CANCELLED";
  requestedDurationHours: number;
  projectDeadline: string | null;
  preferredWindowStart: string | null;
  preferredWindowEnd: string | null;
  rejectionReason: string | null;
  createdAt: string;
  project: {
    title: string;
    abstract: string;
    courseCode: string | null;
    grantCode: string | null;
    hazardousMaterialsDeclared: boolean;
  };
  equipment: {
    id: string;
    name: string;
    model: string;
    assetTag: string;
    laboratoryName: string;
    roomLocation: string;
  };
  confirmedBooking: {
    id: string;
    referenceId: string;
    startTime: string;
    endTime: string;
    status: string;
  } | null;
}

export default function RequestTrackingPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestDocket[]>([]);
  const [studentMeta, setStudentMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "APPROVED" | "CANCELLED">("ALL");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/requests/me", {
        headers: {
          Authorization: "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN",
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load your access request dockets.");
      }

      const data = await res.json();
      setRequests(data.requests);
      setStudentMeta(data.student);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (docketId: string) => {
    if (!confirm("Are you sure you want to cancel this access request?")) return;
    setCancellingId(docketId);
    try {
      const res = await fetch(`/api/v1/requests/${docketId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN",
        },
        body: JSON.stringify({ reason: "Student self-service cancellation" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to cancel request.");
      }

      await fetchMyRequests();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  // Tab filtering
  const filteredRequests = requests.filter((r) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "PENDING") return r.status === "PENDING_REVIEW" || r.status === "SUBMITTED";
    if (activeTab === "APPROVED") return r.status === "APPROVED" || r.status === "BOOKED";
    if (activeTab === "CANCELLED") return r.status === "CANCELLED" || r.status === "REJECTED";
    return true;
  });

  const quotaRemaining = studentMeta
    ? Math.max(0, studentMeta.monthlyQuotaHours - studentMeta.usedQuotaHours).toFixed(1)
    : "20.5";

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#0f172a] font-sans pb-12">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-blue-700 font-bold text-lg tracking-tight">
              <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Beaker className="w-5 h-5" />
              </div>
              <span>LabLink</span>
            </div>

            <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
              <button
                onClick={() => router.push("/equipment")}
                className="px-3 py-1.5 rounded text-[#475569] hover:text-[#0f172a] hover:bg-slate-100 transition-colors"
              >
                Equipment Catalog
              </button>
              <button
                onClick={() => router.push("/requests")}
                className="px-3 py-1.5 rounded bg-blue-50 text-blue-700 font-semibold"
              >
                My Access Dockets
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/requests/new")}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>New Request</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Metric Bar (Stitch Screen 08) */}
        <div className="bg-white p-5 rounded-lg border border-[#e2e8f0] shadow-xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#64748b]">
              <span>STUDENT ACCESS CONSOLE</span>
              <span>/</span>
              <span className="text-blue-700 font-semibold">REQUEST TRACKING</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#0f172a] mt-0.5">
              Laboratory Request Docket Tracking
            </h1>
            <p className="text-xs text-[#64748b] mt-0.5">
              Real-time pipeline progression, faculty review milestones, and confirmed booking reservations.
            </p>
          </div>

          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-[#e2e8f0] pt-3 md:pt-0 md:pl-6">
            <div>
              <div className="text-[10px] font-mono font-semibold uppercase text-[#64748b]">
                Student Quota Available
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono text-lg font-bold text-blue-700">{quotaRemaining}</span>
                <span className="font-mono text-xs text-[#64748b]">/ {studentMeta?.monthlyQuotaHours || "25.0"}h</span>
              </div>
            </div>

            <div className="hidden sm:block">
              <div className="text-[10px] font-mono font-semibold uppercase text-[#64748b]">
                Scheduler Sync
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs text-emerald-700 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active 14ms Latency</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center justify-between gap-3 mb-6 border-b border-[#e2e8f0] pb-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                activeTab === "ALL"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-white text-[#475569] hover:bg-slate-100 border border-[#e2e8f0]"
              }`}
            >
              All Dockets ({requests.length})
            </button>
            <button
              onClick={() => setActiveTab("PENDING")}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                activeTab === "PENDING"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-white text-[#475569] hover:bg-slate-100 border border-[#e2e8f0]"
              }`}
            >
              Pending Review ({requests.filter((r) => r.status === "PENDING_REVIEW").length})
            </button>
            <button
              onClick={() => setActiveTab("APPROVED")}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                activeTab === "APPROVED"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-white text-[#475569] hover:bg-slate-100 border border-[#e2e8f0]"
              }`}
            >
              Approved & Booked ({requests.filter((r) => r.status === "APPROVED" || r.status === "BOOKED").length})
            </button>
            <button
              onClick={() => setActiveTab("CANCELLED")}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                activeTab === "CANCELLED"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-white text-[#475569] hover:bg-slate-100 border border-[#e2e8f0]"
              }`}
            >
              Cancelled / Rejected ({requests.filter((r) => r.status === "CANCELLED" || r.status === "REJECTED").length})
            </button>
          </div>

          <button
            onClick={fetchMyRequests}
            title="Refresh Dockets"
            className="p-1.5 text-[#64748b] hover:text-[#0f172a] rounded hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-6 rounded-lg border border-[#e2e8f0] animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-6 bg-slate-200 rounded w-1/2"></div>
                <div className="h-12 bg-slate-100 rounded"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-red-900">Failed to load request tracking</h3>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredRequests.length === 0 && (
          <div className="bg-white p-12 text-center border border-[#e2e8f0] rounded-lg">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-[#0f172a]">No request dockets found</h3>
            <p className="text-xs text-[#64748b] mt-1 max-w-sm mx-auto">
              You haven&apos;t filed any laboratory access requests under this filter category yet.
            </p>
            <button
              onClick={() => router.push("/equipment")}
              className="mt-4 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded"
            >
              Browse Equipment & Apply
            </button>
          </div>
        )}

        {/* Request Cards */}
        {!loading && !error && filteredRequests.length > 0 && (
          <div className="space-y-4">
            {filteredRequests.map((req) => {
              const isPending = req.status === "PENDING_REVIEW" || req.status === "SUBMITTED";
              const isApproved = req.status === "APPROVED";
              const isBooked = req.status === "BOOKED";
              const isRejected = req.status === "REJECTED";

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-lg border border-[#e2e8f0] p-5 shadow-xs space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f1f5f9] pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded">
                        {req.docketNumber}
                      </span>
                      <span className="text-xs text-[#64748b] font-mono">
                        Filed: {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold font-mono border ${
                          isBooked
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : isApproved
                            ? "bg-teal-50 text-teal-800 border-teal-200"
                            : isPending
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-red-50 text-red-800 border-red-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isBooked
                              ? "bg-emerald-600"
                              : isApproved
                              ? "bg-teal-600"
                              : isPending
                              ? "bg-amber-600"
                              : "bg-red-600"
                          }`}
                        />
                        <span>{req.status.replace("_", " ")}</span>
                      </span>

                      {(isPending || isApproved) && (
                        <button
                          type="button"
                          onClick={() => handleCancel(req.id)}
                          disabled={cancellingId === req.id}
                          className="px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50 border border-red-200 rounded font-medium flex items-center gap-1 transition-colors"
                        >
                          {cancellingId === req.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Ban className="w-3 h-3" />
                          )}
                          <span>Cancel Docket</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Instrument & Project Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="md:col-span-2 space-y-1">
                      <div className="text-[11px] font-mono text-[#64748b] uppercase font-semibold">
                        {req.equipment.name} ({req.equipment.assetTag})
                      </div>
                      <h3 className="text-base font-bold text-[#0f172a]">
                        {req.project.title}
                      </h3>
                      <p className="text-xs text-[#475569] line-clamp-2 mt-1">
                        {req.project.abstract}
                      </p>
                    </div>

                    <div className="bg-[#f8fafc] p-3 rounded border border-[#f1f5f9] font-mono text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Facility:</span>
                        <span className="font-semibold text-[#0f172a]">{req.equipment.laboratoryName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Location:</span>
                        <span>{req.equipment.roomLocation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Duration:</span>
                        <span className="font-bold text-blue-700">{req.requestedDurationHours} Hours</span>
                      </div>
                      {req.projectDeadline && (
                        <div className="flex justify-between">
                          <span className="text-[#64748b]">Deadline:</span>
                          <span className="text-amber-700 font-semibold">{req.projectDeadline}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Multi-Stage Milestone Stepper (Stitch Screen 08) */}
                  <div className="pt-2 border-t border-[#f1f5f9]">
                    <div className="text-[10px] font-mono uppercase text-[#64748b] font-semibold mb-2">
                      Pipeline Progression Stepper
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      {/* Step 1: Submission */}
                      <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                        <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>1. Submitted</span>
                        </div>
                        <div className="text-[10px] text-emerald-700 font-mono mt-0.5">Docket Created</div>
                      </div>

                      {/* Step 2: Faculty Review */}
                      <div
                        className={`p-2.5 rounded border ${
                          isApproved || isBooked
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : isRejected
                            ? "bg-red-50 border-red-200 text-red-800"
                            : isPending
                            ? "bg-amber-50 border-amber-200 text-amber-800 animate-pulse"
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                          {isApproved || isBooked ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : isRejected ? (
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          <span>2. Faculty Review</span>
                        </div>
                        <div className="text-[10px] font-mono mt-0.5">
                          {isApproved || isBooked
                            ? "Merit Approved"
                            : isRejected
                            ? "Declined"
                            : isPending
                            ? "In Review Queue"
                            : "Awaiting"}
                        </div>
                      </div>

                      {/* Step 3: Slot Confirmation */}
                      <div
                        className={`p-2.5 rounded border ${
                          isBooked
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : isApproved
                            ? "bg-blue-50 border-blue-200 text-blue-800 font-semibold animate-pulse"
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                          {isBooked ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Calendar className="w-3.5 h-3.5" />
                          )}
                          <span>3. Slot Booking</span>
                        </div>
                        <div className="text-[10px] font-mono mt-0.5">
                          {isBooked ? "GiST Locked" : isApproved ? "Ready to Confirm" : "Unassigned"}
                        </div>
                      </div>

                      {/* Step 4: Experimental Access */}
                      <div
                        className={`p-2.5 rounded border ${
                          isBooked
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                          <Beaker className="w-3.5 h-3.5" />
                          <span>4. Lab Access</span>
                        </div>
                        <div className="text-[10px] font-mono mt-0.5">
                          {isBooked ? "Reserved" : "Pending"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Confirmed Booking Banner (If Booked) */}
                  {req.confirmedBooking && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900 font-mono">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div>
                          <span className="font-bold">CONFIRMED TIME SLOT: </span>
                          <span>
                            {new Date(req.confirmedBooking.startTime).toLocaleString()} —{" "}
                            {new Date(req.confirmedBooking.endTime).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-emerald-800">
                        Ref: <strong>{req.confirmedBooking.referenceId}</strong>
                      </div>
                    </div>
                  )}

                  {/* Rejection / Cancellation Notes */}
                  {req.rejectionReason && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-bold">Faculty Review Notes:</div>
                        <div>{req.rejectionReason}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
