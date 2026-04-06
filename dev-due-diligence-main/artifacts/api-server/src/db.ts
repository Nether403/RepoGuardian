import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile_benchmarks (
      username       TEXT PRIMARY KEY,
      stars_total    INT  NOT NULL DEFAULT 0,
      active_days_90 INT  NOT NULL DEFAULT 0,
      longest_streak INT  NOT NULL DEFAULT 0,
      followers      INT  NOT NULL DEFAULT 0,
      repo_count     INT  NOT NULL DEFAULT 0,
      overall_score  INT  NOT NULL DEFAULT 0,
      analyzed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export default pool;
