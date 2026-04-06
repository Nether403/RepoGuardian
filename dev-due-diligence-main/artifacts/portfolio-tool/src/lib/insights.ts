import { GithubProfile, GithubRepo, GithubEvent } from "@workspace/api-client-react";
import { format, subDays } from "date-fns";

export interface ConsistencyData {
  activeDays365: number;
  longestStreak: number;
  currentStreak: number;
  weekdayRatio: number;
  weeklyData: { week: string; count: number }[];
  rating: "Exceptional" | "Strong" | "Moderate" | "Sporadic";
}

export interface CollaborationData {
  prEvents: number;
  prReviewEvents: number;
  issueEvents: number;
  issueCommentEvents: number;
  crossRepoEvents: number;
  rating: "High" | "Moderate" | "Low" | "None";
}

export interface ExecutiveSummary {
  overallScore: number;
  verdict: "Strong Hire" | "Promising" | "Needs Review" | "Pass";
  verdictColor: "success" | "warning" | "danger";
  headline: string;
  summaryParagraph: string;
  strengths: string[];
  concerns: string[];
}

export function getConsistencyData(events: GithubEvent[], username: string): ConsistencyData {
  const contributions = events.filter(
    (e) =>
      e.type === "PushEvent" ||
      e.type === "PullRequestEvent" ||
      e.type === "IssueCommentEvent" ||
      e.type === "PullRequestReviewEvent",
  );

  const activeDaySet = new Set<string>();
  let weekdayCount = 0;
  let totalCount = 0;

  contributions.forEach((event) => {
    if (event.created_at) {
      const date = new Date(event.created_at);
      const dateKey = format(date, "yyyy-MM-dd");
      activeDaySet.add(dateKey);
      totalCount++;
      const day = date.getDay();
      if (day >= 1 && day <= 5) weekdayCount++;
    }
  });

  const now = new Date();
  let longestStreak = 0;
  let currentStreak = 0;
  let tempStreak = 0;
  let currentStreakCounting = true;

  for (let i = 0; i < 365; i++) {
    const dayKey = format(subDays(now, i), "yyyy-MM-dd");
    if (activeDaySet.has(dayKey)) {
      tempStreak++;
      if (currentStreakCounting) currentStreak = tempStreak;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      currentStreakCounting = false;
      tempStreak = 0;
    }
  }

  // 52-week bar chart
  const weeklyData: { week: string; count: number }[] = [];
  for (let w = 51; w >= 0; w--) {
    let count = 0;
    for (let d = 0; d < 7; d++) {
      const dayKey = format(subDays(now, w * 7 + d), "yyyy-MM-dd");
      if (activeDaySet.has(dayKey)) count++;
    }
    const weekStart = subDays(now, w * 7 + 6);
    weeklyData.push({ week: format(weekStart, "MMM d"), count });
  }

  void username;

  const activeDays365 = activeDaySet.size;
  let rating: ConsistencyData["rating"];
  if (activeDays365 >= 120) rating = "Exceptional";
  else if (activeDays365 >= 60) rating = "Strong";
  else if (activeDays365 >= 20) rating = "Moderate";
  else rating = "Sporadic";

  return {
    activeDays365,
    longestStreak,
    currentStreak,
    weekdayRatio: totalCount > 0 ? weekdayCount / totalCount : 0,
    weeklyData,
    rating,
  };
}

export function getCollaborationData(events: GithubEvent[], username: string): CollaborationData {
  let prEvents = 0;
  let prReviewEvents = 0;
  let issueEvents = 0;
  let issueCommentEvents = 0;
  let crossRepoEvents = 0;

  events.forEach((event) => {
    const isOwnRepo =
      event.repo?.name.toLowerCase().startsWith(username.toLowerCase() + "/") ?? true;

    if (event.type === "PullRequestEvent") prEvents++;
    if (event.type === "PullRequestReviewEvent") prReviewEvents++;
    if (event.type === "IssuesEvent") issueEvents++;
    if (event.type === "IssueCommentEvent") issueCommentEvents++;
    if (!isOwnRepo) crossRepoEvents++;
  });

  const total = prEvents + prReviewEvents + issueEvents + issueCommentEvents;
  let rating: CollaborationData["rating"];
  if (total >= 20 || crossRepoEvents >= 10) rating = "High";
  else if (total >= 8 || crossRepoEvents >= 3) rating = "Moderate";
  else if (total >= 2) rating = "Low";
  else rating = "None";

  return { prEvents, prReviewEvents, issueEvents, issueCommentEvents, crossRepoEvents, rating };
}

