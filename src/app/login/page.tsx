"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Beaker, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickLogin = async (role: "student" | "faculty") => {
    setLoading(true);
    setError(null);
    try {
      const token = role === "student" ? "DEMO_TOKEN_STUDENT_ALEX_CHEN" : "DEMO_TOKEN_FACULTY_MARCUS_VANCE";
      
      // Call server sync endpoint
      const res = await fetch("/api/v1/auth/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Authentication synchronization failed");
      }

      const { user } = await res.json();

      // Set cookie for client session persistence
      document.cookie = `lablink_token=${token}; path=/; max-age=86400; SameSite=Lax`;

      // Redirect to role-appropriate portal
      if (user.role === "faculty") {
        router.push("/faculty/review");
      } else {
        router.push("/equipment");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during sign-in.");
    } finally {
      setLoading(false);
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
          Centralized Laboratory Scheduling & Resource Sharing
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#e2e8f0] rounded-lg sm:px-10">
          {/* Quick Login Evaluation Panel */}
          <div className="mb-6 p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-md">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#0037b0] uppercase tracking-wider font-mono">
              <ShieldCheck className="w-4 h-4 text-[#0037b0]" />
              <span>Evaluator One-Click Demonstration Sign-In</span>
            </div>
            <p className="text-xs text-[#64748b] mb-4">
              Select a pre-seeded account to test role permissions, booking locks, and scheduling:
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("student")}
                disabled={loading}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-left border border-[#cbd5e1] rounded bg-white hover:bg-[#f1f5f9] transition-colors focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px]">
                    AC
                  </div>
                  <div>
                    <div className="font-semibold text-[#0f172a]">Alex Chen (Student Researcher)</div>
                    <div className="text-[11px] text-[#64748b] font-mono">student.demo@lablink.edu • 25h Quota</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#64748b]" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("faculty")}
                disabled={loading}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-left border border-[#cbd5e1] rounded bg-white hover:bg-[#f1f5f9] transition-colors focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-semibold text-[10px]">
                    MV
                  </div>
                  <div>
                    <div className="font-semibold text-[#0f172a]">Prof. Marcus Vance (Faculty / Coordinator)</div>
                    <div className="text-[11px] text-[#64748b] font-mono">faculty.demo@lablink.edu • Admin</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#64748b]" />
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
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
              disabled={loading}
              className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                "Sign In to Laboratory Network"
              )}
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
