import { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const departmentId = searchParams.get("departmentId");

    // 1. Calculate Monday of the target week
    let weekStart: Date;
    if (startDateParam) {
      weekStart = new Date(startDateParam);
    } else {
      weekStart = new Date();
      // Set to Monday of current week
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
    }
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Days array
    const days = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        dayOfWeek: d.getDay(),
        dayName: dayNames[i],
        formatted: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        isToday: dateStr === todayStr,
      });
    }

    // 2. Fetch instruments
    let eqSql = `
      SELECT e.id, e.name, e.model, e.manufacturer, e.asset_tag, e.status, e.buffer_minutes,
             l.name as lab_name, l.room_location, d.name as department_name, d.id as department_id
      FROM equipment e
      JOIN laboratories l ON e.laboratory_id = l.id
      JOIN departments d ON l.department_id = d.id
    `;
    const eqParams: any[] = [];
    if (departmentId && departmentId !== "all") {
      eqSql += ` WHERE d.id = $1`;
      eqParams.push(departmentId);
    }
    eqSql += ` ORDER BY e.name ASC`;

    const eqRes = await query(eqSql, eqParams);

    // 3. Fetch confirmed bookings in this week window
    const bkgRes = await query(
      `SELECT b.id, b.reference_id, b.equipment_id, b.start_time, b.end_time, b.status,
              u.full_name as student_name, u.email as student_email,
              pd.project_title, pd.abstract
       FROM bookings b
       JOIN users u ON b.student_id = u.id
       JOIN booking_requests br ON b.booking_request_id = br.id
       LEFT JOIN project_details pd ON br.id = pd.booking_request_id
       WHERE b.status = 'CONFIRMED'
         AND b.end_time > $1
         AND b.start_time < $2
       ORDER BY b.start_time ASC`,
      [weekStart.toISOString(), weekEnd.toISOString()]
    );

    // Group bookings by equipment_id
    const bookingsByEquipment: Record<string, any[]> = {};
    for (const b of bkgRes.rows) {
      if (!bookingsByEquipment[b.equipment_id]) {
        bookingsByEquipment[b.equipment_id] = [];
      }
      const s = new Date(b.start_time);
      const e = new Date(b.end_time);
      const durationHours = Number(((e.getTime() - s.getTime()) / (1000 * 3600)).toFixed(2));

      bookingsByEquipment[b.equipment_id].push({
        id: b.id,
        referenceId: b.reference_id,
        startTime: b.start_time,
        endTime: b.end_time,
        durationHours,
        studentName: b.student_name,
        studentEmail: b.student_email,
        projectTitle: b.project_title || "Laboratory Experiment",
        status: b.status,
      });
    }

    // 4. Build instrument list with their weekly schedule
    const instruments = eqRes.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      model: row.model,
      manufacturer: row.manufacturer,
      assetTag: row.asset_tag,
      status: row.status,
      bufferMinutes: row.buffer_minutes,
      roomLocation: row.room_location,
      laboratoryName: row.lab_name,
      departmentName: row.department_name,
      bookings: bookingsByEquipment[row.id] || [],
    }));

    return NextResponse.json({
      success: true,
      week: {
        startDate: weekStart.toISOString().slice(0, 10),
        endDate: weekEnd.toISOString().slice(0, 10),
        days,
      },
      operatingHours: {
        openTime: "08:00:00",
        closeTime: "20:00:00",
      },
      totalInstruments: instruments.length,
      totalConfirmedSessions: bkgRes.rows.length,
      instruments,
    });
  } catch (err: any) {
    console.error("GET /api/v1/schedule/calendar error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load master calendar matrix", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
