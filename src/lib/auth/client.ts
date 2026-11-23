import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDemoFakeApiKeyForEvaluation2026",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "lablink-demo-2026.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "lablink-demo-2026",
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export interface DemoCredentials {
  email: string;
  role: "student" | "faculty";
  token: string;
}

/**
 * Evaluator Quick-Login helper
 * Enables instant one-click login for competition evaluation
 */
export async function getDemoSession(role: "student" | "faculty"): Promise<{ token: string; email: string }> {
  if (role === "student") {
    return {
      token: "DEMO_TOKEN_STUDENT_ALEX_CHEN",
      email: "student.demo@lablink.edu",
    };
  } else {
    return {
      token: "DEMO_TOKEN_FACULTY_MARCUS_VANCE",
      email: "faculty.demo@lablink.edu",
    };
  }
}
