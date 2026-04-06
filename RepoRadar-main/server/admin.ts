import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, checkDatabaseHealth } from './db';
import { analyticsEvents } from '../shared/schema';
import { sql, desc, count, and, gte, lte } from 'drizzle-orm';

/**
 * Admin authentication middleware
 * Checks if the user has admin privileges
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Check for admin authentication
  // In production, this should check against a proper admin role/permission system
  const adminToken = req.headers['x-admin-token'] as string;
  
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }
  
  next();
}

/**
 * Health metrics endpoint
 * Returns database, cache, and API status
 */
export async function getHealthMetrics(req: Request, res: Response): Promise<void> {
  try {
    const startTime = Date.now();
    
    // Check database health
    const dbHealth = await checkDatabaseHealth();
    
    // Check cache health (Redis would go here when implemented)
    const cacheHealth = {
      status: 'not_implemented' as const,
      responseTime: 0,
      details: 'Redis not yet implemented',
    };
    
    // Check API health (basic check)
    const apiHealth = {
      status: 'healthy' as const,
      responseTime: Date.now() - startTime,
    };
    
    const overallStatus = dbHealth.status === 'healthy' ? 'healthy' : 'degraded';
    
    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbHealth.status,
          responseTime: dbHealth.responseTime,
          details: dbHealth.details,
        },
        cache: cacheHealth,
        api: apiHealth,
      },
    });
  } catch (error) {
    console.error('Error fetching health metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch health metrics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * System metrics endpoint
 * Returns response times, error rates, and resource usage
 */
export async function getSystemMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 24 hours if not specified
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate 
      ? new Date(endDate as string) 
      : new Date();
    
    // Get error events from analytics
    const errorEvents = await db
      .select({
        count: count(),
        hour: sql<string>`date_trunc('hour', ${analyticsEvents.timestamp})`,
      })
      .from(analyticsEvents)
      .where(
        and(
          sql`${analyticsEvents.eventCategory} = 'error'`,
          gte(analyticsEvents.timestamp, start),
          lte(analyticsEvents.timestamp, end)
        )
      )
      .groupBy(sql`date_trunc('hour', ${analyticsEvents.timestamp})`)
      .orderBy(sql`date_trunc('hour', ${analyticsEvents.timestamp})`);
    
    // Get total events for error rate calculation
    const totalEvents = await db
      .select({ count: count() })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, start),
          lte(analyticsEvents.timestamp, end)
        )
      );
    
    const totalCount = totalEvents[0]?.count || 0;
    const errorCount = errorEvents.reduce((sum, e) => sum + Number(e.count), 0);
    const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;
    
    // Get resource usage (Node.js process metrics)
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      timestamp: new Date().toISOString(),
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      metrics: {
        errorRate: parseFloat(errorRate.toFixed(2)),
        totalEvents: totalCount,
        errorEvents: errorCount,
        errorsByHour: errorEvents.map(e => ({
          hour: e.hour,
          count: Number(e.count),
        })),
      },
      resources: {
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        uptime: Math.round(process.uptime()), // seconds
      },
    });
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch system metrics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * User activity endpoint
 * Returns active users and feature usage
 */
