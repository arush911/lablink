import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, AuthError } from "@/lib/auth/guard";
import { query, withTransaction } from "@/lib/db/pool";

export const runtime = "nodejs";

const createRequestSchema = z.object({
  equipmentId: z.string().uuid("Invalid equipment ID format"),
  projectTitle: z.string().min(3, "Project title must be at least 3 characters").max(255),
  abstract: z.string().min(10, "Abstract must be at least 10 characters"),
  requestedDurationHours: z
    .number()
    .min(0.5, "Minimum session duration is 30 minutes (0.5h)")
    .max(12.0, "Maximum single session duration is 12 hours"),
  projectDeadline: z.string().optional().nullable(),
  preferredWindowStart: z.string().optional().nullable(),
  preferredWindowEnd: z.string().optional().nullable(),
  courseCode: z.string().max(50).optional().nullable(),
  grantCode: z.string().max(100).optional().nullable(),
  hazardousMaterialsDeclared: z.boolean().default(false),
  safetyNotes: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    // 1. Authoritative server-side authentication (student or faculty)
    const currentUser = await requireAuth(req, ["student", "faculty"]);

    // 2. Strict Zod schema validation
    const rawBody = await req.json();
    const validated = createRequestSchema.parse(rawBody);

    // 3. Verify target equipment existence & operational status
    const eqRes = await query(
      `SELECT e.id, e.name, e.status, l.coordinator_id, l.name as lab_name
       FROM equipment e
       JOIN laboratories l ON e.laboratory_id = l.id
       WHERE e.id = $1`,
      [validated.equipmentId]
    );

    if (eqRes.rows.length === 0) {
      return NextResponse.json(
        { error: "EQUIPMENT_NOT_FOUND", message: "Target equipment does not exist" },
        { status: 404 }
      );
    }

    const equipment = eqRes.rows[0];

    if (equipment.status === "MAINTENANCE" || equipment.status === "OFFLINE") {
      return NextResponse.json(
        {
          error: "EQUIPMENT_UNAVAILABLE",
          message: `The selected instrument (${equipment.name}) is currently ${equipment.status} and cannot be requested.`,
        },
        { status: 400 }
      );
    }

    // 4. Resolve supervising faculty / coordinator
    let facultyId = equipment.coordinator_id;
    if (!facultyId) {
      const defaultFacultyRes = await query(
        "SELECT id FROM users WHERE role = 'faculty' LIMIT 1"
      );
      facultyId = defaultFacultyRes.rows[0]?.id;
    }

    // 5. Generate human-readable docket number
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const docketNumber = `DOCK-2026-${randomSuffix}`;

    // 6. Execute atomic insertion inside transaction
    const result = await withTransaction(async (client) => {
      // Insert booking request
      const reqInsert = await client.query(
        `INSERT INTO booking_requests (
          docket_number, student_id, equipment_id, faculty_id, status, 
          requested_duration_hours, project_deadline, preferred_window_start, preferred_window_end
        ) VALUES ($1, $2, $3, $4, 'PENDING_REVIEW', $5, $6, $7, $8)
        RETURNING id, docket_number, status, requested_duration_hours, project_deadline, created_at`,
        [
          docketNumber,
          currentUser.id, // Strictly derived from authenticated server session
          validated.equipmentId,
          facultyId,
          validated.requestedDurationHours,
          validated.projectDeadline || null,
          validated.preferredWindowStart || null,
          validated.preferredWindowEnd || null,
        ]
      );

      const newRequest = reqInsert.rows[0];

      // Insert project details
      await client.query(
        `INSERT INTO project_details (
          booking_request_id, project_title, abstract, course_code, 
          grant_code, hazardous_materials_declared, safety_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newRequest.id,
          validated.projectTitle,
          validated.abstract,
          validated.courseCode || null,
          validated.grantCode || null,
          validated.hazardousMaterialsDeclared,
          validated.safetyNotes || null,
        ]
      );

      // Insert audit log entry
      await client.query(
        `INSERT INTO booking_audit_logs (
          request_id, actor_id, action, reason_or_justification, state_snapshot
        ) VALUES ($1, $2, 'SUBMITTED', 'Project access request submitted by student', $3)`,
        [
          newRequest.id,
          currentUser.id,
          JSON.stringify({
            docketNumber,
            equipmentId: validated.equipmentId,
            equipmentName: equipment.name,
            projectTitle: validated.projectTitle,
            duration: validated.requestedDurationHours,
          }),
        ]
      );

      return newRequest;
    });

    return NextResponse.json(
      {
        message: "Project access request docket created successfully.",
        request: {
          id: result.id,
          docketNumber: result.docket_number,
          status: result.status,
          requestedDurationHours: result.requested_duration_hours,
          projectDeadline: result.project_deadline,
          createdAt: result.created_at,
          equipment: {
            id: equipment.id,
            name: equipment.name,
            laboratory: equipment.lab_name,
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: "Request validation failed. Please check the input fields.",
          issues: error.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
        },
        { status: 422 }
      );
    }

    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }

    console.error("[POST /api/v1/requests Error]:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error.message || "Failed to submit request docket" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const currentUser = await requireAuth(req);

    // If student, filter strictly by their own ID (ownership isolation)
    // If faculty, allow inspecting all requests or by status
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let sql = `
      SELECT 
        br.id, br.docket_number, br.status, br.requested_duration_hours,
        br.project_deadline, br.preferred_window_start, br.preferred_window_end,
        br.rejection_reason, br.created_at, br.updated_at,
        pd.project_title, pd.abstract, pd.course_code, pd.grant_code, pd.hazardous_materials_declared,
        e.id as equipment_id, e.name as equipment_name, e.model as equipment_model, e.asset_tag,
        l.name as laboratory_name, l.room_location,
        u.id as student_id, u.full_name as student_name, u.email as student_email
      FROM booking_requests br
      JOIN project_details pd ON pd.booking_request_id = br.id
      JOIN equipment e ON br.equipment_id = e.id
      JOIN laboratories l ON e.laboratory_id = l.id
      JOIN users u ON br.student_id = u.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (currentUser.role === "student") {
      conditions.push(`br.student_id = $${paramIndex}`);
      params.push(currentUser.id);
      paramIndex++;
    }

    if (status && status !== "all") {
      conditions.push(`br.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += ` ORDER BY br.created_at DESC;`;

    const { rows } = await query(sql, params);

    return NextResponse.json({
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
        },
        student: {
          id: r.student_id,
          name: r.student_name,
          email: r.student_email,
        },
      })),
      total: rows.length,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "INTERNAL_ERROR", message: error.message }, { status: 500 });
  }
}
