import { verifyIdToken } from "./admin";
import { query } from "../db/pool";

export interface AuthenticatedUser {
  id: string;
  firebase_uid: string;
  email: string;
  full_name: string;
  role: "student" | "faculty";
  monthly_quota_hours: number;
  used_quota_hours: number;
  department_id: string | null;
  is_active: boolean;
}

export class AuthError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Enforces server-side authentication and role-based authorization.
 * Resolves user role strictly from the PostgreSQL users table.
 */
export async function requireAuth(
  req: Request,
  allowedRoles?: ("student" | "faculty")[]
): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get("Authorization");
  let token: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    // Check cookies fallback
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/lablink_token=([^;]+)/);
      if (match) token = match[1];
    }
  }

  if (!token) {
    throw new AuthError("Authentication token is required", 401, "TOKEN_MISSING");
  }

  let decoded;
  try {
    decoded = await verifyIdToken(token);
  } catch {
    throw new AuthError("Invalid or expired authentication token", 401, "INVALID_TOKEN");
  }

  // Authoritative database role resolution
  const { rows } = await query<AuthenticatedUser>(
    `SELECT id, firebase_uid, email, full_name, role, 
            monthly_quota_hours::float, used_quota_hours::float, 
            department_id, is_active
     FROM users 
     WHERE firebase_uid = $1`,
    [decoded.uid]
  );

  if (rows.length === 0) {
    throw new AuthError(
      "User account has not been synchronized. Call /api/v1/auth/sync first.",
      401,
      "USER_NOT_SYNCED"
    );
  }

  const user = rows[0];

  if (!user.is_active) {
    throw new AuthError("This account has been deactivated.", 403, "ACCOUNT_INACTIVE");
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw new AuthError(
      `Access forbidden. Requires one of: ${allowedRoles.join(", ")}`,
      403,
      "ROLE_FORBIDDEN"
    );
  }

  return user;
}
