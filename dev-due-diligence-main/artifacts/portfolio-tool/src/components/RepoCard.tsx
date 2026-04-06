import { RepoScore } from "@/lib/scoring";
import { Star, GitFork, Activity, FileText, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function RepoCard({ repo }: { repo: RepoScore }) {
  // Score color coding
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success bg-success/10 border-success/20";
    if (score >= 50) return "text-primary bg-primary/10 border-primary/20";
    return "text-muted-foreground bg-secondary border-border";
  };

  return (
    <a 
      href={repo.html_url}
      target="_blank"
      rel="noreferrer"
      className="block group h-full"
    >
      <div className="glass-panel h-full rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 flex flex-col">
        
        <div className="flex justify-between items-start mb-4 gap-4">
          <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors flex items-center gap-2 break-all">
            {repo.name}
            <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
          <div className={`shrink-0 px-3 py-1 rounded-lg border text-sm font-bold flex flex-col items-center justify-center leading-none ${getScoreColor(repo.qualityScore)}`}>
            <span className="text-xs font-medium opacity-80 mb-0.5">SCORE</span>
            {Math.round(repo.qualityScore)}
          </div>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">
          {repo.description || <span className="italic opacity-50">No description provided</span>}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-auto pt-4 border-t border-border/50">
          {repo.language && (
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              {repo.language}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4" /> {repo.stargazers_count}
          </div>
          <div className="flex items-center gap-1.5">
            <GitFork className="w-4 h-4" /> {repo.forks_count}
          </div>
          <div className="flex items-center gap-1.5" title={repo.has_readme ? "Has README" : "No README"}>
            <FileText className={`w-4 h-4 ${repo.has_readme ? "text-success" : "opacity-30"}`} />
          </div>
          {repo.pushed_at && (
            <div className="flex items-center gap-1.5 ml-auto text-xs opacity-70">
              <Activity className="w-3 h-3" />
              {formatDistanceToNow(new Date(repo.pushed_at), { addSuffix: true })}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
