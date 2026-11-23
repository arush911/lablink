import { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
        ) as capabilities,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'dayOfWeek', loh.day_of_week,
                'openTime', loh.open_time,
                'closeTime', loh.close_time,
                'isClosed', loh.is_closed
              )
              ORDER BY loh.day_of_week ASC
            )
            FROM laboratory_operating_hours loh
            WHERE loh.laboratory_id = l.id
          ),
          '[]'::json
        ) as operating_hours
      FROM equipment e
      JOIN laboratories l ON e.laboratory_id = l.id
      JOIN departments d ON l.department_id = d.id
      WHERE e.id = $1;
    `;

    const { rows } = await query(sql, [id]);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "EQUIPMENT_NOT_FOUND", message: `No instrument found with ID ${id}` },
        { status: 404 }
      );
    }

    const r = rows[0];

    return NextResponse.json({
      equipment: {
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
          operatingHours: r.operating_hours,
        },
        department: {
          id: r.department_id,
          name: r.department_name,
          code: r.department_code,
          building: r.building,
        },
        capabilities: r.capabilities,
      },
    });
  } catch (error: any) {
    console.error("[GET /api/v1/equipment/:id Error]:", error);
    return NextResponse.json(
      { error: "EQUIPMENT_FETCH_FAILED", message: error.message },
      { status: 500 }
    );
  }
}
