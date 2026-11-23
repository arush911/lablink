import { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const departmentId = searchParams.get("departmentId")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(
        `(e.name ILIKE $${paramIndex} OR e.model ILIKE $${paramIndex} OR e.manufacturer ILIKE $${paramIndex} OR e.asset_tag ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (departmentId && departmentId !== "all") {
      conditions.push(`d.id = $${paramIndex}`);
      params.push(departmentId);
      paramIndex++;
    }

    if (status && status !== "all") {
      conditions.push(`e.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        e.id,
        e.name,
        e.model,
        e.manufacturer,
        e.serial_number,
        e.asset_tag,
        e.status,
        e.requires_qualification,
        e.qualification_title,
        e.buffer_minutes,
        e.technical_specifications,
        e.created_at,
        l.id as laboratory_id,
        l.name as laboratory_name,
        l.room_location,
        l.cancellation_buffer_minutes,
        d.id as department_id,
        d.name as department_name,
        d.code as department_code,
        d.building,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ec.id,
                'name', ec.capability_name,
                'description', ec.description,
                'parameterRange', ec.parameter_range
              )
            )
            FROM equipment_capabilities ec
            WHERE ec.equipment_id = e.id
          ),
          '[]'::json
        ) as capabilities
      FROM equipment e
      JOIN laboratories l ON e.laboratory_id = l.id
      JOIN departments d ON l.department_id = d.id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN e.status = 'AVAILABLE' THEN 1
          WHEN e.status = 'IN_USE' THEN 2
          WHEN e.status = 'MAINTENANCE' THEN 3
          ELSE 4
        END,
        e.name ASC;
    `;

    const { rows } = await query(sql, params);

    // Also fetch available departments for filter dropdowns
    const deptRes = await query(
      "SELECT id, name, code, building FROM departments ORDER BY name ASC;"
    );

    return NextResponse.json({
      equipment: rows.map((r) => ({
        id: r.id,
        name: r.name,
        model: r.model,
        manufacturer: r.manufacturer,
        serialNumber: r.serial_number,
        assetTag: r.asset_tag,
        status: r.status,
        requiresQualification: r.requires_qualification,
        qualificationTitle: r.qualification_title,
        bufferMinutes: r.buffer_minutes,
        technicalSpecifications: r.technical_specifications,
        createdAt: r.created_at,
        laboratory: {
          id: r.laboratory_id,
          name: r.laboratory_name,
          roomLocation: r.room_location,
          cancellationBufferMinutes: r.cancellation_buffer_minutes,
        },
        department: {
          id: r.department_id,
          name: r.department_name,
          code: r.department_code,
          building: r.building,
        },
        capabilities: r.capabilities,
      })),
      departments: deptRes.rows.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        building: d.building,
      })),
      total: rows.length,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/equipment Error]:", error);
    return NextResponse.json(
      { error: "EQUIPMENT_FETCH_FAILED", message: error.message },
      { status: 500 }
    );
  }
}
