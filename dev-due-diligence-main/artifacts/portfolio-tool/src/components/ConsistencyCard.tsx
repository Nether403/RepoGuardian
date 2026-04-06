import { ConsistencyData } from "@/lib/insights";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Flame, Calendar, Clock } from "lucide-react";

interface Props {
  consistency: ConsistencyData;
}

export function ConsistencyCard({ consistency }: Props) {
  const ratingColor = {
    Exceptional: "text-emerald-400",
    Strong: "text-blue-400",
    Moderate: "text-yellow-400",
    Sporadic: "text-red-400",
  }[consistency.rating];

  const maxWeek = Math.max(...consistency.weeklyData.map((w) => w.count), 1);

  return (
    <Card className="glass-panel relative overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Contribution Consistency</span>
          <span className={cn("text-sm font-semibold", ratingColor)}>{consistency.rating}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatPill
            icon={<Calendar className="w-3.5 h-3.5" />}
            label="Active Days"
            value={`${consistency.activeDays365}`}
            sub="/ 365 days"
          />
          <StatPill
            icon={<Flame className="w-3.5 h-3.5" />}
            label="Best Streak"
            value={`${consistency.longestStreak}d`}
            sub="longest"
          />
          <StatPill
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Weekdays"
            value={`${Math.round(consistency.weekdayRatio * 100)}%`}
            sub="of activity"
          />
        </div>

        {/* 52-week bar chart */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Weekly activity (12 months)</p>
          <div className="flex items-end gap-[2px] h-14">
            {consistency.weeklyData.map((w, i) => {
              const heightPct = maxWeek > 0 ? (w.count / maxWeek) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-sm bg-primary/30 hover:bg-primary/60 transition-colors"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    title={`${w.week}: ${w.count} active day${w.count !== 1 ? "s" : ""}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground/50">
            <span>{consistency.weeklyData[0]?.week}</span>
            <span>now</span>
          </div>
        </div>

        {/* Current streak */}
        {consistency.currentStreak > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-primary/5 border border-primary/10">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-foreground/80">
              <span className="font-semibold text-orange-400">{consistency.currentStreak}-day</span> active streak
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatPill({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/[0.03] border border-white/5">
      <div className="text-primary mb-1">{icon}</div>
      <div className="text-lg font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[9px] text-muted-foreground/60">{sub}</div>
    </div>
  );
}
