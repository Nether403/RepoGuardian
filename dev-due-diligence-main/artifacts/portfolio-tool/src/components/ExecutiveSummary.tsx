import { motion } from "framer-motion";
import { TrendingUp, AlertCircle, CheckCircle2, Star } from "lucide-react";
import { ExecutiveSummary as ExecutiveSummaryType } from "@/lib/insights";
import { cn } from "@/lib/utils";

interface Props {
  summary: ExecutiveSummaryType;
}

export function ExecutiveSummary({ summary }: Props) {
  const verdictStyles = {
    success: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    warning: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    danger: "text-red-400 border-red-500/30 bg-red-500/10",
  };

  const scoreColor =
    summary.overallScore >= 65
      ? "text-emerald-400"
      : summary.overallScore >= 40
        ? "text-yellow-400"
        : "text-red-400";

  const scoreRing =
    summary.overallScore >= 65
      ? "stroke-emerald-400"
      : summary.overallScore >= 40
        ? "stroke-yellow-400"
        : "stroke-red-400";

  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (summary.overallScore / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel rounded-3xl p-6 border border-white/5"
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Score ring + verdict */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
              <circle
                cx="36"
                cy="36"
                r="28"
                fill="none"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className={cn("transition-all duration-1000", scoreRing)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-xl font-bold tabular-nums", scoreColor)}>{summary.overallScore}</span>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Overall Score</div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border",
                verdictStyles[summary.verdictColor],
              )}
            >
              <Star className="w-3.5 h-3.5" />
              {summary.verdict}
            </span>
          </div>
        </div>

        <div className="w-px bg-white/5 hidden lg:block" />

        {/* Headline + paragraph */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Executive Assessment</h3>
          </div>
          <p className="font-semibold text-foreground mb-2 leading-snug">{summary.headline}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{summary.summaryParagraph}</p>
        </div>

        {/* Strengths / Concerns */}
        {(summary.strengths.length > 0 || summary.concerns.length > 0) && (
          <>
            <div className="w-px bg-white/5 hidden lg:block" />
            <div className="shrink-0 space-y-3 min-w-[200px]">
              {summary.strengths.slice(0, 3).map((s) => (
                <div key={s} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-foreground/80">{s}</span>
                </div>
              ))}
              {summary.concerns.slice(0, 2).map((c) => (
                <div key={c} className="flex items-start gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span className="text-foreground/80">{c}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
