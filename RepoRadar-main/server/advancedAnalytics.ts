import { db } from "./db";
import { 
  repositoryAnalyses, 
  repositories, 
  users,
  dailyAnalytics,
  languageAnalytics,
  apiUsage,
  userActivities
} from "@shared/schema";
import { sql, desc, eq, gte, and, count, avg } from "drizzle-orm";

export interface AdvancedAnalyticsData {
  overview: {
    totalAnalyses: number;
    averageScore: number;
    trendsUp: number;
    activeRepositories: number;
    teamMembers: number;
    apiCalls: number;
  };
  scoreDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    analyses: number;
    avgScore: number;
    repositories: number;
  }>;
  languageDistribution: Array<{
    name: string;
    value: number;
    percentage: number;
  }>;
  metricTrends: {
    [key: string]: {
      current: number;
      previous: number;
      trend: "up" | "down" | "stable";
    };
  };
  topPerformers: Array<{
    name: string;
    score: number;
    language: string;
    stars: number;
  }>;
  radarData: Array<{
    metric: string;
    A: number;
    B: number;
    fullMark: number;
  }>;
}

/**
 * Get the date range based on time range string
 */
function getDateRange(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Get previous period date range for comparison
 */
function getPreviousPeriodRange(timeRange: string): { start: Date; end: Date } {
  const currentStart = getDateRange(timeRange);
  const now = new Date();
  const periodLength = now.getTime() - currentStart.getTime();
  
  return {
    start: new Date(currentStart.getTime() - periodLength),
    end: currentStart
  };
}

/**
 * Get comprehensive analytics data
 */
export async function getAdvancedAnalytics(timeRange: string = "30d"): Promise<AdvancedAnalyticsData> {
  const startDate = getDateRange(timeRange);
  const previousPeriod = getPreviousPeriodRange(timeRange);

  // Fetch overview metrics
  const [overviewData] = await db
    .select({
      totalAnalyses: count(repositoryAnalyses.id),
      avgScore: avg(repositoryAnalyses.overallScore),
    })
    .from(repositoryAnalyses)
    .where(gte(repositoryAnalyses.createdAt, sql`${startDate}`));

  // Get previous period data for trend calculation
  const [previousData] = await db
    .select({
      totalAnalyses: count(repositoryAnalyses.id),
    })
    .from(repositoryAnalyses)
    .where(
      and(
        gte(repositoryAnalyses.createdAt, sql`${previousPeriod.start}`),
        gte(sql`${previousPeriod.end}`, repositoryAnalyses.createdAt)
      )
    );

  // Calculate trend percentage
  const trendsUp = previousData?.totalAnalyses 
    ? ((overviewData.totalAnalyses - previousData.totalAnalyses) / previousData.totalAnalyses) * 100
    : 0;

  // Get active repositories count
  const [repoCount] = await db
    .select({ count: count(repositories.id) })
    .from(repositories)
    .where(gte(repositories.lastAnalyzed, startDate));

  // Get active users count
  const [userCount] = await db
    .select({ count: count(users.id) })
    .from(users)
    .where(gte(users.updatedAt, startDate));

  // Get API calls (if apiUsage table has data)
  const [apiCallsData] = await db
    .select({ count: count(apiUsage.id) })
    .from(apiUsage)
    .where(gte(apiUsage.timestamp, startDate))
    .catch(() => [{ count: 0 }]);

  // Get score distribution
  const scoreDistribution = await getScoreDistribution(startDate);

  // Get time series data
  const timeSeriesData = await getTimeSeriesData(startDate);

  // Get language distribution
  const languageDistribution = await getLanguageDistribution(startDate);

  // Get metric trends
  const metricTrends = await getMetricTrends(startDate, previousPeriod);

  // Get top performers
  const topPerformers = await getTopPerformers(startDate);

  // Get radar data for metric comparison
  const radarData = await getRadarData(startDate, previousPeriod);

  return {
    overview: {
      totalAnalyses: overviewData.totalAnalyses || 0,
      averageScore: Math.round((Number(overviewData.avgScore) || 0) * 10) / 10,
      trendsUp: Math.round(trendsUp * 10) / 10,
      activeRepositories: repoCount.count || 0,
      teamMembers: userCount.count || 0,
      apiCalls: apiCallsData?.count || 0,
    },
    scoreDistribution,
    timeSeriesData,
    languageDistribution,
    metricTrends,
    topPerformers,
    radarData,
  };
}

/**
 * Get score distribution across ranges
 */
async function getScoreDistribution(startDate: Date) {
  const analyses = await db
    .select({ score: repositoryAnalyses.overallScore })
    .from(repositoryAnalyses)
    .where(gte(repositoryAnalyses.createdAt, startDate));

  const total = analyses.length;
  const ranges = [
    { range: "0-20", min: 0, max: 20, count: 0 },
    { range: "21-40", min: 21, max: 40, count: 0 },
    { range: "41-60", min: 41, max: 60, count: 0 },
    { range: "61-80", min: 61, max: 80, count: 0 },
    { range: "81-100", min: 81, max: 100, count: 0 },
  ];

  analyses.forEach(({ score }) => {
    const range = ranges.find(r => score >= r.min && score <= r.max);
    if (range) range.count++;
  });

  return ranges.map(r => ({
    range: r.range,
    count: r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
  }));
}

/**
 * Get time series data for charts
 */
async function getTimeSeriesData(startDate: Date) {
  const dailyData = await db
    .select({
      date: dailyAnalytics.date,
      analyses: dailyAnalytics.totalAnalyses,
      avgScore: dailyAnalytics.avgScore,
      repositories: dailyAnalytics.totalRepositories,
    })
    .from(dailyAnalytics)
    .where(gte(dailyAnalytics.date, startDate))
    .orderBy(dailyAnalytics.date);

  // If no aggregated data, fall back to raw data
  if (dailyData.length === 0) {
    return await getRawTimeSeriesData(startDate);
  }

  return dailyData.map(d => ({
    date: new Date(d.date).toLocaleDateString(),
    analyses: d.analyses || 0,
    avgScore: Math.round((d.avgScore || 0) * 10) / 10,
    repositories: d.repositories || 0,
  }));
}

/**
 * Fallback: Get time series from raw analysis data
 */
async function getRawTimeSeriesData(startDate: Date) {
  const analyses = await db
    .select({
      date: sql<string>`DATE(${repositoryAnalyses.createdAt})`,
      count: count(repositoryAnalyses.id),
      avgScore: avg(repositoryAnalyses.overallScore),
    })
    .from(repositoryAnalyses)
    .where(gte(repositoryAnalyses.createdAt, sql`${startDate}`))
    .groupBy(sql`DATE(${repositoryAnalyses.createdAt})`)
    .orderBy(sql`DATE(${repositoryAnalyses.createdAt})`);

  return analyses.map(a => ({
    date: new Date(a.date).toLocaleDateString(),
    analyses: a.count,
    avgScore: Math.round((Number(a.avgScore) || 0) * 10) / 10,
    repositories: a.count, // Approximate
  }));
}

/**
 * Get language distribution
 */
async function getLanguageDistribution(startDate: Date) {
  const langData = await db
    .select({
      language: repositories.language,
      count: count(repositories.id),
    })
    .from(repositories)
    .innerJoin(repositoryAnalyses, eq(repositories.id, repositoryAnalyses.repositoryId))
    .where(gte(repositoryAnalyses.createdAt, startDate))
    .groupBy(repositories.language)
    .orderBy(desc(count(repositories.id)))
    .limit(6);

  const total = langData.reduce((sum, l) => sum + l.count, 0);

  return langData
    .filter(l => l.language) // Filter out null languages
    .map(l => ({
      name: l.language || "Unknown",
      value: l.count,
      percentage: total > 0 ? Math.round((l.count / total) * 100) : 0,
    }));
}

/**
 * Get metric trends (current vs previous period)
 */
async function getMetricTrends(startDate: Date, previousPeriod: { start: Date; end: Date }) {
  const [currentMetrics] = await db
    .select({
      originality: avg(repositoryAnalyses.originality),
      completeness: avg(repositoryAnalyses.completeness),
      marketability: avg(repositoryAnalyses.marketability),
      monetization: avg(repositoryAnalyses.monetization),
      usefulness: avg(repositoryAnalyses.usefulness),
    })
    .from(repositoryAnalyses)
    .where(gte(repositoryAnalyses.createdAt, sql`${startDate}`));

  const [previousMetrics] = await db
    .select({
      originality: avg(repositoryAnalyses.originality),
      completeness: avg(repositoryAnalyses.completeness),
      marketability: avg(repositoryAnalyses.marketability),
      monetization: avg(repositoryAnalyses.monetization),
      usefulness: avg(repositoryAnalyses.usefulness),
    })
    .from(repositoryAnalyses)
    .where(
      and(
        gte(repositoryAnalyses.createdAt, sql`${previousPeriod.start}`),
        gte(sql`${previousPeriod.end}`, repositoryAnalyses.createdAt)
      )
    );

  const getTrend = (current: number, previous: number): "up" | "down" | "stable" => {
    const diff = current - previous;
    if (Math.abs(diff) < 1) return "stable";
    return diff > 0 ? "up" : "down";
  };

  return {
    originality: {
      current: Math.round(Number(currentMetrics.originality) || 0),
      previous: Math.round(Number(previousMetrics?.originality) || 0),
      trend: getTrend(Number(currentMetrics.originality) || 0, Number(previousMetrics?.originality) || 0),
    },
    completeness: {
      current: Math.round(Number(currentMetrics.completeness) || 0),
      previous: Math.round(Number(previousMetrics?.completeness) || 0),
      trend: getTrend(Number(currentMetrics.completeness) || 0, Number(previousMetrics?.completeness) || 0),
    },
    marketability: {
      current: Math.round(Number(currentMetrics.marketability) || 0),
      previous: Math.round(Number(previousMetrics?.marketability) || 0),
      trend: getTrend(Number(currentMetrics.marketability) || 0, Number(previousMetrics?.marketability) || 0),
    },
    monetization: {
      current: Math.round(Number(currentMetrics.monetization) || 0),
      previous: Math.round(Number(previousMetrics?.monetization) || 0),
      trend: getTrend(Number(currentMetrics.monetization) || 0, Number(previousMetrics?.monetization) || 0),
    },
    usefulness: {
      current: Math.round(Number(currentMetrics.usefulness) || 0),
      previous: Math.round(Number(previousMetrics?.usefulness) || 0),
      trend: getTrend(Number(currentMetrics.usefulness) || 0, Number(previousMetrics?.usefulness) || 0),
    },
  };
}

/**
 * Get top performing repositories
 */
async function getTopPerformers(startDate: Date) {
  const topRepos = await db
    .select({
      name: repositories.name,
      score: repositoryAnalyses.overallScore,
      language: repositories.language,
      stars: repositories.stars,
    })
    .from(repositoryAnalyses)
    .innerJoin(repositories, eq(repositoryAnalyses.repositoryId, repositories.id))
    .where(gte(repositoryAnalyses.createdAt, sql`${startDate}`))
    .orderBy(desc(repositoryAnalyses.overallScore))
    .limit(5);

  return topRepos.map(r => ({
    name: r.name,
    score: Math.round(r.score),
    language: r.language || "Unknown",
    stars: r.stars || 0,
  }));
}

/**
 * Get radar chart data for metric comparison
 */
async function getRadarData(startDate: Date, previousPeriod: { start: Date; end: Date }) {
  const [currentMetrics] = await db
    .select({
      originality: avg(repositoryAnalyses.originality),
      completeness: avg(repositoryAnalyses.completeness),
      marketability: avg(repositoryAnalyses.marketability),
      monetization: avg(repositoryAnalyses.monetization),
      usefulness: avg(repositoryAnalyses.usefulness),
    })
    .from(repositoryAnalyses)
    .where(gte(repositoryAnalyses.createdAt, sql`${startDate}`));

  const [previousMetrics] = await db
    .select({
      originality: avg(repositoryAnalyses.originality),
      completeness: avg(repositoryAnalyses.completeness),
      marketability: avg(repositoryAnalyses.marketability),
      monetization: avg(repositoryAnalyses.monetization),
      usefulness: avg(repositoryAnalyses.usefulness),
    })
    .from(repositoryAnalyses)
    .where(
      and(
        gte(repositoryAnalyses.createdAt, sql`${previousPeriod.start}`),
        gte(sql`${previousPeriod.end}`, repositoryAnalyses.createdAt)
      )
    );

  return [
    {
      metric: "Originality",
      A: Math.round(Number(currentMetrics.originality) || 0),
      B: Math.round(Number(previousMetrics?.originality) || 0),
      fullMark: 100,
    },
    {
      metric: "Completeness",
      A: Math.round(Number(currentMetrics.completeness) || 0),
      B: Math.round(Number(previousMetrics?.completeness) || 0),
      fullMark: 100,
    },
    {
      metric: "Marketability",
      A: Math.round(Number(currentMetrics.marketability) || 0),
      B: Math.round(Number(previousMetrics?.marketability) || 0),
      fullMark: 100,
    },
    {
      metric: "Monetization",
      A: Math.round(Number(currentMetrics.monetization) || 0),
      B: Math.round(Number(previousMetrics?.monetization) || 0),
      fullMark: 100,
    },
    {
      metric: "Usefulness",
      A: Math.round(Number(currentMetrics.usefulness) || 0),
      B: Math.round(Number(previousMetrics?.usefulness) || 0),
      fullMark: 100,
    },
  ];
}

/**
 * Track an analytics event
 */
export async function trackAnalyticsEvent(
  eventName: string,
  eventCategory: string,
  properties: Record<string, any>,
  userId?: string,
  sessionId?: string
) {
  try {
    await db.insert(userActivities).values({
      userId: userId || null,
      action: eventName,
      repositoryId: properties.repositoryId || null,
      metadata: properties,
    });
  } catch (error) {
    console.error("Failed to track analytics event:", error);
  }
}
