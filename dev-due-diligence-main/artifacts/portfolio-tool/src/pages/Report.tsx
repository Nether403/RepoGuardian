import { useRef, useState } from "react";
import { useRoute } from "wouter";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, AlertTriangle, Check, Search, RefreshCw, Download, Loader2, GitCompare } from "lucide-react";
import { useGetGithubProfile, useGetGithubRepos, useGetGithubEvents } from "@workspace/api-client-react";
import { getRankedRepos, getTopLanguages, getActivityData, evaluateFlags } from "@/lib/scoring";
import { getConsistencyData, getCollaborationData, generateExecutiveSummary } from "@/lib/insights";
import { ProfileCard } from "@/components/ProfileCard";
import { RepoCard } from "@/components/RepoCard";
import { ActivityChart, LanguageDistribution } from "@/components/Charts";
import { Flags } from "@/components/Flags";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { ConsistencyCard } from "@/components/ConsistencyCard";
import { CollaborationCard } from "@/components/CollaborationCard";
import { TechStack } from "@/components/TechStack";
import { EcosystemCard } from "@/components/EcosystemCard";
import { BenchmarkBadge } from "@/components/BenchmarkBadge";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/hooks/use-clipboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function Report() {
  const [, params] = useRoute("/report/:username");
  const username = params?.username || "";
  const { copied, copy } = useClipboard();
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useGetGithubProfile(username);
  const {
    data: repos,
    isLoading: isReposLoading,
    isError: isReposError,
    refetch: refetchRepos,
  } = useGetGithubRepos(username);
  const {
    data: events,
    isLoading: isEventsLoading,
    isError: isEventsError,
    refetch: refetchEvents,
  } = useGetGithubEvents(username);

  const isLoading = isProfileLoading || isReposLoading || isEventsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
        </div>
        <h2 className="mt-8 text-2xl font-display font-bold text-foreground">Analyzing {username}...</h2>
        <p className="text-muted-foreground mt-2">Crunching repositories and contribution history</p>
      </div>
    );
  }

  if (isProfileError || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-3xl max-w-md text-center">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Profile unavailable</h2>
          <p className="text-muted-foreground mb-8">Could not load "{username}". The user may not exist, or GitHub rate limits may be temporarily exceeded.</p>
          <Link href="/" className="inline-flex">
            <Button size="lg" className="w-full">
              <Search className="w-4 h-4 mr-2" /> Try another search
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const reposError = isReposError;
  const eventsError = isEventsError;
  const safeRepos = repos ?? [];
  const safeEvents = events ?? [];

  const rankedRepos = reposError ? [] : getRankedRepos(safeRepos);
  const topLanguages = reposError ? [] : getTopLanguages(safeRepos);
  const activityData = eventsError ? [] : getActivityData(safeEvents);
  const flags = evaluateFlags(profile, reposError ? null : safeRepos, eventsError ? null : safeEvents);

  const consistency = eventsError ? null : getConsistencyData(safeEvents, username);
  const collaboration = eventsError ? null : getCollaborationData(safeEvents, username);
  const summary = generateExecutiveSummary(
    profile,
    reposError ? null : safeRepos,
    eventsError ? null : safeEvents,
    consistency,
    collaboration,
  );

  const handleShare = () => {
    copy(window.location.href);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(reportRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#0a0a0f",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height / canvas.width) * imgW;
      let yOffset = 0;

      while (yOffset < imgH) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -yOffset, imgW, imgH);
        yOffset += pageH;
      }

      pdf.save(`github-report-${username}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setIsExporting(false);
    }
  };

  const totalStars = safeRepos.reduce((a, r) => a + (r.stargazers_count || 0), 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Analyze Another
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={`/compare?u=${username}`} className="inline-flex">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground hidden sm:flex">
                <GitCompare className="w-4 h-4" /> Compare
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="gap-2 bg-secondary/50 border-white/10"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? "Exporting…" : "Export PDF"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-2 bg-secondary/50 border-white/10">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Share2 className="w-4 h-4" />}
              {copied ? "Copied Link" : "Share Report"}
            </Button>
          </div>
        </div>
      </nav>

      <main ref={reportRef} className="max-w-7xl mx-auto px-4 pt-8 space-y-8">

        {/* Executive Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <ExecutiveSummary summary={summary} />
          {/* Benchmark badge — lazy, appears after benchmark data is ready */}
          <div className="mt-3 px-1">
            <BenchmarkBadge
              username={username}
              starsTotal={totalStars}
              activeDays90={consistency?.activeDays365 ?? 0}
              longestStreak={consistency?.longestStreak ?? 0}
              followers={profile.followers ?? 0}
              repoCount={profile.public_repos ?? 0}
              overallScore={summary.overallScore}
            />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}>
          <ProfileCard profile={profile} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-8">

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <h3 className="text-2xl font-bold mb-4">Technical Signals</h3>
              <Flags flags={flags} />
            </motion.div>

            {collaboration && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
                <CollaborationCard collaboration={collaboration} />
              </motion.div>
            )}

            {/* Tech Stack */}
            {!reposError && safeRepos.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }}>
                <TechStack repos={safeRepos} />
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <div className="flex items-end justify-between mb-4">
                <h3 className="text-2xl font-bold">Top Repositories</h3>
                <span className="text-sm text-muted-foreground">Ranked by code quality algorithm</span>
              </div>

              {reposError ? (
                <div className="glass-panel p-8 text-center rounded-2xl">
                  <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">Failed to load repositories. This may be due to GitHub rate limits.</p>
                  <Button variant="outline" size="sm" onClick={() => refetchRepos()} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Retry
                  </Button>
                </div>
              ) : rankedRepos.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {rankedRepos.map((repo, i) => (
                    <motion.div
                      key={repo.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
                    >
                      <RepoCard repo={repo} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="glass-panel p-12 text-center rounded-2xl">
                  <p className="text-muted-foreground">No public non-fork repositories found.</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-8">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              <Card className="glass-panel overflow-hidden relative">
                <CardHeader>
                  <CardTitle>12-Month Activity</CardTitle>
                </CardHeader>
                <CardContent className="px-2">
                  {eventsError ? (
                    <div className="flex flex-col items-center py-8 gap-3">
                      <AlertTriangle className="w-6 h-6 text-destructive" />
                      <p className="text-sm text-muted-foreground text-center">Activity data unavailable</p>
                      <Button variant="outline" size="sm" onClick={() => refetchEvents()} className="gap-2 text-xs">
                        <RefreshCw className="w-3 h-3" /> Retry
                      </Button>
                    </div>
                  ) : (
                    <ActivityChart data={activityData} />
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {consistency && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.35 }}>
                <ConsistencyCard consistency={consistency} />
              </motion.div>
            )}

            {/* Organization & Ecosystem */}
            {!reposError && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.38 }}>
                <EcosystemCard username={username} repos={safeRepos} />
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
              <Card className="glass-panel relative">
                <CardHeader>
                  <CardTitle>Language Map</CardTitle>
                </CardHeader>
                <CardContent className="relative pb-8">
                  {reposError ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Language data unavailable</p>
                  ) : (
                    <LanguageDistribution data={topLanguages} />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

      </main>
    </div>
  );
}
