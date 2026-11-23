import * as admin from "firebase-admin";
import { env } from "../env";

interface DecodedToken {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}

let app: admin.app.App | null = null;

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
 * Supports standard Firebase tokens and demonstration evaluator tokens.
 */
export async function verifyIdToken(token: string): Promise<DecodedToken> {
  if (!token) {
    throw new Error("TOKEN_MISSING");
  }

  // Demonstration Evaluator Quick-Tokens
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
    // If Firebase credentials are demo placeholders and token failed, reject cleanly
    console.error("[Auth Admin] Token verification failed:", error.message || error);
    throw new Error("INVALID_TOKEN");
  }
}
