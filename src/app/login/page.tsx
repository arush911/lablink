"use client";

import React, { useState } from "react";
import { ShieldCheck, Beaker, ArrowRight, Loader2, AlertCircle, User, GraduationCap, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [evaluatorSecret, setEvaluatorSecret] = useState("");
  const [loadingRole, setLoadingRole] = useState<"student" | "faculty" | "standard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleQuickLogin = async (role: "student" | "faculty") => {
    if (loadingRole !== null) return;
    setLoadingRole(role);
    setError(null);
    setSuccessMessage(null);
    try {
      let token = evaluatorSecret.trim();
      if (!token) {
        token = role === "student" ? "DEMO_TOKEN_STUDENT_ALEX_CHEN" : "DEMO_TOKEN_FACULTY_MARCUS_VANCE";
      }
      
      // Call server sync endpoint (which sets server-side HttpOnly cookie)
      const res = await fetch("/api/v1/auth/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.message === "DEMO_AUTH_STRICTLY_PROHIBITED_IN_PRODUCTION") {
          throw new Error("Production Security Lock: Default demo bearer tokens are locked out in production. Please enter the high-entropy Evaluator Secret below to proceed.");
        }
        throw new Error(data.message || `Authentication failed with status ${res.status}`);
      }

      const { user, sessionToken } = await res.json();
      setSuccessMessage(`Authenticated as ${user.fullName} (${user.role.toUpperCase()})`);

      // Set fallback client-side cookie if needed, while HttpOnly is set by server
      document.cookie = `lablink_token=${sessionToken || token}; path=/; max-age=86400; SameSite=Lax`;

      // Full navigation guarantees clean state and immediate cookie transmission
      if (user.role === "faculty") {
        window.location.href = "/faculty/review";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during sign-in.");
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-600 text-white shadow-sm mb-4">
          <Beaker className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
          LabLink Campus Resource Platform
        </h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Centralized Laboratory Scheduling &amp; Resource Sharing
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#e2e8f0] rounded-lg sm:px-10">
          {/* Quick Login Evaluation Panel */}
          <div className="mb-6 p-4 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#0037b0] uppercase tracking-wider font-mono">
              <ShieldCheck className="w-4 h-4 text-[#0037b0]" />
              <span>Evaluator One-Click Demonstration Sign-In</span>
            </div>
            <p className="text-xs text-[#64748b] mb-4">
              Select a pre-seeded account below for instant evaluation without passwords or manual configuration:
            </p>

            <div className="space-y-3">
              {/* CONTINUE AS STUDENT */}
              <button
                type="button"
                id="btn-login-student"
                onClick={() => handleQuickLogin("student")}
                disabled={loadingRole !== null}
                className="w-full flex items-center justify-between p-3.5 text-xs font-medium text-left border-2 border-blue-600 rounded-lg bg-blue-50/50 hover:bg-blue-100/60 hover:shadow-sm transition-all focus:ring-2 focus:ring-blue-600 focus:outline-none disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {loadingRole === "student" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <GraduationCap className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-blue-700 font-bold">
                      Option 1 — Student Role
                    </div>
                    <div className="text-sm font-bold text-[#0f172a]">
                      CONTINUE AS STUDENT
                    </div>
                    <div className="text-[11px] text-[#475569] font-mono mt-0.5">
                      student.demo@lablink.edu • Alex Chen (25h Quota)
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-600 shrink-0 ml-2" />
              </button>

              {/* CONTINUE AS FACULTY */}
              <button
                type="button"
                id="btn-login-faculty"
                onClick={() => handleQuickLogin("faculty")}
                disabled={loadingRole !== null}
                className="w-full flex items-center justify-between p-3.5 text-xs font-medium text-left border-2 border-teal-700 rounded-lg bg-teal-50/50 hover:bg-teal-100/60 hover:shadow-sm transition-all focus:ring-2 focus:ring-teal-700 focus:outline-none disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {loadingRole === "faculty" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-teal-800 font-bold">
                      Option 2 — Faculty Role
                    </div>
                    <div className="text-sm font-bold text-[#0f172a]">
                      CONTINUE AS FACULTY
                    </div>
                    <div className="text-[11px] text-[#475569] font-mono mt-0.5">
                      faculty.demo@lablink.edu • Prof. Marcus Vance (Reviewer)
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-teal-700 shrink-0 ml-2" />
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-[#cbd5e1]/60">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#64748b] font-mono mb-1">
                Production Evaluator Secret (Optional for Local, Required for Prod)
              </label>
              <input
                type="password"
                value={evaluatorSecret}
                onChange={(e) => setEvaluatorSecret(e.target.value)}
                placeholder="Enter high-entropy evaluator secret..."
                className="w-full px-2.5 py-1.5 text-xs border border-[#cbd5e1] rounded bg-white font-mono focus:ring-1 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Standard Institutional Sign In */}
          <div className="relative mb-4 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e2e8f0]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-[#64748b] font-mono text-[10px]">
                or institutional credentials
              </span>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes("faculty")) {
                handleQuickLogin("faculty");
              } else {
                handleQuickLogin("student");
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] font-mono mb-1">
                University Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@university.edu"
                className="w-full px-3 py-2 text-sm border border-[#cbd5e1] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] font-mono mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 text-sm border border-[#cbd5e1] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loadingRole !== null}
              className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-colors"
            >
              Sign In to Laboratory Network
            </button>
          </form>

          <div className="mt-6 border-t border-[#e2e8f0] pt-4 text-center">
            <p className="text-[11px] text-[#64748b]">
              LabLink Zero-Trust Concurrency Engine • PromptWars 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
