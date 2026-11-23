import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/guard";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    // 1. Authoritative server-side identity check
    const currentUser = await requireAuth(req);

    // 2. Query strictly student's own requests (Zero Information Leakage Guarantee)
    const sql = `
      SELECT 
        br.id, 
        br.docket_number, 
        br.status, 
        br.requested_duration_hours,
        br.project_deadline, 
        br.preferred_window_start, 
        br.preferred_window_end,
        br.rejection_reason, 
        br.created_at, 
        br.updated_at,
        pd.project_title, 
        pd.abstract, 
        pd.course_code, 
        pd.grant_code, 
        pd.hazardous_materials_declared,
        e.id as equipment_id, 
        e.name as equipment_name, 
        e.model as equipment_model, 
        e.asset_tag,
        l.name as laboratory_name, 
        l.room_location,
        l.cancellation_buffer_minutes,
        b.id as booking_id,
        b.reference_id as booking_reference,
        b.start_time as booking_start,
        b.end_time as booking_end,
        b.status as booking_status
      FROM booking_requests br
      JOIN project_details pd ON pd.booking_request_id = br.id
      JOIN equipment e ON br.equipment_id = e.id
      JOIN laboratories l ON e.laboratory_id = l.id
      LEFT JOIN bookings b ON b.booking_request_id = br.id AND b.status = 'CONFIRMED'
      WHERE br.student_id = $1
      ORDER BY br.created_at DESC;
    `;

    const { rows } = await query(sql, [currentUser.id]);

    return NextResponse.json({
      student: {
        id: currentUser.id,
        fullName: currentUser.full_name,
        email: currentUser.email,
        monthlyQuotaHours: currentUser.monthly_quota_hours,
        usedQuotaHours: currentUser.used_quota_hours,
      },
      requests: rows.map((r) => ({
        id: r.id,
        docketNumber: r.docket_number,
        status: r.status,
        requestedDurationHours: Number(r.requested_duration_hours),
        projectDeadline: r.project_deadline,
        preferredWindowStart: r.preferred_window_start,
        preferredWindowEnd: r.preferred_window_end,
        rejectionReason: r.rejection_reason,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        project: {
          title: r.project_title,
          abstract: r.abstract,
          courseCode: r.course_code,
          grantCode: r.grant_code,
          hazardousMaterialsDeclared: r.hazardous_materials_declared,
        },
        equipment: {
          id: r.equipment_id,
          name: r.equipment_name,
          model: r.equipment_model,
          assetTag: r.asset_tag,
          laboratoryName: r.laboratory_name,
          roomLocation: r.room_location,
          cancellationBufferMinutes: r.cancellation_buffer_minutes,
        },
        confirmedBooking: r.booking_id
          ? {
              id: r.booking_id,
              referenceId: r.booking_reference,
              startTime: r.booking_start,
              endTime: r.booking_end,
              status: r.booking_status,
            }
          : null,
      })),
      total: rows.length,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error("[GET /api/v1/requests/me Error]:", error);
    return NextResponse.json(
      { error: "REQUESTS_FETCH_FAILED", message: error.message },
      { status: 500 }
    );
  }
}
