import * as admin from "firebase-admin";
import crypto from "crypto";
import { env } from "../env";

interface DecodedToken {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}

let app: admin.app.App | null = null;

function safeCompare(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function createEvaluatorSessionToken(role: "student" | "faculty"): string {
  const secret = env.EVALUATOR_SESSION_SECRET || env.EVALUATOR_STUDENT_SECRET || "lablink-evaluator-session-secret-2026";
  const timestamp = Date.now().toString();
  const payload = `${role}:${timestamp}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `eval_${role}_${timestamp}_${hmac}`;
}

export function verifyEvaluatorSessionToken(token: string): DecodedToken | null {
  if (!token.startsWith("eval_student_") && !token.startsWith("eval_faculty_")) {
    return null;
  }
  const parts = token.split("_");
  if (parts.length !== 4) return null;
  const role = parts[1] as "student" | "faculty";
  const timestampStr = parts[2];
  const signature = parts[3];

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 86400000 * 7) { // 7 days expiration
    return null;
  }

  const secret = env.EVALUATOR_SESSION_SECRET || env.EVALUATOR_STUDENT_SECRET || "lablink-evaluator-session-secret-2026";
  const expectedPayload = `${role}:${timestampStr}`;
  const expectedHmac = crypto.createHmac("sha256", secret).update(expectedPayload).digest("hex");

  if (!safeCompare(signature, expectedHmac)) {
    return null;
  }

  if (role === "student") {
    return {
      uid: "firebase_demo_student_alex_chen_2026",
      email: "student.demo@lablink.edu",
      name: "Alex Chen",
    };
  } else {
    return {
      uid: "firebase_demo_faculty_marcus_vance_2026",
      email: "faculty.demo@lablink.edu",
      name: "Prof. Marcus Vance",
    };
  }
}

export function getFirebaseAdminApp(): admin.app.App {
  if (app) return app;

  if (admin.apps.length > 0) {
    app = admin.apps[0]!;
    return app;
  }

  // If private key is configured, initialize with Service Account
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    return app;
  }

  // Fallback to project ID only (or emulator)
  app = admin.initializeApp({
    projectId: env.FIREBASE_PROJECT_ID,
  });
  return app;
}

/**
 * Server-side Firebase ID token verification.
 * Runs in Node.js runtime (app/api/v1/... with export const runtime = 'nodejs').
 * Supports standard Firebase tokens, signed evaluator session tokens, and high-entropy evaluator secrets.
 */
export async function verifyIdToken(token: string): Promise<DecodedToken> {
  if (!token) {
    throw new Error("TOKEN_MISSING");
  }

  // 1. Signed Evaluator Session Tokens
  const signedSession = verifyEvaluatorSessionToken(token);
  if (signedSession) {
    const isProduction = env.NODE_ENV === "production" || process.env.NODE_ENV === "production";
    if (isProduction && env.ENABLE_PROD_EVALUATOR_AUTH !== "true") {
      throw new Error("PROD_EVALUATOR_AUTH_DISABLED");
    }
    return signedSession;
  }

  // 2. High-Entropy Production Evaluator Secrets (server-side validation only)
  if (env.ENABLE_PROD_EVALUATOR_AUTH === "true") {
    if (env.EVALUATOR_STUDENT_SECRET && safeCompare(token, env.EVALUATOR_STUDENT_SECRET)) {
      return {
        uid: "firebase_demo_student_alex_chen_2026",
        email: "student.demo@lablink.edu",
        name: "Alex Chen",
      };
    }

    if (env.EVALUATOR_FACULTY_SECRET && safeCompare(token, env.EVALUATOR_FACULTY_SECRET)) {
      return {
        uid: "firebase_demo_faculty_marcus_vance_2026",
        email: "faculty.demo@lablink.edu",
        name: "Prof. Marcus Vance",
      };
    }
  }

  // 3. Demonstration Evaluator Quick-Tokens:
  // Strictly restricted to local non-production environments.
  // CANNOT be enabled in production under any configuration.
  const isDemoToken =
    token === "DEMO_TOKEN_STUDENT_ALEX_CHEN" ||
    token === "DEMO_TOKEN_FACULTY_MARCUS_VANCE";

  if (isDemoToken) {
    const isProduction =
      env.NODE_ENV === "production" || process.env.NODE_ENV === "production";
    const isDemoAuthFlagEnabled =
      env.ENABLE_LOCAL_DEMO_AUTH === "true" ||
      process.env.ENABLE_LOCAL_DEMO_AUTH === "true";

    // Strictly dual-condition: must NOT be production AND must have explicit demo auth flag enabled
    const isLocalDemoPermitted = !isProduction && isDemoAuthFlagEnabled;

    if (isProduction || !isLocalDemoPermitted) {
      throw new Error("DEMO_AUTH_STRICTLY_PROHIBITED_IN_PRODUCTION");
    }

    if (token === "DEMO_TOKEN_STUDENT_ALEX_CHEN") {
      return {
        uid: "firebase_demo_student_alex_chen_2026",
        email: "student.demo@lablink.edu",
        name: "Alex Chen",
      };
    }

    if (token === "DEMO_TOKEN_FACULTY_MARCUS_VANCE") {
      return {
        uid: "firebase_demo_faculty_marcus_vance_2026",
        email: "faculty.demo@lablink.edu",
        name: "Prof. Marcus Vance",
      };
    }
  }

  // 4. Standard Firebase ID Token verification
  try {
    const adminApp = getFirebaseAdminApp();
    const decoded = await adminApp.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || "",
      name: (decoded as any).name,
      picture: (decoded as any).picture,
    };
  } catch (error: any) {
    console.error("[Auth Admin] Token verification failed:", error.message || error);
    throw new Error("INVALID_TOKEN");
  }
}
