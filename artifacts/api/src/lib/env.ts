import { z } from "zod";

const envSchema = z.object({
  GITHUB_TOKEN: z.string().min(1).optional(),
  API_SECRET_KEY: z.string().min(1).default("dev-secret-key-do-not-use-in-production"),
  DATABASE_URL: z.string().min(1).optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
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
});

export const env = envSchema.parse(process.env);
