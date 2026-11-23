import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, AuthError } from "@/lib/auth/guard";
import { withTransaction } from "@/lib/db/pool";

export const runtime = "nodejs";

const BookingConfirmationSchema = z.object({
  requestId: z.string().uuid("Invalid request ID format"),
  startTime: z.string().datetime({ message: "Start time must be a valid ISO 8601 timestamp" }),
  endTime: z.string().datetime({ message: "End time must be a valid ISO 8601 timestamp" }),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  {
    message: "End time must be strictly after start time",
    path: ["endTime"],
  }
);

export async function POST(req: Request) {
  try {
    // Strictly restricted to faculty or laboratory coordinators
    const facultyUser = await requireAuth(req, ["faculty"]);

    const body = await req.json();
    const parsed = BookingConfirmationSchema.safeParse(body);

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

    const { requestId, startTime, endTime } = parsed.data;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const bookingDurationHours = Number(((end.getTime() - start.getTime()) / (1000 * 3600)).toFixed(2));

    if (bookingDurationHours < 0.5 || bookingDurationHours > 12.0) {
      return NextResponse.json(
        {
          error: "Booking duration must be between 30 minutes and 12 hours",
          code: "INVALID_DURATION",
        },
        { status: 400 }
      );
    }

    const result = await withTransaction(async (client) => {
      // 1. Lock and validate booking request docket
      const reqRes = await client.query(
        `SELECT id, docket_number, status, student_id, equipment_id,
                requested_duration_hours
         FROM booking_requests
         WHERE id = $1
         FOR UPDATE`,
        [requestId]
      );

      if (reqRes.rows.length === 0) {
        return { error: "Booking request docket not found", code: "NOT_FOUND", status: 404 };
      }

      const docket = reqRes.rows[0];

      if (docket.status === "BOOKED") {
        return {
          error: "This request has already been confirmed and booked onto the calendar.",
          code: "REQUEST_ALREADY_PROCESSED",
          status: 409,
        };
      }

      if (docket.status !== "APPROVED") {
        return {
          error: `Cannot confirm booking: Request must be in APPROVED status prior to slot confirmation (current status: ${docket.status}).`,
          code: "INVALID_REQUEST_STATE",
          status: 400,
        };
      }

      // 2. Lock student record and verify quota
      const userRes = await client.query(
        `SELECT id, full_name, email, role, monthly_quota_hours, used_quota_hours
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [docket.student_id]
      );

      if (userRes.rows.length === 0) {
        return { error: "Student account not found", code: "STUDENT_NOT_FOUND", status: 404 };
      }

      const student = userRes.rows[0];
      const quota = Number(student.monthly_quota_hours) || 25.0;
      const usedQuota = Number(student.used_quota_hours) || 0.0;
      const newUsedQuota = Number((usedQuota + bookingDurationHours).toFixed(2));

      if (newUsedQuota > quota) {
        return {
          error: `Student monthly quota limit reached: requested ${bookingDurationHours}h exceeds remaining balance (${(quota - usedQuota).toFixed(1)}h remaining of ${quota}h quota).`,
          code: "QUOTA_EXCEEDED",
          status: 409,
        };
      }

      // 3. Lock equipment record and verify operational status
      const eqRes = await client.query(
        `SELECT id, name, model, asset_tag, status, buffer_minutes
         FROM equipment
         WHERE id = $1
         FOR UPDATE`,
        [docket.equipment_id]
      );

      if (eqRes.rows.length === 0) {
        return { error: "Equipment not found", code: "EQUIPMENT_NOT_FOUND", status: 404 };
      }

      const equipment = eqRes.rows[0];
      if (equipment.status === "MAINTENANCE" || equipment.status === "OFFLINE") {
        return {
          error: `Target equipment ${equipment.name} is currently ${equipment.status} and cannot accept new bookings.`,
          code: "EQUIPMENT_UNAVAILABLE",
          status: 409,
        };
      }

      // 4. Generate deterministic Reference ID
      const datePart = start.toISOString().slice(0, 10).replace(/-/g, "");
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      const referenceId = `BKG-${datePart}-${randSuffix}`;

      // 5. Insert Confirmed Booking (Guarded by PostgreSQL GiST exclusion constraint)
      let bookingId: string;
      try {
        const bkgRes = await client.query(
          `INSERT INTO bookings (
             reference_id, equipment_id, student_id, confirmed_by_faculty_id,
             booking_request_id, start_time, end_time, status
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED')
           RETURNING id`,
          [
            referenceId,
            docket.equipment_id,
            docket.student_id,
            facultyUser.id,
            docket.id,
            start.toISOString(),
            end.toISOString(),
          ]
        );
        bookingId = bkgRes.rows[0].id;
      } catch (insertErr: any) {
        // Catch PostgreSQL GiST exclusion violation: SQLSTATE 23P01
        if (insertErr.code === "23P01") {
          return {
            error: "The requested time slot conflicts with an existing confirmed booking on this instrument.",
            code: "SLOT_DOUBLE_BOOKED",
            status: 409,
          };
        }
        throw insertErr;
      }

      // 6. Update booking_requests state to BOOKED
      await client.query(
        `UPDATE booking_requests
         SET status = 'BOOKED',
             faculty_id = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [facultyUser.id, docket.id]
      );

      // 7. Update student quota
      await client.query(
        `UPDATE users
         SET used_quota_hours = $1
         WHERE id = $2`,
        [newUsedQuota, docket.student_id]
      );

      // 8. Insert Immutable Audit Log
      await client.query(
        `INSERT INTO booking_audit_logs (
           booking_id, request_id, actor_id, action, reason_or_justification, state_snapshot
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          bookingId,
          docket.id,
          facultyUser.id,
          "BOOKING_CONFIRMED",
          `Confirmed slot [${start.toISOString()} - ${end.toISOString()}] on ${equipment.name} (${equipment.asset_tag})`,
          JSON.stringify({
            referenceId,
            equipmentId: equipment.id,
            studentId: student.id,
            durationHours: bookingDurationHours,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            previousQuota: usedQuota,
            updatedQuota: newUsedQuota,
          }),
        ]
      );

      // 9. Send Notification to Student
      await client.query(
        `INSERT INTO notifications (
           recipient_id, title, message, notification_type, reference_entity_id
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          docket.student_id,
          `Booking Confirmed: ${referenceId}`,
          `Your session on ${equipment.name} (${equipment.asset_tag}) has been confirmed for ${start.toUTCString()} to ${end.toUTCString()}. Reference: ${referenceId}`,
          "BOOKING_CONFIRMED",
          bookingId,
        ]
      );

      return {
        success: true,
        booking: {
          id: bookingId,
          referenceId,
          equipmentName: equipment.name,
          equipmentAssetTag: equipment.asset_tag,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          durationHours: bookingDurationHours,
          status: "CONFIRMED",
        },
        quota: {
          totalHours: quota,
          usedHours: newUsedQuota,
          remainingHours: Number((quota - newUsedQuota).toFixed(2)),
        },
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
    console.error("POST /api/v1/bookings/confirm error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to confirm booking", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
