import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/lablink"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ENABLE_LOCAL_DEMO_AUTH: z.string().default("false"),
  ENABLE_PROD_EVALUATOR_AUTH: z.string().default("false"),
  EVALUATOR_STUDENT_SECRET: z.string().optional(),
  EVALUATOR_FACULTY_SECRET: z.string().optional(),
  EVALUATOR_SESSION_SECRET: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().default("lablink-demo-2026"),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().default("AIzaSyDemoFakeApiKeyForEvaluation2026"),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().default("lablink-demo-2026.firebaseapp.com"),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().default("lablink-demo-2026"),
  GEMINI_API_KEY: z.string().optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  ENABLE_LOCAL_DEMO_AUTH: process.env.ENABLE_LOCAL_DEMO_AUTH,
  ENABLE_PROD_EVALUATOR_AUTH: process.env.ENABLE_PROD_EVALUATOR_AUTH,
  EVALUATOR_STUDENT_SECRET: process.env.EVALUATOR_STUDENT_SECRET,
  EVALUATOR_FACULTY_SECRET: process.env.EVALUATOR_FACULTY_SECRET,
  EVALUATOR_SESSION_SECRET: process.env.EVALUATOR_SESSION_SECRET,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
});
