import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        monthlyQuotaHours: user.monthly_quota_hours,
        usedQuotaHours: user.used_quota_hours,
        departmentId: user.department_id,
        isActive: user.is_active,
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "INTERNAL_ERROR", message: error.message }, { status: 500 });
  }
}
