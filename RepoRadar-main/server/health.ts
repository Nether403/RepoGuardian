import { Request, Response } from 'express';
import { checkDatabaseHealth } from './db';
import { isStripeEnabled } from './stripe';
import { isGeminiEnabled } from './gemini';
import { redisManager } from './redis';
import { jobQueue } from './jobs/JobQueue';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    memory: CheckResult;
    cpu: CheckResult;
    api?: CheckResult;
    queue?: CheckResult;
  };
  version?: string;
}

interface CheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  usage?: number;
  message?: string;
  details?: Record<string, any>;
}

interface ReadinessStatus {
  status: 'ready' | 'not ready';
  timestamp: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
  };
}

interface LivenessStatus {
  status: 'alive';
  timestamp: string;
  uptime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

/**
 * Overall health check endpoint
 * Returns comprehensive health status of all system components
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export async function healthCheck(_req: Request, res: Response) {
  const startTime = Date.now();
  const timeout = 2000; // 2 second timeout (Requirement 10.4)

  try {
    // Run all health checks with timeout
    const healthPromise = performHealthChecks();
    const timeoutPromise = new Promise<HealthStatus>((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), timeout)
    );

    const health = await Promise.race([healthPromise, timeoutPromise]);

    // Ensure total response time is within 2 seconds (Requirement 10.8)
    const totalTime = Date.now() - startTime;
    if (totalTime > 2000) {
      console.warn(`Health check took ${totalTime}ms, exceeding 2 second limit`);
    }

    // Set HTTP status based on health (Requirement 10.1)
    const httpStatus = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(httpStatus).json(health);
  } catch (error) {
    // If health check times out or fails, return unhealthy status (Requirement 5.4)
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      checks: {
        database: { status: 'unhealthy', latency: 0, message: 'Health check timeout' },
        redis: { status: 'unhealthy', latency: 0, message: 'Health check timeout' },
        memory: { status: 'unhealthy', usage: 0, message: 'Health check timeout' },
        cpu: { status: 'unhealthy', usage: 0, message: 'Health check timeout' },
      },
    });
  }
}

/**
 * Perform all health checks
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
async function performHealthChecks(): Promise<HealthStatus> {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    checks: {
      database: { status: 'unhealthy', latency: 0 },
      redis: { status: 'unhealthy', latency: 0 },
      memory: { status: 'healthy', usage: 0 },
      cpu: { status: 'healthy', usage: 0 },
    },
  };

  // Check database connectivity (Requirement 5.2)
  health.checks.database = await checkDatabase();
  
  // Check Redis connectivity - non-blocking (Requirement 5.3)
  health.checks.redis = await checkRedis();
  
  // Check memory usage (Requirement 5.3)
  health.checks.memory = checkMemory();
  
  // Check CPU usage (Requirement 5.3)
  health.checks.cpu = checkCPU();

  // Check job queue status (Requirement 9.4)
  health.checks.queue = await checkJobQueue();

  // Determine overall health status (Requirement 5.4)
  // Database down = unhealthy
  // Redis down = degraded (non-critical)
  // High memory/CPU = degraded
  // Job queue issues = degraded (non-critical)
  if (health.checks.database.status === 'unhealthy') {
    health.status = 'unhealthy';
  } else if (
    health.checks.redis.status === 'degraded' ||
    health.checks.memory.status === 'degraded' ||
    health.checks.cpu.status === 'degraded' ||
    health.checks.queue?.status === 'degraded'
  ) {
    health.status = 'degraded';
  }

  return health;
}

/**
 * Check database connectivity
 * Requirement 5.2: Verify database connectivity
 * Requirement 2.3: Verify database connectivity via health checks
 */
async function checkDatabase(): Promise<CheckResult> {
  try {
    const health = await checkDatabaseHealth();
    
    if (health.status === 'unhealthy') {
      return {
        status: 'unhealthy',
        latency: health.responseTime,
        message: health.details || 'Database connection failed',
      };
    }
    
    return {
      status: health.responseTime < 100 ? 'healthy' : 'degraded',
      latency: health.responseTime,
      message: health.responseTime >= 100 ? 'High database latency' : undefined,
      details: health.poolStats,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      latency: 0,
      message: error.message || 'Database connection failed',
    };
  }
}

/**
 * Check Redis connectivity (non-blocking)
 * Requirement 5.3: Redis connectivity check (non-blocking)
 * Requirement 3.4: Update health check to report Redis status without failing
 */
async function checkRedis(): Promise<CheckResult> {
  try {
    if (!redisManager.isRedisEnabled()) {
      return {
        status: 'healthy',
        latency: 0,
        message: 'Redis is disabled (using fallback mechanisms)',
        details: {
          enabled: false,
          fallback: 'memory/postgresql',
        },
      };
    }
    
    const healthStatus = await redisManager.getHealthStatus();
    
    // If Redis is down, report as degraded but not unhealthy
    // This allows the application to continue with fallback mechanisms
    if (healthStatus.status === 'down') {
      return {
        status: 'degraded',
        latency: healthStatus.responseTime,
        message: `Redis unavailable (using fallback): ${healthStatus.message || 'Connection failed'}`,
        details: {
          enabled: true,
          connected: false,
          fallback: 'memory/postgresql',
        },
      };
    }
    
    return {
      status: healthStatus.status === 'up' ? 'healthy' : 'degraded',
      latency: healthStatus.responseTime,
      details: {
        enabled: true,
        connected: true,
        fallback: 'none',
      },
    };
  } catch (error: any) {
    // Redis check failure should not fail the health check
    return {
      status: 'degraded',
      latency: 0,
      message: `Redis check failed (using fallback): ${error.message || 'Unknown error'}`,
      details: {
        enabled: true,
        connected: false,
        fallback: 'memory/postgresql',
      },
    };
  }
}

/**
 * Check memory usage
 * Requirement 5.3: Include memory usage metrics
 */
function checkMemory(): CheckResult {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const usagePercent = (heapUsedMB / heapTotalMB) * 100;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  let message: string | undefined;

  // Memory thresholds
  if (usagePercent > 90) {
    status = 'unhealthy';
    message = 'Critical memory usage';
  } else if (usagePercent > 80) {
    status = 'degraded';
    message = 'High memory usage';
  }

  return {
    status,
    usage: Math.round(usagePercent * 10) / 10, // Round to 1 decimal
    message,
    details: {
      heapUsed: Math.round(heapUsedMB),
      heapTotal: Math.round(heapTotalMB),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    },
  };
}

/**
 * Check CPU usage
 * Requirement 5.3: Include CPU usage metrics
 */
function checkCPU(): CheckResult {
  const cpuUsage = process.cpuUsage();
  const totalCPU = cpuUsage.user + cpuUsage.system;
  const uptimeMs = process.uptime() * 1000000; // Convert to microseconds
  const usagePercent = (totalCPU / uptimeMs) * 100;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  let message: string | undefined;

  // CPU thresholds
  if (usagePercent > 90) {
    status = 'unhealthy';
    message = 'Critical CPU usage';
  } else if (usagePercent > 80) {
    status = 'degraded';
    message = 'High CPU usage';
  }

  return {
    status,
    usage: Math.round(usagePercent * 10) / 10, // Round to 1 decimal
    message,
    details: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
  };
}

/**
 * Check API health (external dependencies)
 * Requirement 10.6: API health check
 */
async function checkAPI(): Promise<CheckResult> {
  const startTime = Date.now();
  const details: Record<string, any> = {};

  // Check if critical API dependencies are configured
  const geminiEnabled = isGeminiEnabled();
  const stripeEnabled = isStripeEnabled();

  details.gemini = geminiEnabled ? 'enabled' : 'disabled';
  details.stripe = stripeEnabled ? 'enabled' : 'disabled';

  const latency = Date.now() - startTime;

  // API is considered healthy if at least Gemini is enabled (core functionality)
  if (!geminiEnabled) {
    return {
      status: 'degraded',
      latency,
      message: 'Gemini AI service not configured',
      details,
    };
  }

  return {
    status: 'healthy',
    latency,
    details,
  };
}

/**
 * Check job queue health
 * Requirement 9.4: Add job processing status to health check
 * Requirement 9.5: Gracefully disable jobs when Redis unavailable
 */
async function checkJobQueue(): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    // Check if Redis is enabled (required for job queue)
    if (!redisManager.isRedisEnabled()) {
      return {
        status: 'healthy',
        latency: Date.now() - startTime,
        message: 'Job queue disabled (Redis not available)',
        details: {
          enabled: false,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
      };
    }

    // Check if job queue is initialized and get stats
    const stats = await jobQueue.getStats();
    const latency = Date.now() - startTime;

    // Check for concerning queue conditions
    const totalJobs = stats.waiting + stats.active + stats.delayed;
    const totalProcessed = stats.completed + stats.failed;
    const failedRatio = totalProcessed > 0 ? stats.failed / totalProcessed : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message: string | undefined;

    // Queue is degraded if there are too many waiting jobs or high failure rate
    if (totalJobs > 1000) {
      status = 'degraded';
      message = `High queue depth: ${totalJobs} jobs`;
    } else if (failedRatio > 0.1 && totalProcessed > 10) {
      status = 'degraded';
      message = `High failure rate: ${(failedRatio * 100).toFixed(1)}%`;
    }

    return {
      status,
      latency,
      message,
      details: {
        enabled: true,
        ...stats,
      },
    };
  } catch (error: any) {
    // Job queue errors should not fail the health check
    // The application can run without background jobs
    return {
      status: 'degraded',
      latency: Date.now() - startTime,
      message: `Job queue check failed: ${error.message || 'Unknown error'}`,
      details: {
        enabled: true,
        error: error.message,
      },
    };
  }
}

