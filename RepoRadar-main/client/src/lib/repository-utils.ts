/**
 * Repository-related utility functions
 * Provides common operations for repository data
 */

/**
 * Extract owner and repo name from GitHub URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate GitHub repository URL
 */
export function isValidGitHubUrl(url: string): boolean {
  const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
  return githubUrlPattern.test(url);
}

/**
 * Build GitHub search query with filters
 */
export interface SearchFilters {
  language?: string;
  minStars?: number;
  maxStars?: number;
  dateRange?: string;
  includeArchived?: boolean;
  includeForked?: boolean;
  hasIssues?: boolean;
  license?: string;
  topics?: string[];
}

export function buildGitHubSearchQuery(searchTerm: string, filters: SearchFilters = {}): string {
  let query = searchTerm;
  
  // Add language filter
  if (filters.language && filters.language !== 'all') {
    query += ` language:${filters.language}`;
  }
  
  // Add star range
  if (filters.minStars && filters.minStars > 0) {
    query += ` stars:>=${filters.minStars}`;
  }
  if (filters.maxStars && filters.maxStars < 100000) {
    query += ` stars:<=${filters.maxStars}`;
  }
  
  // Add date filter
  if (filters.dateRange && filters.dateRange !== 'all') {
    const dateStr = getDateRangeString(filters.dateRange);
    if (dateStr) {
      query += ` created:>=${dateStr}`;
    }
  }
  
  // Add archived filter
  if (filters.includeArchived === false) {
    query += ' archived:false';
  }
  
  // Add fork filter
  if (filters.includeForked === false) {
    query += ' fork:false';
  }
  
  // Add issues filter
  if (filters.hasIssues) {
    query += ' has:issues';
  }
  
  // Add license filter
  if (filters.license && filters.license !== 'all') {
    query += ` license:${filters.license}`;
  }
  
  // Add topics
  if (filters.topics && filters.topics.length > 0) {
    filters.topics.forEach(topic => {
      query += ` topic:${topic}`;
    });
  }
  
  return query;
}

/**
 * Convert date range string to ISO date
 */
function getDateRangeString(dateRange: string): string | null {
  const date = new Date();
  
  switch (dateRange) {
    case 'today':
      date.setDate(date.getDate() - 1);
      break;
    case 'week':
      date.setDate(date.getDate() - 7);
      break;
    case 'month':
      date.setMonth(date.getMonth() - 1);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() - 1);
      break;
    default:
      return null;
  }
  
  return date.toISOString().split('T')[0];
}

/**
 * Get similarity badge color based on percentage
 */
export function getSimilarityBadgeColor(similarity: number): string {
  if (similarity >= 80) return 'bg-green-600';
  if (similarity >= 60) return 'bg-yellow-600';
  return 'bg-orange-600';
}

/**
 * Normalize repository data from different API responses
 */
export interface NormalizedRepository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  watchers: number;
  htmlUrl: string;
  topics: string[];
  updatedAt: Date | null;
}

export function normalizeRepository(repo: any): NormalizedRepository {
  return {
    id: repo.id?.toString() || '',
    name: repo.name || '',
    fullName: repo.fullName || repo.full_name || '',
    owner: repo.owner || repo.fullName?.split('/')[0] || '',
    description: repo.description || null,
    language: repo.language || null,
    stars: repo.stars || repo.stargazers_count || 0,
    forks: repo.forks || repo.forks_count || 0,
    watchers: repo.watchers || repo.watchers_count || 0,
    htmlUrl: repo.htmlUrl || repo.html_url || '',
    topics: repo.topics || [],
    updatedAt: repo.updatedAt || repo.updated_at ? new Date(repo.updatedAt || repo.updated_at) : null,
  };
}