export async function getUserActivity(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 24 hours if not specified
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate 
      ? new Date(endDate as string) 
      : new Date();
    
    // Get unique sessions (active users)
    const activeSessions = await db
      .select({
        sessionId: analyticsEvents.sessionId,
        userId: analyticsEvents.userId,
        firstSeen: sql<Date>`MIN(${analyticsEvents.timestamp})`,
        lastSeen: sql<Date>`MAX(${analyticsEvents.timestamp})`,
        eventCount: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, start),
          lte(analyticsEvents.timestamp, end)
        )
      )
      .groupBy(analyticsEvents.sessionId, analyticsEvents.userId);
    
    // Get feature usage by event name
    const featureUsage = await db
      .select({
        feature: analyticsEvents.eventName,
        count: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, start),
          lte(analyticsEvents.timestamp, end)
        )
      )
      .groupBy(analyticsEvents.eventName)
      .orderBy(desc(count()));
    
    // Get event categories
    const categoryUsage = await db
      .select({
        category: analyticsEvents.eventCategory,
        count: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, start),
          lte(analyticsEvents.timestamp, end)
        )
      )
      .groupBy(analyticsEvents.eventCategory)
      .orderBy(desc(count()));
    
    // Calculate engagement metrics
    const uniqueUsers = new Set(
      activeSessions
        .filter(s => s.userId)
        .map(s => s.userId)
    ).size;
    
    const totalSessions = activeSessions.length;
    const avgEventsPerSession = totalSessions > 0
      ? activeSessions.reduce((sum, s) => sum + Number(s.eventCount), 0) / totalSessions
      : 0;
    
    res.json({
      timestamp: new Date().toISOString(),
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      activity: {
        activeSessions: totalSessions,
        uniqueUsers,
        avgEventsPerSession: parseFloat(avgEventsPerSession.toFixed(2)),
      },
      features: featureUsage.map(f => ({
        name: f.feature,
        usage: Number(f.count),
      })),
      categories: categoryUsage.map(c => ({
        name: c.category,
        usage: Number(c.count),
      })),
      sessions: activeSessions.slice(0, 100).map(s => ({
        sessionId: s.sessionId,
        userId: s.userId,
        firstSeen: s.firstSeen,
        lastSeen: s.lastSeen,
        eventCount: Number(s.eventCount),
      })),
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user activity',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Analytics query endpoint with time-series data
 * Returns analytics data aggregated by time intervals
 */
export async function getAnalyticsTimeSeries(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate, interval = 'hour', eventName, category } = req.query;
    
    // Default to last 24 hours if not specified
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate 
      ? new Date(endDate as string) 
      : new Date();
    
    // Validate interval
    const validIntervals = ['hour', 'day', 'week', 'month'];
    const timeInterval = validIntervals.includes(interval as string) ? interval as string : 'hour';
    
    // Build query conditions
    const conditions = [
      gte(analyticsEvents.timestamp, start),
      lte(analyticsEvents.timestamp, end),
    ];
    
    if (eventName) {
      conditions.push(sql`${analyticsEvents.eventName} = ${eventName}`);
    }
    
    if (category) {
      conditions.push(sql`${analyticsEvents.eventCategory} = ${category}`);
    }
    
    // Get time-series data
    const timeSeries = await db
      .select({
        period: sql<string>`date_trunc('${sql.raw(timeInterval)}', ${analyticsEvents.timestamp})`,
        count: count(),
        uniqueSessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${analyticsEvents.userId})`,
      })
      .from(analyticsEvents)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('${sql.raw(timeInterval)}', ${analyticsEvents.timestamp})`)
      .orderBy(sql`date_trunc('${sql.raw(timeInterval)}', ${analyticsEvents.timestamp})`);
    
    // Get summary statistics
    const summary = await db
      .select({
        totalEvents: count(),
        uniqueSessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${analyticsEvents.userId})`,
      })
      .from(analyticsEvents)
      .where(and(...conditions));
    
    res.json({
      timestamp: new Date().toISOString(),
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        interval: timeInterval,
      },
      filters: {
        eventName: eventName || null,
        category: category || null,
      },
      summary: {
        totalEvents: Number(summary[0]?.totalEvents || 0),
        uniqueSessions: Number(summary[0]?.uniqueSessions || 0),
        uniqueUsers: Number(summary[0]?.uniqueUsers || 0),
      },
      timeSeries: timeSeries.map(t => ({
        period: t.period,
        count: Number(t.count),
        uniqueSessions: Number(t.uniqueSessions),
        uniqueUsers: Number(t.uniqueUsers),
      })),
    });
  } catch (error) {
    console.error('Error fetching analytics time series:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics time series',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Log viewer endpoint with search and filtering
 * Returns recent analytics events with filtering capabilities
 */
export async function getLogViewer(req: Request, res: Response): Promise<void> {
  try {
    const { 
      startDate, 
      endDate, 
      eventName, 
      category, 
      userId, 
      sessionId,
      limit = '100',
      offset = '0',
    } = req.query;
    
    // Default to last 24 hours if not specified
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate 
      ? new Date(endDate as string) 
      : new Date();
    
    // Build query conditions
    const conditions = [
      gte(analyticsEvents.timestamp, start),
      lte(analyticsEvents.timestamp, end),
    ];
    
    if (eventName) {
      conditions.push(sql`${analyticsEvents.eventName} = ${eventName}`);
    }
    
    if (category) {
      conditions.push(sql`${analyticsEvents.eventCategory} = ${category}`);
    }
    
    if (userId) {
      conditions.push(sql`${analyticsEvents.userId} = ${userId}`);
    }
    
    if (sessionId) {
      conditions.push(sql`${analyticsEvents.sessionId} = ${sessionId}`);
    }
    
    // Get total count for pagination
    const totalCount = await db
      .select({ count: count() })
      .from(analyticsEvents)
      .where(and(...conditions));
    
    // Get paginated logs
    const logs = await db
      .select()
      .from(analyticsEvents)
      .where(and(...conditions))
      .orderBy(desc(analyticsEvents.timestamp))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));
    
    res.json({
      timestamp: new Date().toISOString(),
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      filters: {
        eventName: eventName || null,
        category: category || null,
        userId: userId || null,
        sessionId: sessionId || null,
      },
      pagination: {
        total: Number(totalCount[0]?.count || 0),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
      logs: logs.map(log => ({
        id: log.id,
        eventName: log.eventName,
        eventCategory: log.eventCategory,
        properties: log.properties,
        userId: log.userId,
        sessionId: log.sessionId,
        timestamp: log.timestamp,
      })),
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch logs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Data export endpoint
 * Exports analytics data in CSV or JSON format
 */
export async function exportData(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate, format = 'json', eventName, category } = req.query;
    
    // Default to last 24 hours if not specified
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate 
      ? new Date(endDate as string) 
      : new Date();
    
    // Build query conditions
    const conditions = [
      gte(analyticsEvents.timestamp, start),
      lte(analyticsEvents.timestamp, end),
    ];
    
    if (eventName) {
      conditions.push(sql`${analyticsEvents.eventName} = ${eventName}`);
    }
    
    if (category) {
      conditions.push(sql`${analyticsEvents.eventCategory} = ${category}`);
    }
    
    // Get all matching events
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(and(...conditions))
      .orderBy(desc(analyticsEvents.timestamp));
    
    if (format === 'csv') {
      // Convert to CSV
      const headers = ['ID', 'Event Name', 'Category', 'User ID', 'Session ID', 'Timestamp', 'Properties'];
      const rows = events.map(e => [
        e.id,
        e.eventName,
        e.eventCategory,
        e.userId || '',
        e.sessionId,
        e.timestamp.toISOString(),
        JSON.stringify(e.properties || {}),
      ]);
      
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      // Return as JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.json"`);
      res.json({
        exportDate: new Date().toISOString(),
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        filters: {
          eventName: eventName || null,
          category: category || null,
        },
        totalEvents: events.length,
        events: events.map(e => ({
          id: e.id,
          eventName: e.eventName,
          eventCategory: e.eventCategory,
          properties: e.properties,
          userId: e.userId,
          sessionId: e.sessionId,
          timestamp: e.timestamp,
        })),
      });
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ 
      error: 'Failed to export data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create admin router with all endpoints
 */
export function createAdminRouter(): Router {
  const router = Router();
  
  // Apply admin authentication to all routes
  router.use(requireAdmin);
  
  // Health metrics
  router.get('/health-metrics', getHealthMetrics);
  
  // System metrics
  router.get('/system-metrics', getSystemMetrics);
  
  // User activity
  router.get('/user-activity', getUserActivity);
  
  // Analytics time series
  router.get('/analytics/time-series', getAnalyticsTimeSeries);
  
  // Log viewer
  router.get('/logs', getLogViewer);
  
  // Data export
  router.get('/export', exportData);
  
  // Rate limit violations
  router.get('/rate-limit-violations', getRateLimitViolations);
  
  return router;
}

/**
 * Get rate limit violations for security monitoring
 */
async function getRateLimitViolations(req: Request, res: Response): Promise<void> {
  try {
    const { getRateLimitViolations: getViolations } = await import('./middleware/rateLimiter');
    const limit = parseInt(req.query.limit as string) || 100;
    
    const violations = getViolations(limit);
    
    res.json({
      violations,
      total: violations.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching rate limit violations:', error);
    res.status(500).json({ error: 'Failed to fetch rate limit violations' });
  }
}
