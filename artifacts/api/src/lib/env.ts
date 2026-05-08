import { z } from "zod";

const envSchema = z.object({
  ALLOW_LEGACY_API_KEY_AUTH: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional()
    .default("false"),
  GITHUB_TOKEN: z.string().min(1).optional(),
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1).optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  API_SECRET_KEY: z.string().min(1).default("dev-secret-key-do-not-use-in-production"),
  DATABASE_URL: z.string().min(1).optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  SESSION_COOKIE_NAME: z.string().min(1).default("repo_guardian_session"),
  SESSION_SECRET: z.string().min(1).default("repo-guardian-session-secret-dev"),
  REPO_GUARDIAN_RUN_STORE_DIR: z.string().min(1).optional(),
  REPO_GUARDIAN_PLAN_STORE_DIR: z.string().min(1).optional()
}).refine(data => {
  if (data.NODE_ENV === "production" && data.API_SECRET_KEY === "dev-secret-key-do-not-use-in-production") {
    return false;
  }
  return true;
}, {
  message: "API_SECRET_KEY must be explicitly provided in production and cannot be the default dev key.",
  path: ["API_SECRET_KEY"]
}).refine(data => {
  if (data.NODE_ENV === "production" && !data.DATABASE_URL) {
    return false;
  }
  return true;
}, {
  message: "DATABASE_URL must be explicitly provided in production.",
  path: ["DATABASE_URL"]
}).refine((data) => {
  if (data.NODE_ENV !== "production") {
    return true;
  }

  return Boolean(data.GITHUB_APP_ID && data.GITHUB_APP_PRIVATE_KEY && data.GITHUB_OAUTH_CLIENT_ID && data.GITHUB_OAUTH_CLIENT_SECRET);
}, {
  message: "GitHub App and GitHub OAuth credentials must be provided in production.",
  path: ["GITHUB_APP_ID"]
}).refine((data) => {
  if (data.NODE_ENV !== "production") {
    return true;
  }

  return data.SESSION_SECRET !== "repo-guardian-session-secret-dev";
}, {
  message: "SESSION_SECRET must be explicitly provided in production.",
  path: ["SESSION_SECRET"]
});

export const env = envSchema.parse(process.env);
