import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, AuthError } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db/pool";

export const runtime = "nodejs";

const ReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    if (data.action === "REJECT" && (!data.rejectionReason || data.rejectionReason.trim().length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: "A rejection reason is mandatory when declining a project requisition.",
    path: ["rejectionReason"],
  }
);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Strictly restricted to faculty role
    const facultyUser = await requireAuth(req, ["faculty"]);

    const body = await req.json();
    const parsed = ReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { action, rejectionReason, notes } = parsed.data;

    const result = await withTransaction(async (client) => {
      // 1. Lock and check target request
      const reqRes = await client.query(
        `SELECT id, docket_number, status, student_id, equipment_id
         FROM booking_requests
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );

      if (reqRes.rows.length === 0) {
        return { error: "Docket not found", code: "NOT_FOUND", status: 404 };
      }

      const docket = reqRes.rows[0];

      if (docket.status === "BOOKED") {
        return {
          error: "Request is already confirmed and booked onto equipment calendar.",
          code: "ALREADY_BOOKED",
          status: 409,
        };
      }

      if (docket.status === "CANCELLED") {
        return {
          error: "Request was cancelled by the student and cannot be reviewed.",
          code: "REQUEST_CANCELLED",
          status: 409,
        };
      }

      const pRes = await client.query(
        `SELECT project_title FROM project_details WHERE booking_request_id = $1`,
        [id]
      );
      const projectTitle = pRes.rows[0]?.project_title || "laboratory equipment";

      const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
      const finalReason = action === "REJECT" ? rejectionReason : (notes || "Faculty sign-off approved.");

      // 2. Update booking_requests table
      await client.query(
        `UPDATE booking_requests
         SET status = $1,
             rejection_reason = $2,
             faculty_id = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [newStatus, action === "REJECT" ? rejectionReason : null, facultyUser.id, id]
      );

      // 3. Write Immutable Audit Trail
      await client.query(
        `INSERT INTO booking_audit_logs (
           request_id, actor_id, action, reason_or_justification, state_snapshot
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          facultyUser.id,
          action === "APPROVE" ? "FACULTY_APPROVAL" : "FACULTY_REJECTION",
          finalReason,
          JSON.stringify({
            previousStatus: docket.status,
            newStatus,
            reviewedBy: facultyUser.email,
            docketNumber: docket.docket_number,
          }),
        ]
      );

      // 4. Create Notification for Student
      await client.query(
        `INSERT INTO notifications (
           recipient_id, title, message, notification_type, reference_entity_id
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          docket.student_id,
          action === "APPROVE" ? `Request Approved: ${docket.docket_number}` : `Request Declined: ${docket.docket_number}`,
          action === "APPROVE"
            ? `Your requisition for ${projectTitle} has been approved by ${facultyUser.full_name}. A slot recommendation is now eligible for confirmation.`
            : `Your requisition for ${projectTitle} was declined: ${rejectionReason}`,
          action === "APPROVE" ? "REQUEST_APPROVED" : "REQUEST_REJECTED",
          id,
        ]
      );

      return {
        success: true,
        docketNumber: docket.docket_number,
        newStatus,
        reviewedBy: facultyUser.email,
      };
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    console.error("PATCH /api/v1/requests/[id]/review error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process faculty review", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
