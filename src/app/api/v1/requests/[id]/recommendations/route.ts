import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/guard";
import { query } from "@/lib/db/pool";
import { generateCandidateSlots } from "@/lib/scheduling/candidate-slots";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await requireAuth(req);

    // Fetch the target request
    const reqRes = await query(
      `SELECT r.id, r.docket_number, r.student_id, r.equipment_id, r.faculty_id,
              r.status, r.requested_duration_hours, r.project_deadline,
              r.preferred_window_start, r.preferred_window_end,
              p.project_title, p.abstract
       FROM booking_requests r
       LEFT JOIN project_details p ON r.id = p.booking_request_id
       WHERE r.id = $1`,
      [id]
    );

    if (reqRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Booking request docket not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const docket = reqRes.rows[0];

    // Authorization: Must be faculty or the requesting student
    if (currentUser.role !== "faculty" && currentUser.id !== docket.student_id) {
      return NextResponse.json(
        { error: "Unauthorized access to request scheduling data", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Generate candidate slots
    const recommendations = await generateCandidateSlots({
      requestId: docket.id,
      equipmentId: docket.equipment_id,
      requestedDurationHours: Number(docket.requested_duration_hours),
      preferredStart: docket.preferred_window_start,
      preferredEnd: docket.preferred_window_end,
      projectDeadline: docket.project_deadline,
    });

    return NextResponse.json({
      success: true,
      docket: {
        id: docket.id,
        docketNumber: docket.docket_number,
        status: docket.status,
        projectTitle: docket.project_title,
      },
      ...recommendations,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    console.error("GET /api/v1/requests/[id]/recommendations error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate scheduling recommendations", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
