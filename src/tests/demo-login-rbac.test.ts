import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as syncAuth } from "../app/api/v1/auth/sync/route";
import { GET as getMe } from "../app/api/v1/auth/me/route";
import { POST as logoutAuth } from "../app/api/v1/auth/logout/route";
import { requireAuth } from "../lib/auth/guard";
import { verifyIdToken } from "../lib/auth/admin";
import { env } from "../lib/env";

describe("LabLink Evaluator Demo Login & RBAC Security Suite", () => {
  beforeEach(() => {
    (process.env as any).NODE_ENV = "test";
    process.env.ENABLE_LOCAL_DEMO_AUTH = "true";
    (env as any).NODE_ENV = "test";
    (env as any).ENABLE_LOCAL_DEMO_AUTH = "true";
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = "test";
    process.env.ENABLE_LOCAL_DEMO_AUTH = "true";
    (env as any).NODE_ENV = "test";
    (env as any).ENABLE_LOCAL_DEMO_AUTH = "true";
  });

  it("1. Student one-click login successfully resolves Alex Chen and sets HttpOnly session cookie", async () => {
    const req = new Request("http://localhost:3000/api/v1/auth/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN",
      },
    });

    const res = await syncAuth(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.email).toBe("student.demo@lablink.edu");
    expect(body.user.fullName).toBe("Alex Chen");
    expect(body.user.role).toBe("student");
    expect(body.user.monthlyQuotaHours).toBe(25);

    // Verify Set-Cookie header contains lablink_token with HttpOnly
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("lablink_token=DEMO_TOKEN_STUDENT_ALEX_CHEN");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
  });

  it("2. Faculty one-click login successfully resolves Prof. Marcus Vance and sets HttpOnly session cookie", async () => {
    const req = new Request("http://localhost:3000/api/v1/auth/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer DEMO_TOKEN_FACULTY_MARCUS_VANCE",
      },
    });

    const res = await syncAuth(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.email).toBe("faculty.demo@lablink.edu");
    expect(body.user.fullName).toBe("Prof. Marcus Vance");
    expect(body.user.role).toBe("faculty");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("lablink_token=DEMO_TOKEN_FACULTY_MARCUS_VANCE");
    expect(setCookie).toContain("HttpOnly");
  });

  it("3. Session persistence: /api/v1/auth/me resolves identity from cookie across page refreshes", async () => {
    // Simulated browser refresh with student cookie
    const studentReq = new Request("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
      headers: {
        cookie: "lablink_token=DEMO_TOKEN_STUDENT_ALEX_CHEN",
      },
    });

    const studentRes = await getMe(studentReq);
    expect(studentRes.status).toBe(200);
    const studentBody = await studentRes.json();
    expect(studentBody.user.email).toBe("student.demo@lablink.edu");
    expect(studentBody.user.role).toBe("student");

    // Simulated browser refresh with faculty cookie
    const facultyReq = new Request("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
      headers: {
        cookie: "lablink_token=DEMO_TOKEN_FACULTY_MARCUS_VANCE",
      },
    });

    const facultyRes = await getMe(facultyReq);
    expect(facultyRes.status).toBe(200);
    const facultyBody = await facultyRes.json();
    expect(facultyBody.user.email).toBe("faculty.demo@lablink.edu");
    expect(facultyBody.user.role).toBe("faculty");
  });

  it("4. Role Isolation: Student session cannot access faculty-protected operations", async () => {
    const studentReq = new Request("http://localhost:3000/api/v1/faculty/review", {
      method: "GET",
      headers: {
        cookie: "lablink_token=DEMO_TOKEN_STUDENT_ALEX_CHEN",
      },
    });

    // Guard requirement: only faculty allowed
    await expect(requireAuth(studentReq, ["faculty"])).rejects.toThrow("Access forbidden");
  });

  it("5. Production Fail-Closed: Demo tokens are strictly rejected in production even if flag is true", async () => {
    (env as any).NODE_ENV = "production";
    (process.env as any).NODE_ENV = "production";
    (env as any).ENABLE_LOCAL_DEMO_AUTH = "true";
    process.env.ENABLE_LOCAL_DEMO_AUTH = "true";

    await expect(verifyIdToken("DEMO_TOKEN_STUDENT_ALEX_CHEN")).rejects.toThrow(
      "DEMO_AUTH_STRICTLY_PROHIBITED_IN_PRODUCTION"
    );

    await expect(verifyIdToken("DEMO_TOKEN_FACULTY_MARCUS_VANCE")).rejects.toThrow(
      "DEMO_AUTH_STRICTLY_PROHIBITED_IN_PRODUCTION"
    );
  });

  it("6. Missing Flag Rejection: Demo tokens are rejected when ENABLE_LOCAL_DEMO_AUTH is false", async () => {
    (env as any).NODE_ENV = "development";
    (process.env as any).NODE_ENV = "development";
    (env as any).ENABLE_LOCAL_DEMO_AUTH = "false";
    process.env.ENABLE_LOCAL_DEMO_AUTH = "false";

    await expect(verifyIdToken("DEMO_TOKEN_STUDENT_ALEX_CHEN")).rejects.toThrow(
      "DEMO_AUTH_STRICTLY_PROHIBITED_IN_PRODUCTION"
    );
  });

  it("7. Logout endpoint clears the session cookie with maxAge=0", async () => {
    const res = await logoutAuth();
    expect(res.status).toBe(200);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("lablink_token=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
