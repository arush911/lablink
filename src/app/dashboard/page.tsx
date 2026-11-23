"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Shield,
  FileText,
  Search,
  LogOut,
  ChevronRight,
  ArrowRight,
  Activity,
  Layers,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: "student" | "faculty";
  monthlyQuotaHours: number;
  usedQuotaHours: number;
  departmentId: string | null;
  isActive: boolean;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRequests, setActiveRequests] = useState<any[]>([]);

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/auth/me");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.user.role === "faculty") {
        router.push("/faculty/review");
        return;
      }
      setUser(data.user);

      // Fetch user's own requests
      const reqRes = await fetch("/api/v1/requests/me");
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setActiveRequests(reqData.requests || []);
      }
    } catch (err) {
      console.error("Dashboard session load failed:", err);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout request failed:", err);
    }
    document.cookie = "lablink_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono uppercase tracking-wider text-[#64748b]">
            Authenticating Laboratory Terminal...
          </p>
        </div>
      </div>
    );
  }

  const quotaTotal = user?.monthlyQuotaHours ?? 25.0;
  const quotaUsed = user?.usedQuotaHours ?? 4.5;
  const quotaPercent = Math.min(100, Math.round((quotaUsed / quotaTotal) * 100));

  const pendingCount = activeRequests.filter((r) => r.status === "PENDING_REVIEW").length;
  const approvedCount = activeRequests.filter(
    (r) => r.status === "APPROVED" || r.status === "SCHEDULED" || r.status === "COMPLETED"
  ).length;

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#0f172a] font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[#e2e8f0] bg-white sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-sm tracking-tight">
              LL
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-[#0f172a]">LabLink</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-mono uppercase text-[#64748b] border-l border-[#cbd5e1] pl-2">
                Cambridge Core Res
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-50 text-blue-700"
            >
              Overview
            </Link>
            <Link
              href="/equipment"
              className="px-3 py-1.5 rounded text-xs font-medium text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
            >
              Equipment Catalog
            </Link>
            <Link
              href="/requests"
              className="px-3 py-1.5 rounded text-xs font-medium text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
            >
              My Requests
            </Link>
            <Link
              href="/calendar"
              className="px-3 py-1.5 rounded text-xs font-medium text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
            >
              Master Calendar
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-[#0f172a] leading-tight">
              {user?.fullName || "Alex Chen"}
            </span>
            <span className="text-[10px] font-mono uppercase text-[#006a61] font-semibold">
              Student Researcher • PhD Candidate
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 text-[#64748b] hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Terminal Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Section 1: Welcome & Clearance Badge Bar */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase text-[#64748b] mb-1">
                <span>Student Researcher Terminal</span>
                <span>/</span>
                <span>Cavendish Laboratory</span>
                <span>/</span>
                <span className="text-[#006a61] font-semibold">Node 04-B</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
                Welcome back, {user?.fullName || "Alex Chen"}
              </h1>
              <p className="text-sm text-[#64748b] mt-0.5">
                PhD Candidate — Materials Science &amp; Robotics Research Group
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-[#f8fafc] border border-[#e2e8f0] px-3.5 py-2 rounded flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase text-[#64748b]">Safety Clearance</span>
                  <span className="text-xs font-semibold text-[#0f172a]">
                    Cleanroom ISO-Class 5 &amp; High-Vacuum
                  </span>
                </div>
              </div>

              <div className="bg-[#f8fafc] border border-[#e2e8f0] px-3.5 py-2 rounded flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase text-[#64748b]">Badge ID</span>
                  <span className="text-xs font-mono font-semibold text-[#0f172a]">CAM-882109-MSR</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Bookings */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[#64748b]">Active Bookings</span>
              <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold text-[#0f172a]">{approvedCount > 0 ? approvedCount : 1}</div>
              <p className="text-xs text-[#64748b] mt-1">Confirmed slots reserved</p>
            </div>
            <Link
              href="/calendar"
              className="text-xs text-blue-600 font-semibold flex items-center justify-between hover:underline"
            >
              <span>View in Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Pending Reviews */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[#64748b]">Faculty Approvals</span>
              <div className="w-7 h-7 rounded bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold text-[#0f172a]">{pendingCount > 0 ? pendingCount : 1}</div>
              <p className="text-xs text-[#64748b] mt-1">Requests pending faculty review</p>
            </div>
            <Link
              href="/requests"
              className="text-xs text-amber-700 font-semibold flex items-center justify-between hover:underline"
            >
              <span>Track Docket Status</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Quota Utilisation */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[#64748b]">Monthly Quota</span>
              <div className="w-7 h-7 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[#0f172a]">{quotaUsed.toFixed(1)}h</span>
                <span className="text-xs text-[#64748b]">/ {quotaTotal.toFixed(1)}h</span>
              </div>
              <div className="w-full bg-[#f1f5f9] h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-[#64748b]">
              <span>Fairness Index</span>
              <span className="font-mono font-semibold text-emerald-700">98% (Optimal)</span>
            </div>
          </div>

          {/* Certified Workstations */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[#64748b]">Available Core Labs</span>
              <div className="w-7 h-7 rounded bg-purple-50 text-purple-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold text-[#0f172a]">6</div>
              <p className="text-xs text-[#64748b] mt-1">Cross-department instruments</p>
            </div>
            <Link
              href="/equipment"
              className="text-xs text-purple-700 font-semibold flex items-center justify-between hover:underline"
            >
              <span>Explore Facilities</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Section 3: Quick Action Launchpad */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#64748b] mb-4">
            Research Workflow Launchpad
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/equipment"
              className="group bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-sm hover:border-blue-500 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#0f172a] group-hover:text-blue-600 transition-colors">
                  Explore Instrumentation
                </h3>
                <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                  Search specialised equipment, inspect technical parameters, and query with AI natural language parsing.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center text-xs font-semibold text-blue-600">
                <span>Browse Catalog</span>
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/requests/new"
              className="group bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#0f172a] group-hover:text-emerald-700 transition-colors">
                  Submit Access Request
                </h3>
                <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                  Draft a project proposal with preferred scheduling windows, material declarations, and required duration.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center text-xs font-semibold text-emerald-700">
                <span>Start New Docket</span>
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/calendar"
              className="group bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-sm hover:border-purple-500 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#0f172a] group-hover:text-purple-700 transition-colors">
                  Master Calendar
                </h3>
                <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                  Inspect confirmed laboratory bookings, buffer times, and equipment availability across campus facilities.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center text-xs font-semibold text-purple-700">
                <span>Open Timetable</span>
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
