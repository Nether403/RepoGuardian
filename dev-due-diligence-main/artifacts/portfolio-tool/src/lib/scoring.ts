import { GithubProfile, GithubRepo, GithubEvent } from "@workspace/api-client-react";
import { format, subDays, isAfter } from "date-fns";

export interface RepoScore extends GithubRepo {
  qualityScore: number;
}

export interface Flag {
  type: "success" | "danger";
  label: string;
  desc: string;
}

export interface LanguageStat {
  name: string;
  value: number;
  fill: string;
}

const COLORS = [
  "hsl(199, 89%, 48%)", // Primary cyan
  "hsl(250, 89%, 65%)", // Accent indigo
  "hsl(160, 84%, 39%)", // Success emerald
  "hsl(43, 96%, 56%)",  // Warning yellow
  "hsl(326, 100%, 74%)",// Pink
  "hsl(240, 5%, 65%)",  // Gray
];

export function calculateRepoScore(repo: GithubRepo): number {
  let score = 0;
  
  // Base metrics
  score += Math.min((repo.stargazers_count || 0) * 5, 40);
  score += Math.min((repo.forks_count || 0) * 3, 20);
  
  // Documentation (null means unchecked — no penalty, no bonus)
  if (repo.has_readme === true) score += 20;
  if (repo.description && repo.description.length > 10) score += 10;
  
  // Recency
  if (repo.pushed_at) {
    const pushDate = new Date(repo.pushed_at);
    const daysAgo = (new Date().getTime() - pushDate.getTime()) / (1000 * 3600 * 24);
    if (daysAgo < 30) score += 10;
    else if (daysAgo < 90) score += 5;
    else if (daysAgo > 365) score -= 10;
  }
  
  // Penalties
  if (repo.archived) score -= 20;
  if (repo.fork) score -= 15;

  return Math.max(0, Math.min(score, 100)); // Clamp 0-100
}

export function getRankedRepos(repos: GithubRepo[]): RepoScore[] {
  const scored = repos
    .filter(r => !r.fork) // Exclude forks from top highlights usually
    .map(r => ({ ...r, qualityScore: calculateRepoScore(r) }));
  
  return scored.sort((a, b) => b.qualityScore - a.qualityScore).slice(0, 8);
}

export function getTopLanguages(repos: GithubRepo[]): LanguageStat[] {
  const counts: Record<string, number> = {};
  
  repos.forEach(repo => {
    if (repo.language && !repo.fork) {
      counts[repo.language] = (counts[repo.language] || 0) + 1;
    }
  });

  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return sorted.map(([name, value], idx) => ({
    name,
    value,
    fill: COLORS[idx % COLORS.length]
  }));
}

export function getActivityData(events: GithubEvent[]) {
  const days = 365;
  const data: Record<string, number> = {};
  
  // Initialize last 365 days
  for (let i = days - 1; i >= 0; i--) {
    data[format(subDays(new Date(), i), 'MMM dd')] = 0;
  }

  events.forEach(event => {
    if (event.type === 'PushEvent' || event.type === 'PullRequestEvent') {
      if (event.created_at) {
        const dateKey = format(new Date(event.created_at), 'MMM dd');
        if (data[dateKey] !== undefined) {
          data[dateKey]++;
        }
      }
    }
  });

  return Object.entries(data).map(([date, count]) => ({ date, count }));
}

