import { Router } from "express";
import pool from "../db";

const router = Router();

router.post("/benchmark", async (req, res) => {
  const { username, stars_total, active_days_90, longest_streak, followers, repo_count, overall_score } = req.body as {
    username: string;
    stars_total: number;
    active_days_90: number;
    longest_streak: number;
    followers: number;
    repo_count: number;
    overall_score: number;
  };

  if (!username) {
    res.status(400).json({ error: "username required" });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO profile_benchmarks (username, stars_total, active_days_90, longest_streak, followers, repo_count, overall_score, analyzed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (username) DO UPDATE SET
         stars_total    = EXCLUDED.stars_total,
         active_days_90 = EXCLUDED.active_days_90,
         longest_streak = EXCLUDED.longest_streak,
         followers      = EXCLUDED.followers,
         repo_count     = EXCLUDED.repo_count,
         overall_score  = EXCLUDED.overall_score,
         analyzed_at    = NOW()`,
      [username, stars_total, active_days_90, longest_streak, followers, repo_count, overall_score],
    );
    res.json({ status: "ok" });
  } catch (err) {
    req.log.error({ err }, "Failed to store benchmark");
    res.status(500).json({ error: "Failed to store benchmark" });
  }
});

router.get("/benchmark/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const profileResult = await pool.query<{
      stars_total: number;
      active_days_90: number;
      overall_score: number;
    }>(
      `SELECT stars_total, active_days_90, overall_score FROM profile_benchmarks WHERE username = $1`,
      [username],
    );

    if (profileResult.rows.length === 0) {
      res.json({ score_pct: 50, activity_pct: 50, stars_pct: 50, total_profiles: 0 });
      return;
    }

    const { stars_total, active_days_90, overall_score } = profileResult.rows[0];

    const pctResult = await pool.query<{
      score_pct: string;
      activity_pct: string;
      stars_pct: string;
      total_profiles: string;
    }>(
      `SELECT
        ROUND(COUNT(*) FILTER (WHERE overall_score  <= $1) * 100.0 / NULLIF(COUNT(*), 0))::int AS score_pct,
        ROUND(COUNT(*) FILTER (WHERE active_days_90 <= $2) * 100.0 / NULLIF(COUNT(*), 0))::int AS activity_pct,
        ROUND(COUNT(*) FILTER (WHERE stars_total    <= $3) * 100.0 / NULLIF(COUNT(*), 0))::int AS stars_pct,
        COUNT(*) as total_profiles
       FROM profile_benchmarks`,
      [overall_score, active_days_90, stars_total],
    );

    const row = pctResult.rows[0];
    res.json({
      score_pct: Number(row.score_pct) || 50,
      activity_pct: Number(row.activity_pct) || 50,
      stars_pct: Number(row.stars_pct) || 50,
      total_profiles: Number(row.total_profiles) || 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch benchmark");
    res.status(500).json({ error: "Failed to fetch benchmark" });
  }
});

export default router;
