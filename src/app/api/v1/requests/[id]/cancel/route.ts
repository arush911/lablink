import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await requireAuth(req);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Optional body
    }

    const cancelReason = body.reason || "Cancelled by user request";

    const result = await withTransaction(async (client) => {
      // 1. Lock and check target request
      const reqRes = await client.query(
        `SELECT br.id, br.student_id, br.equipment_id, br.status, br.requested_duration_hours,
                l.cancellation_buffer_minutes
         FROM booking_requests br
         JOIN equipment e ON br.equipment_id = e.id
         JOIN laboratories l ON e.laboratory_id = l.id
         WHERE br.id = $1
         FOR UPDATE`,
        [id]
      );

      if (reqRes.rows.length === 0) {
        throw new AuthError("Request docket not found", 404, "NOT_FOUND");
      }

      const docket = reqRes.rows[0];

      // Ownership enforcement: Students can only cancel their own requests
      if (currentUser.role === "student" && docket.student_id !== currentUser.id) {
        throw new AuthError("You are not authorized to cancel this request docket", 403, "FORBIDDEN");
      }

      if (docket.status === "CANCELLED") {
        throw new AuthError("This request docket has already been cancelled", 400, "ALREADY_CANCELLED");
      }

      // If already booked, check if there's an active booking and cancel it
      if (docket.status === "BOOKED") {
        const bookingRes = await client.query(
          `SELECT id, start_time, status FROM bookings 
           WHERE booking_request_id = $1 AND status = 'CONFIRMED'
           FOR UPDATE`,
          [id]
        );

        if (bookingRes.rows.length > 0) {
          const booking = bookingRes.rows[0];
          const startTime = new Date(booking.start_time).getTime();
          const now = Date.now();
          const bufferMs = (docket.cancellation_buffer_minutes || 120) * 60 * 1000;

          // If student, check cancellation buffer policy
          if (currentUser.role === "student" && startTime - now < bufferMs) {
            throw new AuthError(
              `Cancellation prohibited within the ${docket.cancellation_buffer_minutes}-minute laboratory turnaround window.`,
              400,
              "CANCELLATION_WINDOW_EXPIRED"
            );
          }

          // Cancel the confirmed booking
          await client.query(
            `UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`,
            [booking.id]
          );

          // Refund student used quota
          await client.query(
            `UPDATE users 
             SET used_quota_hours = GREATEST(0.0, used_quota_hours - $1)
             WHERE id = $2`,
            [docket.requested_duration_hours, docket.student_id]
          );
        }
      }

      // Transition docket to CANCELLED
      await client.query(
        `UPDATE booking_requests 
         SET status = 'CANCELLED', updated_at = NOW() 
         WHERE id = $1`,
        [id]
      );

      // Audit log entry
      await client.query(
        `INSERT INTO booking_audit_logs (
          request_id, actor_id, action, reason_or_justification, state_snapshot
        ) VALUES ($1, $2, 'CANCELLED', $3, $4)`,
        [
          id,
          currentUser.id,
          cancelReason,
          JSON.stringify({ cancelledBy: currentUser.role, userId: currentUser.id }),
        ]
      );

      return { id, status: "CANCELLED" };
    });

    return NextResponse.json({
      message: "Request docket cancelled successfully.",
      docket: result,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error("[POST /api/v1/requests/:id/cancel Error]:", error);
    return NextResponse.json(
      { error: "CANCEL_FAILED", message: error.message || "Failed to cancel request docket" },
      { status: 500 }
    );
  }
}
