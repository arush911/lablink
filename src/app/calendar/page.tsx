"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Loader2,
  Calendar as CalendarIcon,
  User,
  ArrowRight,
} from "lucide-react";

interface CalendarDay {
  date: string;
  dayOfWeek: number;
  dayName: string;
  formatted: string;
  isToday: boolean;
}

interface CalendarBooking {
  id: string;
  referenceId: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  studentName: string;
  studentEmail: string;
  projectTitle: string;
  status: string;
}

interface CalendarInstrument {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  assetTag: string;
  status: string;
  bufferMinutes: number;
  roomLocation: string;
  laboratoryName: string;
  departmentName: string;
  bookings: CalendarBooking[];
}

export default function WeeklyCalendarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar State
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(now);
    mon.setDate(diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  });

  const [days, setDays] = useState<CalendarDay[]>([]);
  const [instruments, setInstruments] = useState<CalendarInstrument[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<{
    booking: CalendarBooking;
    instrument: CalendarInstrument;
  } | null>(null);

  // Fetch schedule
  const fetchCalendar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const startStr = currentWeekStart.toISOString().slice(0, 10);
      const res = await fetch(`/api/v1/schedule/calendar?startDate=${startStr}`);
      if (!res.ok) {
        throw new Error("Failed to load laboratory master calendar.");
      }
      const data = await res.json();
      setDays(data.week.days || []);
      setInstruments(data.instruments || []);
    } catch (err: any) {
      setError(err.message || "Failed to load schedule matrix.");
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const handleJumpToToday = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(now);
    mon.setDate(diff);
    mon.setHours(0, 0, 0, 0);
    setCurrentWeekStart(mon);
  };

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
                Master Scheduling Calendar
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
              className="px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded"
            >
              Weekly Schedule
            </button>
            <button
              onClick={() => router.push("/faculty/review")}
              className="px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50 rounded transition-colors"
            >
              Request Approvals
            </button>
            <button
              onClick={() => router.push("/requests")}
              className="px-3 py-1.5 text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50 rounded transition-colors"
            >
              My Requests
            </button>
          </nav>
        </div>

        {/* Live sync badge */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded border border-[#e2e8f0] text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="font-mono font-bold text-emerald-800 text-[11px] uppercase">Live Synced</span>
            <span className="text-[#64748b] font-mono text-[11px]">| 08:00 - 20:00 Operating Window</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 flex flex-col gap-5">
        {/* Date Navigator, Scroller & Action Strip */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Week Selector */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center bg-slate-100 rounded p-0.5 border border-[#e2e8f0]">
              <button
                onClick={handlePrevWeek}
                className="p-1.5 hover:bg-white text-[#64748b] rounded transition-colors"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-blue-700" />
                <span className="font-semibold text-xs text-[#0f172a]">
                  {days[0]?.formatted} – {days[6]?.formatted}
                </span>
              </div>
              <button
                onClick={handleNextWeek}
                className="p-1.5 hover:bg-white text-[#64748b] rounded transition-colors"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleJumpToToday}
              className="px-3 py-1.5 bg-slate-100 text-blue-700 font-semibold text-xs rounded hover:bg-slate-200 transition-colors"
            >
              Today
            </button>
          </div>

          {/* Status Legend Pills */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-white border border-[#cbd5e1]" />
              <span className="font-mono text-[10px] text-[#64748b] uppercase">Open Slot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
              <span className="font-mono text-[10px] text-[#0f172a] font-semibold uppercase">Confirmed Run</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
              <span className="font-mono text-[10px] text-amber-800 font-semibold uppercase">Prep Buffer</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-500" />
              <span className="font-mono text-[10px] text-red-800 font-semibold uppercase">Maintenance</span>
            </div>
          </div>
        </div>

        {/* AI Optimization Notice Strip */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs border-l-4 border-l-indigo-600 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase text-indigo-700 font-bold tracking-wider">
                  AI Multi-Objective Scheduling Core
                </span>
                <span className="px-2 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono text-[9px] font-semibold">
                  Zero Double-Booking Guarantee
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-0.5">
                All confirmed allocations are backed by atomic PostgreSQL GiST exclusion locks. Idle gaps are
                automatically penalized to maximize laboratory equipment availability.
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/faculty/review")}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-blue-700 text-white rounded text-xs font-semibold hover:bg-blue-800 transition-colors shrink-0"
          >
            Review Pending Dockets
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Calendar Work Area */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-2xs overflow-hidden">
          {/* Day Header Row */}
          <div className="grid grid-cols-12 bg-slate-100 border-b border-[#e2e8f0] text-xs font-semibold">
            <div className="col-span-12 md:col-span-3 p-3.5 bg-slate-200/70 border-r border-[#e2e8f0] flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase text-[#0f172a]">Core Instrumentation</span>
              <span className="font-mono text-[10px] text-[#64748b]">{instruments.length} Instruments</span>
            </div>

            <div className="hidden md:grid md:col-span-9 grid-cols-7 text-center divide-x divide-[#e2e8f0]">
              {days.map((day) => (
                <div
                  key={day.date}
                  className={`py-2 px-1 flex flex-col items-center ${
                    day.isToday ? "bg-blue-50 text-blue-700" : "text-[#0f172a]"
                  }`}
                >
                  <span className="text-[10px] uppercase text-[#64748b] font-mono">{day.dayName}</span>
                  <span className={`text-xs font-bold ${day.isToday ? "text-blue-700" : ""}`}>
                    {day.formatted}
                  </span>
                  {day.isToday && (
                    <span className="font-mono text-[8px] bg-blue-700 text-white px-1.5 rounded-full uppercase mt-0.5">
                      Today
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Time Axis Sub-Header */}
          <div className="hidden md:grid grid-cols-12 bg-slate-50 border-b border-[#e2e8f0] font-mono text-[10px] text-[#64748b]">
            <div className="col-span-3 px-3 py-1 uppercase border-r border-[#e2e8f0]">
              Hours: 08:00 – 20:00
            </div>
            <div className="col-span-9 grid grid-cols-7 divide-x divide-[#e2e8f0]">
              {days.map((day) => (
                <div key={day.date} className="flex justify-between px-2 py-1 text-[9px]">
                  <span>08h</span>
                  <span>12h</span>
                  <span>16h</span>
                  <span>20h</span>
                </div>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
              <span className="font-mono text-xs text-[#64748b]">Loading Master Calendar Grid...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-8 text-center text-xs text-red-600 bg-red-50">{error}</div>
          )}

          {/* Swimlanes */}
          {!loading && !error && instruments.length > 0 && (
            <div className="divide-y divide-[#e2e8f0]">
              {instruments.map((item) => {
                const isOnline = item.status === "AVAILABLE" || item.status === "IN_USE";

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 min-h-[96px] hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Left Instrument Anchor Card */}
                    <div className="col-span-12 md:col-span-3 p-3.5 bg-white border-b md:border-b-0 md:border-r border-[#e2e8f0] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOnline ? "bg-emerald-600" : "bg-red-600"
                            }`}
                          />
                          <span
                            className={`font-mono text-[10px] uppercase font-bold ${
                              isOnline ? "text-emerald-800" : "text-red-800"
                            }`}
                          >
                            {item.status}
                          </span>
                          <span className="font-mono text-[10px] text-[#64748b]">• {item.roomLocation}</span>
                        </div>
                        <h4 className="font-bold text-xs text-[#0f172a] line-clamp-1">{item.name}</h4>
                        <span className="text-[10px] text-[#64748b] block">{item.model}</span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="font-mono text-[#64748b] bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.assetTag}
                        </span>
                        <span className="font-mono text-blue-700 font-semibold">
                          {item.bufferMinutes}m buffer
                        </span>
                      </div>
                    </div>

                    {/* 7 Days Grid Cells */}
                    <div className="col-span-12 md:col-span-9 grid grid-cols-7 divide-x divide-[#e2e8f0]">
                      {days.map((day) => {
                        // Find bookings on this instrument for this day
                        const dayBookings = item.bookings.filter((b) => {
                          const bDate = b.startTime.slice(0, 10);
                          return bDate === day.date;
                        });

                        return (
                          <div
                            key={day.date}
                            className={`p-1.5 flex flex-col gap-1 min-h-[96px] ${
                              day.isToday ? "bg-blue-50/20" : ""
                            }`}
                          >
                            {dayBookings.length === 0 ? (
                              <div className="w-full h-full rounded border border-dashed border-[#e2e8f0] flex items-center justify-center p-1 opacity-60 hover:opacity-100 transition-opacity">
                                <span className="font-mono text-[9px] text-[#94a3b8]">Open</span>
                              </div>
                            ) : (
                              dayBookings.map((b) => {
                                const startH = new Date(b.startTime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });
                                const endH = new Date(b.endTime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });

                                return (
                                  <button
                                    key={b.id}
                                    type="button"
                                    onClick={() =>
                                      setSelectedBooking({
                                        booking: b,
                                        instrument: item,
                                      })
                                    }
                                    className="w-full p-2 rounded bg-blue-700 text-white text-left shadow-2xs hover:bg-blue-800 transition-colors"
                                  >
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="font-mono text-[9px] font-bold truncate">
                                        {b.referenceId}
                                      </span>
                                      <span className="font-mono text-[8px] bg-blue-900/60 px-1 rounded">
                                        {b.durationHours}h
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-bold block truncate leading-tight">
                                      {b.studentName}
                                    </span>
                                    <span className="font-mono text-[9px] text-blue-200 block mt-0.5 truncate">
                                      {startH}–{endH}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Booking Detail Inspection Modal */}
        {selectedBooking && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-start justify-between border-b border-[#f1f5f9] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                      {selectedBooking.booking.referenceId}
                    </span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded">
                      CONFIRMED
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-[#0f172a] mt-1.5">
                    {selectedBooking.instrument.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="p-1 rounded text-[#64748b] hover:text-[#0f172a] hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded border border-[#e2e8f0] text-xs">
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#64748b] block">Time Window</span>
                  <span className="font-mono font-bold text-blue-700 block mt-0.5">
                    {new Date(selectedBooking.booking.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {new Date(selectedBooking.booking.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-[11px] text-[#64748b]">
                    {new Date(selectedBooking.booking.startTime).toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#64748b] block">Duration</span>
                  <span className="font-mono font-bold text-[#0f172a] block mt-0.5">
                    {selectedBooking.booking.durationHours} hours
                  </span>
                  <span className="text-[11px] text-[#64748b]">{selectedBooking.instrument.roomLocation}</span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <span className="font-mono text-[10px] uppercase text-[#64748b] block">Student Researcher</span>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-700" />
                  <span className="font-semibold text-[#0f172a]">{selectedBooking.booking.studentName}</span>
                  <span className="text-[#64748b]">({selectedBooking.booking.studentEmail})</span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <span className="font-mono text-[10px] uppercase text-[#64748b] block">Project Specification</span>
                <p className="text-[#475569] leading-relaxed italic bg-slate-50 p-2.5 rounded border border-[#e2e8f0]">
                  “{selectedBooking.booking.projectTitle}”
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="px-4 py-2 bg-slate-100 text-[#0f172a] rounded text-xs font-semibold hover:bg-slate-200"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