export function generateExecutiveSummary(
  profile: GithubProfile,
  repos: GithubRepo[] | null,
  events: GithubEvent[] | null,
  consistency: ConsistencyData | null,
  collaboration: CollaborationData | null,
): ExecutiveSummary {
  const strengths: string[] = [];
  const concerns: string[] = [];

  const safeRepos = repos ?? [];
  const totalStars = safeRepos.reduce((a, r) => a + (r.stargazers_count || 0), 0);
  const ownedRepos = safeRepos.filter((r) => !r.fork);
  const followers = profile.followers || 0;

  let activityScore = 0;
  let qualityScore = 0;
  let communityScore = 0;
  let collaborationScore = 0;

  if (consistency) {
    activityScore = Math.min(25, Math.round((consistency.activeDays365 / 200) * 25));
    if (consistency.longestStreak >= 14) strengths.push(`${consistency.longestStreak}-day coding streak`);
    if (consistency.rating === "Exceptional" || consistency.rating === "Strong") {
      strengths.push(`${consistency.activeDays365} active days in the past year`);
    } else if (consistency.rating === "Sporadic") {
      concerns.push("Infrequent public contribution activity");
    }
  }

  if (safeRepos.length > 0) {
    const topScores = ownedRepos
      .map((r) => {
        let s = Math.min((r.stargazers_count || 0) * 5, 40);
        s += Math.min((r.forks_count || 0) * 3, 20);
        if (r.has_readme === true) s += 20;
        if (r.description) s += 10;
        return Math.min(s, 100);
      })
      .sort((a, b) => b - a)
      .slice(0, 3);
    qualityScore = Math.min(25, Math.round((topScores.reduce((a, b) => a + b, 0) / (topScores.length * 100)) * 25));
  }

  if (totalStars > 0) {
    communityScore = Math.min(25, Math.round((Math.log10(totalStars + 1) / 5) * 25));
    if (totalStars > 1000) strengths.push(`${totalStars.toLocaleString()} stars across public repos`);
    else if (totalStars > 100) strengths.push(`${totalStars} stars across public repos`);
  }

  if (followers > 500) strengths.push(`${followers.toLocaleString()} GitHub followers`);

  if (collaboration) {
    collaborationScore = Math.min(25, Math.round(((collaboration.prReviewEvents + collaboration.crossRepoEvents) / 20) * 25));
    if (collaboration.rating === "High" || collaboration.rating === "Moderate") {
      strengths.push(`Active collaborator — ${collaboration.crossRepoEvents} cross-repo contributions`);
    }
    if (collaboration.prReviewEvents > 5) {
      strengths.push(`${collaboration.prReviewEvents} pull request reviews`);
    }
  }

  if (ownedRepos.length === 0) {
    concerns.push("No original public repositories");
  } else if (ownedRepos.length < 3) {
    concerns.push("Limited number of original projects");
  }

  if (profile.public_repos && profile.public_repos > 0) {
    const forkRatio = safeRepos.filter((r) => r.fork).length / safeRepos.length;
    if (forkRatio > 0.7) concerns.push("Portfolio is primarily forks, not original work");
  }

  const overallScore = Math.min(100, activityScore + qualityScore + communityScore + collaborationScore);

  let verdict: ExecutiveSummary["verdict"];
  let verdictColor: ExecutiveSummary["verdictColor"];
  if (overallScore >= 65) { verdict = "Strong Hire"; verdictColor = "success"; }
  else if (overallScore >= 40) { verdict = "Promising"; verdictColor = "success"; }
  else if (overallScore >= 20) { verdict = "Needs Review"; verdictColor = "warning"; }
  else { verdict = "Pass"; verdictColor = "danger"; }

  const primaryLang = safeRepos
    .filter((r) => r.language && !r.fork)
    .reduce((acc: Record<string, number>, r) => {
      if (r.language) acc[r.language] = (acc[r.language] || 0) + 1;
      return acc;
    }, {});
  const topLang = Object.entries(primaryLang).sort(([, a], [, b]) => b - a)[0]?.[0];

  const memberSince = profile.created_at ? new Date(profile.created_at).getFullYear() : null;
  const yearsActive = memberSince ? new Date().getFullYear() - memberSince : 0;

  const headline = buildHeadline(profile, topLang, totalStars, followers, yearsActive, consistency);
  const summaryParagraph = buildParagraph(profile, ownedRepos, totalStars, consistency, collaboration, topLang, yearsActive);

  void events;
  return { overallScore, verdict, verdictColor, headline, summaryParagraph, strengths, concerns };
}

