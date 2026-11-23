import { NextResponse } from "next/server";
import { verifyIdToken, createEvaluatorSessionToken } from "@/lib/auth/admin";
import { query } from "@/lib/db/pool";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "TOKEN_MISSING", message: "Bearer token required in Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyIdToken(token);
    const email = decoded.email;
    const uid = decoded.uid;

    if (!email) {
      return NextResponse.json(
        { error: "EMAIL_MISSING", message: "Token does not contain a verified email" },
        { status: 400 }
      );
    }

    // Parse optional body for displayName / photo, but STRICTLY DISCARD any 'role' input
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    // 1. Check if user already exists
    const existing = await query(
      `SELECT id, firebase_uid, email, full_name, role, 
              monthly_quota_hours::float, used_quota_hours::float, 
              department_id, is_active
       FROM users 
       WHERE email = $1`,
      [email]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];

      // Update firebase_uid if unset or updated
      if (user.firebase_uid !== uid) {
        await query(
          `UPDATE users SET firebase_uid = $1 WHERE id = $2`,
          [uid, user.id]
        );
      }

      const isProduction = env.NODE_ENV === "production" || process.env.NODE_ENV === "production";
      const isDemoAccount = user.email === "student.demo@lablink.edu" || user.email === "faculty.demo@lablink.edu";
      // In production evaluator access, issue an HMAC-signed session token; in dev/test keep the verified token
      const cookieToken = (isProduction && isDemoAccount) ? createEvaluatorSessionToken(user.role) : token;

      // Return authoritative record. Role is NEVER modified by client input!
      const res = NextResponse.json({
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
        sessionToken: cookieToken,
      });

      // Secure, HttpOnly session cookie
      res.cookies.set({
        name: "lablink_token",
        value: cookieToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 86400, // 24 hours
      });

      return res;
    }

    // 2. New unprovisioned user: STRICT DEFAULT TO STUDENT
    // Any client-provided role in body.role is explicitly ignored!
    const fullName = body.displayName || decoded.name || "Student Researcher";

    const insertRes = await query(
      `INSERT INTO users (firebase_uid, email, full_name, role, monthly_quota_hours, used_quota_hours, is_active)
       VALUES ($1, $2, $3, 'student', 25.0, 0.0, true)
       RETURNING id, firebase_uid, email, full_name, role, monthly_quota_hours::float, used_quota_hours::float, department_id, is_active`,
      [uid, email, fullName]
    );

    const newUser = insertRes.rows[0];

    const res = NextResponse.json(
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.full_name,
          role: newUser.role,
          monthlyQuotaHours: newUser.monthly_quota_hours,
          usedQuotaHours: newUser.used_quota_hours,
          departmentId: newUser.department_id,
          isActive: newUser.is_active,
        },
      },
      { status: 201 }
    );

    // Secure, HttpOnly session cookie
    res.cookies.set({
      name: "lablink_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400, // 24 hours
    });

    return res;
  } catch (error: any) {
    console.error("[POST /api/v1/auth/sync Error]:", error);
    return NextResponse.json(
      { error: "AUTH_SYNC_FAILED", message: error.message || "Authentication sync failed" },
      { status: 401 }
    );
  }
}
