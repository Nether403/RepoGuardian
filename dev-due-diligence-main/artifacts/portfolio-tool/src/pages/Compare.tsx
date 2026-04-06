import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, X, GitCompare, Star, Activity, Flame, Users, Code2, ExternalLink, TrendingUp } from "lucide-react";
import { useGetGithubProfile, useGetGithubRepos, useGetGithubEvents } from "@workspace/api-client-react";
import { getRankedRepos, getTopLanguages, evaluateFlags } from "@/lib/scoring";
import { getConsistencyData, getCollaborationData, generateExecutiveSummary } from "@/lib/insights";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

function useProfileData(username: string) {
  const profile = useGetGithubProfile(username);
  const repos = useGetGithubRepos(username);
  const events = useGetGithubEvents(username);
  return { profile, repos, events };
}

interface ColumnProps {
  username: string;
  rank: number;
}

function CompareColumn({ username, rank }: ColumnProps) {
  const { profile, repos, events } = useProfileData(username);

  const isLoading = profile.isLoading || repos.isLoading || events.isLoading;

  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading {username}…</p>
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <p className="text-destructive font-semibold">User not found</p>
        <p className="text-xs text-muted-foreground">"{username}" could not be loaded</p>
      </div>
    );
  }

  const p = profile.data;
  const safeRepos = repos.data ?? [];
  const safeEvents = events.data ?? [];
  const reposOk = !repos.isError;
  const eventsOk = !events.isError;

  const rankedRepos = reposOk ? getRankedRepos(safeRepos) : [];
  const topLang = reposOk ? getTopLanguages(safeRepos)[0]?.name : undefined;
  const flags = evaluateFlags(p, reposOk ? safeRepos : null, eventsOk ? safeEvents : null);
  const consistency = eventsOk ? getConsistencyData(safeEvents, username) : null;
  const collaboration = eventsOk ? getCollaborationData(safeEvents, username) : null;
  const summary = generateExecutiveSummary(p, reposOk ? safeRepos : null, eventsOk ? safeEvents : null, consistency, collaboration);

  const totalStars = safeRepos.reduce((a, r) => a + (r.stargazers_count || 0), 0);

  const rankColors = ["from-yellow-500/20", "from-slate-400/20", "from-amber-600/20"];
  const rankLabels = ["#1", "#2", "#3"];

  const verdictColor = {
    success: "text-emerald-400",
    warning: "text-yellow-400",
    danger: "text-red-400",
  }[summary.verdictColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: rank * 0.1 }}
      className="glass-panel rounded-2xl overflow-hidden border border-white/5"
    >
      {/* Rank header */}
      <div className={cn("h-1 bg-gradient-to-r to-transparent", rankColors[rank])} />

      <div className="p-5 space-y-5">
        {/* Profile */}
        <div className="flex items-center gap-3">
          <img src={p.avatar_url} alt={p.login} className="w-14 h-14 rounded-full border-2 border-white/10" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">{rankLabels[rank]}</span>
              <p className="font-bold text-foreground truncate">{p.name || p.login}</p>
            </div>
            <p className="text-sm text-muted-foreground">@{p.login}</p>
            {topLang && <p className="text-xs text-primary mt-0.5">{topLang}</p>}
          </div>
        </div>

        {/* Score + Verdict */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{summary.overallScore}</p>
            <p className="text-[10px] uppercase text-muted-foreground">Score</p>
          </div>
          <div className={cn("text-sm font-semibold", verdictColor)}>{summary.verdict}</div>
          <div className="text-center">
            <p className="text-lg font-bold">{p.followers?.toLocaleString()}</p>
            <p className="text-[10px] uppercase text-muted-foreground">Followers</p>
          </div>
        </div>

        {/* Key metrics */}
        <div className="space-y-2.5">
          <MetricRow icon={<Star className="w-4 h-4 text-yellow-400" />} label="Total Stars" value={totalStars.toLocaleString()} />
          <MetricRow icon={<Activity className="w-4 h-4 text-blue-400" />} label="Active Days (1yr)" value={consistency ? `${consistency.activeDays365}` : "—"} />
          <MetricRow icon={<Flame className="w-4 h-4 text-orange-400" />} label="Best Streak" value={consistency ? `${consistency.longestStreak} days` : "—"} />
          <MetricRow icon={<Users className="w-4 h-4 text-purple-400" />} label="Collaboration" value={collaboration?.rating ?? "—"} />
          <MetricRow icon={<Code2 className="w-4 h-4 text-emerald-400" />} label="Public Repos" value={`${p.public_repos}`} />
        </div>

        {/* Top repos */}
        {rankedRepos.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Top Repos</p>
            <div className="space-y-1.5">
              {rankedRepos.slice(0, 3).map((repo) => (
                <a
                  key={repo.id}
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-sm hover:text-primary transition-colors group"
                >
                  <span className="truncate text-foreground/80 group-hover:text-primary">{repo.name}</span>
                  <span className="flex items-center gap-1 text-yellow-400/70 text-xs shrink-0 ml-2">
                    ⭐ {repo.stargazers_count?.toLocaleString()}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Green flags */}
        {flags.filter((f) => f.type === "success").length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Strengths</p>
            <div className="space-y-1">
              {flags.filter((f) => f.type === "success").slice(0, 3).map((f) => (
                <p key={f.label} className="text-xs text-emerald-400">✓ {f.label}</p>
              ))}
            </div>
          </div>
        )}

        {/* Red flags */}
        {flags.filter((f) => f.type === "danger").length > 0 && (
          <div>
            {flags.filter((f) => f.type === "danger").slice(0, 2).map((f) => (
              <p key={f.label} className="text-xs text-red-400">⚠ {f.label}</p>
            ))}
          </div>
        )}

        {/* Link to full report */}
        <Link href={`/report/${username}`} className="block">
          <Button variant="outline" size="sm" className="w-full gap-2 border-white/10 hover:border-primary/50">
            <ExternalLink className="w-3.5 h-3.5" /> Full Report
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

function MetricRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon} {label}
      </div>
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function Compare() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialUsers = searchParams.getAll("u").filter(Boolean).slice(0, 3);

  const [inputs, setInputs] = useState<string[]>(
    initialUsers.length >= 2 ? initialUsers : [...initialUsers, "", ""].slice(0, 3),
  );
  const [committed, setCommitted] = useState<string[]>(initialUsers);

  const updateUrl = (users: string[]) => {
    const valid = users.filter((u) => GITHUB_USERNAME_RE.test(u));
    const params = valid.map((u) => `u=${u}`).join("&");
    setLocation(`/compare${params ? `?${params}` : ""}`);
  };

  const handleCompare = () => {
    const valid = inputs.filter((u) => GITHUB_USERNAME_RE.test(u.trim()));
    setCommitted(valid);
    updateUrl(valid);
  };

  const activeUsers = committed.filter((u) => GITHUB_USERNAME_RE.test(u));

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <GitCompare className="w-4 h-4 text-primary" /> Side-by-Side Comparison
          </div>
          <div className="w-20" />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pt-8 space-y-8">
        {/* Input row */}
        <div className="glass-panel rounded-2xl p-5 border border-white/5">
          <p className="text-sm font-medium text-muted-foreground mb-4">Enter 2–3 GitHub usernames to compare</p>
          <div className="flex flex-wrap gap-3 items-end">
            {inputs.map((val, i) => (
              <div key={i} className="flex items-center gap-2 flex-1 min-w-[160px]">
                <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder={`Username ${i + 1}`}
                  value={val}
                  onChange={(e) => {
                    const next = [...inputs];
                    next[i] = e.target.value.trim();
                    setInputs(next);
                  }}
                  className="bg-white/5 border-white/10 h-9"
                  onKeyDown={(e) => e.key === "Enter" && handleCompare()}
                />
                {inputs.length > 2 && (
                  <button
                    onClick={() => setInputs(inputs.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {inputs.length < 3 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputs([...inputs, ""])}
                className="gap-1 border-white/10 h-9"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            )}
            <Button size="sm" onClick={handleCompare} className="h-9 px-6">
              Compare
            </Button>
          </div>
        </div>

        {/* Comparison grid */}
        {activeUsers.length >= 2 ? (
          <div className={cn(
            "grid gap-6",
            activeUsers.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3",
          )}>
            {activeUsers.map((username, i) => (
              <CompareColumn key={username} username={username} rank={i} />
            ))}
          </div>
        ) : (
          <div className="glass-panel rounded-2xl p-12 text-center border border-white/5">
            <GitCompare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Enter at least 2 valid GitHub usernames above and click Compare.</p>
          </div>
        )}
      </main>
    </div>
  );
}