function buildHeadline(
  profile: GithubProfile,
  topLang: string | undefined,
  totalStars: number,
  followers: number,
  yearsActive: number,
  consistency: ConsistencyData | null,
): string {
  const parts: string[] = [];

  if (consistency?.rating === "Exceptional") parts.push("Highly prolific");
  else if (consistency?.rating === "Strong") parts.push("Consistently active");
  else if (yearsActive >= 8) parts.push("Experienced");

  if (totalStars > 5000) parts.push("influential open-source");
  else if (totalStars > 500) parts.push("active open-source");

  if (topLang) parts.push(`${topLang} developer`);
  else parts.push("software developer");

  if (followers > 1000) parts.push(`with ${followers.toLocaleString()} followers`);

  const name = profile.name || profile.login;
  return `${name} — ${parts.join(" ")}`;
}

function buildParagraph(
  profile: GithubProfile,
  ownedRepos: GithubRepo[],
  totalStars: number,
  consistency: ConsistencyData | null,
  collaboration: CollaborationData | null,
  topLang: string | undefined,
  yearsActive: number,
): string {
  const sentences: string[] = [];

  const memberSince = profile.created_at ? new Date(profile.created_at).getFullYear() : null;
  const tenure = memberSince
    ? yearsActive >= 5
      ? `a ${yearsActive}-year GitHub veteran`
      : `a GitHub member since ${memberSince}`
    : "";

  const langPart = topLang ? `, primarily working in ${topLang}` : "";
  sentences.push(
    `${profile.name || profile.login} is ${tenure}${langPart}, with ${ownedRepos.length} original public ${ownedRepos.length === 1 ? "repository" : "repositories"}${totalStars > 0 ? ` and ${totalStars.toLocaleString()} total stars` : ""}.`,
  );

  if (consistency) {
    if (consistency.rating === "Exceptional" || consistency.rating === "Strong") {
      sentences.push(
        `Their contribution history shows ${consistency.activeDays365} active days in the past 12 months, with a longest coding streak of ${consistency.longestStreak} days — indicative of disciplined, consistent engineering habits.`,
      );
    } else if (consistency.rating === "Moderate") {
      sentences.push(
        `They show moderate contribution activity with ${consistency.activeDays365} active days over the past year, suggesting periodic rather than daily engagement.`,
      );
    } else {
      sentences.push(
        `Public contribution activity is sparse, with only ${consistency.activeDays365} active days in the past 12 months, though private work may not be reflected here.`,
      );
    }
  }

  if (collaboration && collaboration.rating !== "None") {
    const parts: string[] = [];
    if (collaboration.crossRepoEvents > 0) parts.push(`${collaboration.crossRepoEvents} cross-repository contributions`);
    if (collaboration.prReviewEvents > 0) parts.push(`${collaboration.prReviewEvents} PR reviews`);
    if (parts.length > 0) {
      sentences.push(`Collaboration signals are ${collaboration.rating.toLowerCase()}: ${parts.join(" and ")} in the available event window.`);
    }
  }

  return sentences.join(" ");
}
