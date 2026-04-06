import { useEffect } from "react";
import { useGetBenchmark, useSubmitBenchmark } from "@workspace/api-client-react";
import { TrendingUp } from "lucide-react";

interface Props {
  username: string;
  starsTotal: number;
  activeDays90: number;
  longestStreak: number;
  followers: number;
  repoCount: number;
  overallScore: number;
}


function percentileLabel(pct: number): string {
  if (pct >= 95) return "top 5%";
  if (pct >= 90) return "top 10%";
  if (pct >= 80) return "top 20%";
  if (pct >= 70) return "top 30%";
  if (pct >= 50) return "top half";
  return "bottom half";
}

function percentileColor(pct: number): string {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-blue-400";
  if (pct >= 40) return "text-yellow-400";
  return "text-muted-foreground";
}

export function BenchmarkBadge({ username, starsTotal, activeDays90, longestStreak, followers, repoCount, overallScore }: Props) {
  const { mutate: submit } = useSubmitBenchmark();
  const { data: bench } = useGetBenchmark(username);

  useEffect(() => {
    submit({
      data: { username, stars_total: starsTotal, active_days_90: activeDays90, longest_streak: longestStreak, followers, repo_count: repoCount, overall_score: overallScore },
    });
  }, [username]);

  if (!bench || bench.total_profiles < 3) return null;

  const badges = [
    { label: "Overall score", pct: bench.score_pct },
    { label: "Activity", pct: bench.activity_pct },
    { label: "Stars", pct: bench.stars_pct },
  ].filter((b) => b.pct >= 50);

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <TrendingUp className="w-3.5 h-3.5" />
        <span>vs. {bench.total_profiles} profiles:</span>
      </div>
      {badges.map((b) => (
        <span
          key={b.label}
          className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${percentileColor(b.pct)}`}
        >
          {percentileLabel(b.pct)} — {b.label}
        </span>
      ))}
    </div>
  );
}
