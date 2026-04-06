import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { gracefulShutdown } from "./gracefulShutdown";
import { instanceId, logger } from "./instanceId";
import { enforceHTTPS, setSecurityHeaders } from "./middleware/httpsEnforcement";
import { corsMiddleware, logCorsConfiguration } from "./middleware/cors";
import { initializeConfiguration } from "./config/validation";

const app = express();

// Set Express environment based on NODE_ENV
app.set('env', process.env.NODE_ENV || 'development');

// Apply security middleware first (before parsing body)
app.use(enforceHTTPS);
app.use(setSecurityHeaders);

// Apply CORS middleware
app.use(corsMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add instance ID to all responses for debugging
app.use((req, res, next) => {
  res.setHeader('X-Instance-Id', instanceId.getId());
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Validate configuration before starting
  try {
    initializeConfiguration();
  } catch (error) {
    logger.error('Configuration validation failed', { error });
    process.exit(1);
  }

  // Log instance startup
  logger.info('Starting application instance', instanceId.getMetadata());
  
  // Log CORS configuration
  logCorsConfiguration();

  // Initialize job processors (Requirement 9.1, 9.2)
  try {
    const { setupJobProcessors } = await import('./jobs/setupProcessors.js');
    await setupJobProcessors();
    logger.info('Job processors initialized');
  } catch (error) {
    // Job processor initialization failure should not prevent server startup
    // The application can run without background jobs (Requirement 9.5)
    logger.warn('Failed to initialize job processors (background jobs disabled)', { error });
  }

  // Initialize rate limit storage (Requirement 12.4)
  try {
    const { initializeRateLimitStorage } = await import('./middleware/rateLimiter');
    initializeRateLimitStorage();
    logger.info('Rate limit storage initialized');
  } catch (error) {
    logger.warn('Failed to initialize rate limit storage (using memory fallback)', { error });
  }

  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const environment = app.get("env");
  logger.info(`Express environment: ${environment}, NODE_ENV: ${process.env.NODE_ENV}`);
  
  if (environment === "development") {
    logger.info('Setting up Vite development server');
    await setupVite(app, server);
  } else {
    logger.info('Setting up static file serving for production');
    serveStatic(app);
  }

  // Import and use the enhanced error handler AFTER static middleware
  const { createErrorHandler } = await import("./utils/errorHandler");
  app.use(createErrorHandler());

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for production
  
  // Set server timeout to 5 minutes for long-running AI analysis
  server.timeout = 300000; // 5 minutes (300 seconds)
  server.keepAliveTimeout = 305000; // Slightly longer than timeout
  server.headersTimeout = 310000; // Slightly longer than keepAliveTimeout
  
  server.listen(port, host, () => {
    logger.info(`Server listening on ${host}:${port}`);
    log(`serving on ${host}:${port}`);
  });

  // Initialize graceful shutdown handler
  gracefulShutdown.initialize(server, {
    timeout: 30000, // 30 seconds
    logger: (message: string) => logger.info(message),
  });

  logger.info('Application instance ready');
})();
