import { describe, it, expect } from "vitest";
import { query } from "../lib/db/pool";
import { POST } from "../app/api/v1/auth/sync/route";

describe("AC-AUTH-02: Prevention of Role Tampering during Account Sync", () => {
  it("must discard any client-provided role and preserve the database role", async () => {
    // Malicious request attempting student self-promotion to faculty
    const req = new Request("http://localhost:3000/api/v1/auth/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN",
      },
      body: JSON.stringify({
        role: "faculty", // Attempted role tampering!
        displayName: "Alex Chen (Hacked)",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    // Verify client cannot escalate role
    expect(data.user.role).toBe("student");
    expect(data.user.email).toBe("student.demo@lablink.edu");

    // Verify PostgreSQL database state is strictly 'student'
    const dbCheck = await query(
      "SELECT role FROM users WHERE email = 'student.demo@lablink.edu';"
    );
    expect(dbCheck.rows[0].role).toBe("student");
  });

  it("must reject requests with missing token", async () => {
    const req = new Request("http://localhost:3000/api/v1/auth/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("TOKEN_MISSING");
  });

  it("must strictly prohibit demo quick-tokens in production environments", async () => {
    const { verifyIdToken } = await import("../lib/auth/admin");
    const { env } = await import("../lib/env");

    const originalEnv = env.NODE_ENV;
    try {
      (env as any).NODE_ENV = "production";

      await expect(
        verifyIdToken("DEMO_TOKEN_STUDENT_ALEX_CHEN")
      ).rejects.toThrow("DEMO_AUTH_STRICTLY_PROHIBITED_IN_PRODUCTION");

      await expect(
        verifyIdToken("DEMO_TOKEN_FACULTY_MARCUS_VANCE")
      ).rejects.toThrow("DEMO_AUTH_STRICTLY_PROHIBITED_IN_PRODUCTION");
    } finally {
      (env as any).NODE_ENV = originalEnv;
    }
  });

  it("must enforce database role as the sole authorization authority", async () => {
    const { requireAuth } = await import("../lib/auth/guard");

    // Student token attempting to access faculty-restricted function
    const req = new Request("http://localhost:3000/api/v1/faculty/review", {
      headers: {
        Authorization: "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN",
      },
    });

    // Should reject because PostgreSQL users table has role = 'student'
    await expect(requireAuth(req, ["faculty"])).rejects.toThrow(
      "Access forbidden. Requires one of: faculty"
    );

    // Should allow when permitted role matches PostgreSQL record
    const user = await requireAuth(req, ["student"]);
    expect(user.role).toBe("student");
    expect(user.email).toBe("student.demo@lablink.edu");
  });
});
