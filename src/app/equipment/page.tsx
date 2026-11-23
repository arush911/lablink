"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Clock,
  Shield,
  Building,
  AlertTriangle,
  Beaker,
  FileText,
  LogOut,
  Info,
  X,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Loader2,
} from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  assetTag: string;
  status: "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "OFFLINE";
  requiresQualification: boolean;
  qualificationTitle: string | null;
  bufferMinutes: number;
  technicalSpecifications: Record<string, any>;
  department: {
    id: string;
    name: string;
    code: string;
    building: string;
  };
  laboratory: {
    id: string;
    name: string;
    roomLocation: string;
    cancellationBufferMinutes: number;
  };
  capabilities: Array<{
    id: string;
    name: string;
    description: string;
    parameterRange: string;
  }>;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function EquipmentDiscoveryPage() {
  const router = useRouter();
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // AI NLP Query Assistant
  const [aiParsing, setAiParsing] = useState(false);
  const [aiBanner, setAiBanner] = useState<any | null>(null);

  // Inspection Drawer
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  // User session
  const [currentUser, setCurrentUser] = useState<any>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      }
    } catch {
      // Ignored for unauthenticated browsing
    }
  }, []);

  const fetchEquipment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.set("search", searchTerm);
      if (selectedDept !== "all") queryParams.set("departmentId", selectedDept);
      if (selectedStatus !== "all") queryParams.set("status", selectedStatus);

      const res = await fetch(`/api/v1/equipment?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load laboratory instrumentation catalog.");
      }
      const data = await res.json();
      setEquipmentList(data.equipment);
      setDepartments(data.departments);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading equipment.");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedDept, selectedStatus]);

  useEffect(() => {
    fetchSession();
    fetchEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAiQueryParse = async () => {
    if (!searchTerm.trim()) return;
    setAiParsing(true);
    try {
      const res = await fetch("/api/v1/ai/parse-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchTerm }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiBanner({
          source: data.source,
          ...data.parsed,
        });
        // Pre-fill search with matched equipment or keywords if available
        if (data.parsed.technicalKeywords && data.parsed.technicalKeywords.length > 0) {
          setSearchTerm(data.parsed.technicalKeywords[0]);
        }
        fetchEquipment();
      }
    } catch (err) {
      console.warn("AI parse error:", err);
    } finally {
      setAiParsing(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEquipment();
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedDept("all");
    setSelectedStatus("all");
    fetchEquipment();
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#0f172a] font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-blue-700 font-bold text-lg tracking-tight">
              <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Beaker className="w-5 h-5" />
              </div>
              <span>LabLink</span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-medium">
                2026 Core
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
              <button
                onClick={() => router.push("/equipment")}
                className="px-3 py-1.5 rounded bg-blue-50 text-blue-700 font-semibold"
              >
                Equipment Catalog
              </button>
              <button
                onClick={() => router.push("/requests")}
                className="px-3 py-1.5 rounded text-[#475569] hover:text-[#0f172a] hover:bg-slate-100 transition-colors"
              >
                My Access Dockets
              </button>
              {currentUser?.role === "faculty" && (
                <button
                  onClick={() => router.push("/faculty/review")}
                  className="px-3 py-1.5 rounded text-teal-800 bg-teal-50 font-semibold border border-teal-200"
                >
                  Faculty Review Console
                </button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-[#0f172a]">{currentUser.fullName}</div>
                  <div className="text-[11px] text-[#64748b] font-mono">
                    {currentUser.role.toUpperCase()} • Quota: {currentUser.usedQuotaHours}/{currentUser.monthlyQuotaHours}h
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs border border-blue-200">
                  {currentUser.fullName ? currentUser.fullName.charAt(0) : "U"}
                </div>
                <button
                  onClick={async () => {
                    try {
                      await fetch("/api/v1/auth/logout", { method: "POST" });
                    } catch {}
                    document.cookie = "lablink_token=; path=/; max-age=0";
                    router.push("/login");
                  }}
                  title="Sign Out"
                  className="p-1.5 text-[#64748b] hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Breadcrumb & Title */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748b] font-mono mb-1">
              <span>CAMPUS INSTRUMENTATION</span>
              <span>/</span>
              <span className="text-blue-700 font-semibold">ALL DEPARTMENTS</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
              Equipment Discovery & Specifications
            </h1>
            <p className="text-xs text-[#64748b] mt-0.5">
              Browse shared university research instrumentation, inspection parameters, and verified operating hours.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/requests/new")}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Submit Project Docket</span>
            </button>
          </div>
        </div>

        {/* Omnisearch & Multitier Filter Bar */}
        <div className="bg-white p-4 rounded-lg border border-[#e2e8f0] shadow-xs mb-6 space-y-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94a3b8]">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search or describe needed equipment in natural language (e.g. '3 hours on RF oscilloscope')..."
              className="w-full pl-10 pr-36 py-2 bg-[#f8fafc] text-sm text-[#0f172a] placeholder-[#94a3b8] rounded border border-[#cbd5e1] focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 font-sans"
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAiQueryParse}
                disabled={aiParsing || !searchTerm.trim()}
                className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium rounded hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-1 transition-colors"
                title="Parse with AI Arbiter"
              >
                {aiParsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-indigo-600" />}
                <span>AI Parse</span>
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 text-xs bg-blue-700 text-white font-medium rounded hover:bg-blue-800 transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* AI Arbiter Interpretation Banner */}
          {aiBanner && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-950 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-indigo-900">
                      AI Arbiter Query Analysis
                    </span>
                    <span className="font-mono text-[9px] bg-indigo-200/70 text-indigo-800 px-1.5 py-0.2 rounded uppercase">
                      {aiBanner.source}
                    </span>
                  </div>
                  <p className="mt-1 text-indigo-900 leading-relaxed">{aiBanner.explanation}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="font-mono text-[10px] bg-white border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded">
                      Duration: {aiBanner.suggestedDurationHours}h
                    </span>
                    <span className="font-mono text-[10px] bg-white border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded">
                      Window: {aiBanner.timeWindowDescription}
                    </span>
                    {aiBanner.targetEquipment?.map((eq: string) => (
                      <span key={eq} className="font-mono text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                        Target: {eq}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAiBanner(null)}
                className="text-indigo-400 hover:text-indigo-800 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#f1f5f9]">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-[11px] font-semibold text-[#64748b] uppercase">Department:</span>
              <select
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                }}
                className="bg-[#f8fafc] border border-[#cbd5e1] rounded px-2.5 py-1 text-xs text-[#0f172a] font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
              >
                <option value="all">All Departments ({departments.length})</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>

              <span className="font-mono text-[11px] font-semibold text-[#64748b] uppercase ml-2">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                }}
                className="bg-[#f8fafc] border border-[#cbd5e1] rounded px-2.5 py-1 text-xs text-[#0f172a] font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="IN_USE">In Use</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="OFFLINE">Offline</option>
              </select>

              <button
                type="button"
                onClick={fetchEquipment}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-[#475569] rounded font-medium transition-colors"
              >
                Apply Filters
              </button>

              {(searchTerm || selectedDept !== "all" || selectedStatus !== "all") && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2 py-1 text-[#64748b] hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="text-xs font-mono text-[#64748b]">
              Showing <span className="font-bold text-[#0f172a]">{equipmentList.length}</span> instrument{equipmentList.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white p-5 rounded-lg border border-[#e2e8f0] animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="h-8 bg-slate-100 rounded"></div>
                  <div className="h-8 bg-slate-100 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
            <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-red-900">Failed to load equipment catalog</h3>
            <p className="text-xs text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchEquipment}
              className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && equipmentList.length === 0 && (
          <div className="bg-white p-12 text-center border border-[#e2e8f0] rounded-lg">
            <Beaker className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-[#0f172a]">No instruments match your criteria</h3>
            <p className="text-xs text-[#64748b] mt-1 max-w-sm mx-auto">
              Try adjusting your search terms, clearing department filters, or resetting availability status.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Equipment Grid */}
        {!loading && !error && equipmentList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {equipmentList.map((item) => {
              const isAvailable = item.status === "AVAILABLE";
              const isInUse = item.status === "IN_USE";

              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#e2e8f0] rounded-lg p-5 flex flex-col justify-between hover:border-[#cbd5e1] hover:shadow-xs transition-all"
                >
                  <div>
                    {/* Top Meta: Asset Tag & Status Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-[11px] font-semibold text-[#64748b] bg-slate-100 px-2 py-0.5 rounded">
                        {item.assetTag}
                      </span>

                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono border ${
                          isAvailable
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : isInUse
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-red-50 text-red-800 border-red-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isAvailable
                              ? "bg-emerald-600"
                              : isInUse
                              ? "bg-blue-600"
                              : "bg-red-600"
                          }`}
                        />
                        <span>{item.status}</span>
                      </div>
                    </div>

                    {/* Instrument Name & Model */}
                    <h3 className="text-base font-bold text-[#0f172a] tracking-tight leading-snug">
                      {item.name}
                    </h3>
                    <div className="text-xs text-[#64748b] font-mono mt-0.5">
                      {item.manufacturer} • {item.model}
                    </div>

                    {/* Facility & Location */}
                    <div className="mt-3 flex items-start gap-1.5 text-xs text-[#475569]">
                      <Building className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                      <div>
                        <span className="font-medium">{item.laboratory.name}</span>
                        <span className="text-[#64748b]"> ({item.laboratory.roomLocation})</span>
                        <div className="text-[11px] text-[#64748b]">{item.department.name}</div>
                      </div>
                    </div>

                    {/* Key Technical Specifications Table */}
                    <div className="mt-4 p-2.5 bg-[#f8fafc] border border-[#f1f5f9] rounded text-xs space-y-1">
                      <div className="text-[10px] font-mono uppercase text-[#64748b] font-semibold tracking-wider mb-1">
                        Core Capabilities & Specs
                      </div>
                      {Object.entries(item.technicalSpecifications).slice(0, 3).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center text-[11px]">
                          <span className="text-[#64748b] capitalize">{key.replace(/_/g, " ")}:</span>
                          <span className="font-mono font-medium text-[#0f172a] text-right truncate max-w-[150px]">
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Prerequisites and Buffers */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-[#475569] rounded text-[11px] font-mono">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{item.bufferMinutes}m Turnaround</span>
                      </span>

                      {item.requiresQualification && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[11px] font-medium">
                          <Shield className="w-3 h-3 text-amber-600" />
                          <span>{item.qualificationTitle || "Briefing Required"}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEquipment(item)}
                      className="px-2.5 py-1.5 text-xs text-[#475569] hover:text-[#0f172a] hover:bg-slate-100 rounded font-medium flex items-center gap-1 transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push(`/requests/new?equipmentId=${item.id}`)}
                      className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <span>Request Access</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail Inspection Modal */}
      {selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-[#cbd5e1] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
              <div>
                <span className="text-[11px] font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  {selectedEquipment.assetTag}
                </span>
                <h2 className="text-base font-bold text-[#0f172a] mt-1">
                  {selectedEquipment.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedEquipment(null)}
                className="p-1 rounded text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <h4 className="font-mono text-[11px] font-semibold text-[#64748b] uppercase tracking-wider mb-2">
                  Laboratory & Department Information
                </h4>
                <div className="bg-[#f8fafc] p-3 rounded border border-[#e2e8f0] space-y-1">
                  <div><span className="font-semibold">Facility:</span> {selectedEquipment.laboratory.name}</div>
                  <div><span className="font-semibold">Room:</span> {selectedEquipment.laboratory.roomLocation}</div>
                  <div><span className="font-semibold">Department:</span> {selectedEquipment.department.name} ({selectedEquipment.department.building})</div>
                  <div><span className="font-semibold">Serial Number:</span> <span className="font-mono">{selectedEquipment.serialNumber}</span></div>
                  <div><span className="font-semibold">Turnaround Buffer:</span> {selectedEquipment.bufferMinutes} minutes mandatory cool-down</div>
                </div>
              </div>

              <div>
                <h4 className="font-mono text-[11px] font-semibold text-[#64748b] uppercase tracking-wider mb-2">
                  Full Technical Specifications
                </h4>
                <div className="bg-[#f8fafc] p-3 rounded border border-[#e2e8f0] font-mono text-[11px] space-y-1">
                  {Object.entries(selectedEquipment.technicalSpecifications).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[#f1f5f9] py-1">
                      <span className="text-[#64748b]">{k}:</span>
                      <span className="font-semibold text-[#0f172a]">
                        {Array.isArray(v) ? v.join(", ") : JSON.stringify(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedEquipment.requiresQualification && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2">
                  <Shield className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-amber-900">Safety Prerequisite Required</div>
                    <div className="text-amber-700 text-[11px]">
                      Operation requires verified qualification: <strong>{selectedEquipment.qualificationTitle}</strong>.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedEquipment(null)}
                className="px-3 py-1.5 text-xs text-[#475569] hover:bg-slate-200 rounded font-medium"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = selectedEquipment.id;
                  setSelectedEquipment(null);
                  router.push(`/requests/new?equipmentId=${id}`);
                }}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs"
              >
                <span>Request Access for This Machine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