export function evaluateFlags(
  profile: GithubProfile,
  repos: GithubRepo[] | null,
  events: GithubEvent[] | null,
): Flag[] {
  const flags: Flag[] = [];

  if (events === null) {
    flags.push({ type: 'danger', label: 'Activity Data Unavailable', desc: 'Could not retrieve recent event data from GitHub.' });
  } else {
    const pushEvents = events.filter(e => e.type === 'PushEvent' || e.type === 'PullRequestEvent');
    if (pushEvents.length > 30) {
      flags.push({ type: 'success', label: 'Highly Active', desc: `${pushEvents.length} contributions in public repos recently.` });
    } else if (pushEvents.length > 5) {
      flags.push({ type: 'success', label: 'Active Contributor', desc: 'Consistent recent public activity.' });
    } else {
      flags.push({ type: 'danger', label: 'Low Recent Activity', desc: 'Fewer than 5 public contributions visible in the event window.' });
    }
  }

  if (repos === null) {
    flags.push({ type: 'danger', label: 'Repository Data Unavailable', desc: 'Could not retrieve repository data from GitHub.' });
    return flags;
  }

  const totalStars = repos.reduce((acc, r) => acc + (r.stargazers_count || 0), 0);
  const checkedRepos = repos.filter(r => r.has_readme !== null);
  const reposWithReadme = checkedRepos.filter(r => r.has_readme).length;
  const isForkCount = repos.filter(r => r.fork).length;

  if (totalStars > 100) {
    flags.push({ type: 'success', label: 'Strong Open Source Impact', desc: `${totalStars} total stars across repositories.` });
  }

  if (checkedRepos.length > 0 && (reposWithReadme / checkedRepos.length) > 0.7) {
    flags.push({ type: 'success', label: 'Well-Documented', desc: '>70% of checked repositories have READMEs.' });
  }

  if (repos.length === 0) {
    flags.push({ type: 'danger', label: 'No Public Repos', desc: 'Cannot assess code quality without public repositories.' });
  } else if (isForkCount / repos.length > 0.6) {
    flags.push({ type: 'danger', label: 'Mostly Forks', desc: 'Over 60% of repositories are forks. Original work may be limited.' });
  }

  const mostRecentPush = repos
    .map(r => r.pushed_at ? new Date(r.pushed_at) : new Date(0))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (mostRecentPush && !isAfter(mostRecentPush, subDays(new Date(), 180))) {
    flags.push({ type: 'danger', label: 'Dormant Profile', desc: 'No repository pushes in the last 6 months.' });
  }

  // Deeper red flag: trivial portfolio
  const ownedRepos = repos.filter(r => !r.fork && !r.archived);
  if (ownedRepos.length >= 5) {
    const trivialCount = ownedRepos.filter(r =>
      (r.stargazers_count || 0) < 5 &&
      !r.description &&
      (r.topics || []).length === 0
    ).length;
    if (trivialCount / ownedRepos.length > 0.7) {
      flags.push({ type: 'danger', label: 'Trivial Portfolio', desc: 'Most repositories have no description, stars, or topics — may lack production-quality work.' });
    }
  }

  // Deeper red flag: stale codebase
  if (ownedRepos.length >= 5) {
    const twoYearsAgo = subDays(new Date(), 730);
    const staleCount = ownedRepos.filter(r =>
      r.pushed_at && !isAfter(new Date(r.pushed_at), twoYearsAgo)
    ).length;
    if (staleCount / ownedRepos.length > 0.8) {
      flags.push({ type: 'danger', label: 'Stale Codebase', desc: 'Over 80% of original repositories have not been updated in 2+ years.' });
    }
  }

  // Deeper red flag: no language diversity
  const languages = new Set(repos.filter(r => !r.fork && r.language).map(r => r.language));
  if (ownedRepos.length >= 6 && languages.size === 1) {
    const [onlyLang] = languages;
    flags.push({ type: 'danger', label: 'Low Tech Diversity', desc: `All repositories use a single language (${onlyLang}). Consider broadening or check if specialisation is intentional.` });
  } else if (languages.size >= 5) {
    flags.push({ type: 'success', label: 'Polyglot Engineer', desc: `Uses ${languages.size} different programming languages across repositories.` });
  }

  // Positive: long-tenure contributor
  if (profile.created_at) {
    const yearsActive = (new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 3600 * 24 * 365);
    if (yearsActive >= 8) {
      flags.push({ type: 'success', label: 'Long-Tenured Contributor', desc: `${Math.floor(yearsActive)}-year GitHub veteran with an established track record.` });
    }
  }

  return flags;
}
