import { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET() {
  try {
    const dbRes = await query("SELECT NOW() as current_time, current_database() as database_name;");
    const gistRes = await query(
      "SELECT conname FROM pg_constraint WHERE conname = 'no_overlapping_confirmed_bookings';"
    );

    return NextResponse.json({
      status: "healthy",
      timestamp: dbRes.rows[0].current_time,
      database: dbRes.rows[0].database_name,
      gistConstraintActive: gistRes.rows.length > 0,
      service: "LabLink API 2026",
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "unhealthy", error: error.message },
      { status: 503 }
    );
  }
}
