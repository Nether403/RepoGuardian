import { CollaborationData } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { GitPullRequest, MessageSquare, GitBranch, Users } from "lucide-react";

interface Props {
  collaboration: CollaborationData;
}

export function CollaborationCard({ collaboration }: Props) {
  const ratingColor = {
    High: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    Moderate: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    Low: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    None: "text-muted-foreground bg-white/5 border-white/10",
  }[collaboration.rating];

  const signals = [
    {
      icon: <GitPullRequest className="w-4 h-4" />,
      label: "Pull Requests Opened",
      value: collaboration.prEvents,
      desc: "Shows shipping velocity",
    },
    {
      icon: <MessageSquare className="w-4 h-4" />,
      label: "PR Reviews Given",
      value: collaboration.prReviewEvents,
      desc: "Code review engagement",
    },
    {
      icon: <GitBranch className="w-4 h-4" />,
      label: "Issue Interactions",
      value: collaboration.issueEvents + collaboration.issueCommentEvents,
      desc: "Communication & planning",
    },
    {
      icon: <Users className="w-4 h-4" />,
      label: "Cross-repo Contributions",
      value: collaboration.crossRepoEvents,
      desc: "Contributes beyond own repos",
    },
  ];

  const total = collaboration.prEvents + collaboration.prReviewEvents + collaboration.issueEvents + collaboration.issueCommentEvents;
  const maxVal = Math.max(...signals.map((s) => s.value), 1);

  return (
    <div className="glass-panel rounded-2xl p-5 space-y-4 border border-white/5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Collaboration Signals
        </h3>
        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", ratingColor)}>
          {collaboration.rating}
        </span>
      </div>

      <div className="space-y-3">
        {signals.map((sig) => (
          <div key={sig.label}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-primary/70">{sig.icon}</span>
                {sig.label}
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{sig.value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-primary/50 transition-all duration-700"
                style={{ width: `${(sig.value / maxVal) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sig.desc}</p>
          </div>
        ))}
      </div>

      {total === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center py-1">
          No collaboration events in the available public event window (last 12 months).
        </p>
      )}
    </div>
  );
}
