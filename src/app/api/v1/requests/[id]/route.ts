import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/guard";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await requireAuth(req);

    const reqRes = await query(
      `SELECT 
        br.id, br.docket_number, br.status, br.requested_duration_hours,
        br.project_deadline, br.preferred_window_start, br.preferred_window_end,
        br.rejection_reason, br.created_at, br.updated_at,
        pd.project_title, pd.abstract, pd.course_code, pd.grant_code,
        pd.hazardous_materials_declared, pd.safety_notes,
        e.id as equipment_id, e.name as equipment_name, e.model as equipment_model,
        e.manufacturer as equipment_manufacturer, e.asset_tag, e.buffer_minutes,
        e.technical_specifications, e.status as equipment_status,
        l.id as lab_id, l.name as laboratory_name, l.room_location,
        u.id as student_id, u.full_name as student_name, u.email as student_email,
        u.monthly_quota_hours as student_quota_hours, u.used_quota_hours as student_used_quota_hours,
        b.id as booking_id, b.reference_id as booking_reference_id,
        b.start_time as booking_start_time, b.end_time as booking_end_time,
        b.status as booking_status
       FROM booking_requests br
       JOIN project_details pd ON pd.booking_request_id = br.id
       JOIN equipment e ON br.equipment_id = e.id
       JOIN laboratories l ON e.laboratory_id = l.id
       JOIN users u ON br.student_id = u.id
       LEFT JOIN bookings b ON b.booking_request_id = br.id AND b.status = 'CONFIRMED'
       WHERE br.id = $1`,
      [id]
    );

    if (reqRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Booking request docket not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const row = reqRes.rows[0];

    // Ownership check: Student can only view their own request
    if (currentUser.role === "student" && currentUser.id !== row.student_id) {
      return NextResponse.json(
        { error: "Forbidden: You cannot inspect another student's docket", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Fetch audit logs for this request
    const auditRes = await query(
      `SELECT al.id, al.action, al.reason_or_justification, al.created_at,
              u.full_name as actor_name, u.email as actor_email, u.role as actor_role
       FROM booking_audit_logs al
       JOIN users u ON al.actor_id = u.id
       WHERE al.request_id = $1
       ORDER BY al.created_at ASC`,
      [id]
    );

    return NextResponse.json({
      success: true,
      request: {
        id: row.id,
        docketNumber: row.docket_number,
        status: row.status,
        requestedDurationHours: Number(row.requested_duration_hours),
        projectDeadline: row.project_deadline,
        preferredWindowStart: row.preferred_window_start,
        preferredWindowEnd: row.preferred_window_end,
        rejectionReason: row.rejection_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        project: {
          title: row.project_title,
          abstract: row.abstract,
          courseCode: row.course_code,
          grantCode: row.grant_code,
          hazardousMaterialsDeclared: row.hazardous_materials_declared,
          safetyNotes: row.safety_notes,
        },
        equipment: {
          id: row.equipment_id,
          name: row.equipment_name,
          model: row.equipment_model,
          manufacturer: row.equipment_manufacturer,
          assetTag: row.asset_tag,
          bufferMinutes: row.buffer_minutes,
          status: row.equipment_status,
          technicalSpecifications: row.technical_specifications,
          laboratory: {
            id: row.lab_id,
            name: row.laboratory_name,
            roomLocation: row.room_location,
          },
        },
        student: {
          id: row.student_id,
          name: row.student_name,
          email: row.student_email,
          quotaHours: Number(row.student_quota_hours),
          usedQuotaHours: Number(row.student_used_quota_hours),
        },
        confirmedBooking: row.booking_id
          ? {
              id: row.booking_id,
              referenceId: row.booking_reference_id,
              startTime: row.booking_start_time,
              endTime: row.booking_end_time,
              status: row.booking_status,
            }
          : null,
        auditLogs: auditRes.rows.map((a: any) => ({
          id: a.id,
          action: a.action,
          reason: a.reason_or_justification,
          actor: a.actor_name,
          actorRole: a.actor_role,
          createdAt: a.created_at,
        })),
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    console.error("GET /api/v1/requests/[id] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load request docket", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