/**
 * Readiness check endpoint
 * Verifies that the application is ready to accept traffic
 * Requirement 10.2: Readiness checks
 * Requirement 10.7: Readiness checks fail until all services are initialized
 */
export async function readinessCheck(_req: Request, res: Response) {
  const startTime = Date.now();
  const timeout = 2000; // 2 second timeout (Requirement 10.4)

  try {
    // Run readiness checks with timeout
    const readinessPromise = performReadinessChecks();
    const timeoutPromise = new Promise<ReadinessStatus>((_, reject) => 
      setTimeout(() => reject(new Error('Readiness check timeout')), timeout)
    );

    const readiness = await Promise.race([readinessPromise, timeoutPromise]);

    // Ensure total response time is within 2 seconds (Requirement 10.8)
    const totalTime = Date.now() - startTime;
    if (totalTime > 2000) {
      console.warn(`Readiness check took ${totalTime}ms, exceeding 2 second limit`);
    }

    const httpStatus = readiness.status === 'ready' ? 200 : 503;
    res.status(httpStatus).json(readiness);
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'unhealthy', latency: 0, message: 'Readiness check timeout' },
        redis: { status: 'unhealthy', latency: 0, message: 'Readiness check timeout' },
      },
    });
  }
}

/**
 * Perform readiness checks
 * Requirement 3.4: Redis status should not fail readiness check
 */
async function performReadinessChecks(): Promise<ReadinessStatus> {
  const readiness: ReadinessStatus = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'unhealthy', latency: 0 },
      redis: { status: 'unhealthy', latency: 0 },
    },
  };

  // Check essential services
  readiness.checks.database = await checkDatabase();
  readiness.checks.redis = await checkRedis();

  // Application is ready if database is up
  // Cache (Redis) is optional - application can run with fallback mechanisms
  const isReady = readiness.checks.database.status === 'healthy';

  readiness.status = isReady ? 'ready' : 'not ready';

  return readiness;
}

/**
 * Liveness check endpoint
 * Confirms that the application process is responsive
 * Requirement 10.3: Liveness checks
 */
export async function livenessCheck(_req: Request, res: Response) {
  // Simple liveness check - just return OK if the process is running
  // This should be very fast and not depend on external services
  const memUsage = process.memoryUsage();
  
  const liveness: LivenessStatus = {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    },
  };

  res.status(200).json(liveness);
}