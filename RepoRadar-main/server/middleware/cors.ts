import cors from 'cors';
import { logger } from '../instanceId';

/**
 * CORS Configuration for Production
 * 
 * Configures Cross-Origin Resource Sharing (CORS) to allow requests
 * from the production domain while maintaining security.
 * 
 * Features:
 * - Production domain whitelisting
 * - Credentials support for authenticated requests
 * - Appropriate HTTP methods
 * - Standard headers for API requests
 */

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(): string[] {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  if (nodeEnv === 'production') {
    // Production: Allow both APP_URL and CORS_ALLOWED_ORIGINS
    const origins: string[] = [];
    
    // Add primary APP_URL if configured
    const appUrl = process.env.APP_URL;
    if (appUrl) {
      origins.push(appUrl);
    }
    
    // Add additional allowed origins from CORS_ALLOWED_ORIGINS
    // Format: comma-separated list of origins
    // Example: https://reporadar.online,https://reporadar-t0wc.onrender.com
    const corsOrigins = process.env.CORS_ALLOWED_ORIGINS;
    if (corsOrigins) {
      const additionalOrigins = corsOrigins
        .split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0);
      origins.push(...additionalOrigins);
    }
    
    if (origins.length > 0) {
      // Remove duplicates
      const uniqueOrigins = [...new Set(origins)];
      logger.info('CORS: Production mode with configured origins', { origins: uniqueOrigins });
      return uniqueOrigins;
    }
    
    logger.error('CORS: No origins configured in production. Set APP_URL or CORS_ALLOWED_ORIGINS environment variables.');
    return [];
  }
  
  // Development: Allow common local development ports and Replit domains
  logger.info('CORS: Development mode with local origins');
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173'
  ];

  // Add Replit preview domains if available
  const replitDomains = process.env.REPLIT_DOMAINS;
  const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
  if (replitDomains) {
    replitDomains.split(',').forEach(d => {
      const trimmed = d.trim();
      if (trimmed) {
        devOrigins.push(`https://${trimmed}`);
        devOrigins.push(`http://${trimmed}`);
      }
    });
  }
  if (replitDevDomain && !replitDomains?.includes(replitDevDomain)) {
    devOrigins.push(`https://${replitDevDomain}`);
    devOrigins.push(`http://${replitDevDomain}`);
  }

  return devOrigins;
}

/**
 * CORS middleware configuration
 */
export const corsMiddleware = cors({
  // Origin validation
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS: Blocked request from unauthorized origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  // Allow credentials (cookies, authorization headers)
  credentials: true,
  
  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  
  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  
  // Exposed headers (headers that the client can access)
  exposedHeaders: [
    'X-Instance-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  
  // Preflight cache duration (in seconds)
  maxAge: 86400, // 24 hours
  
  // Pass the CORS preflight response to the next handler
  preflightContinue: false,
  
  // Provide a status code to use for successful OPTIONS requests
  optionsSuccessStatus: 204
});

/**
 * Log CORS configuration on startup
 */
export function logCorsConfiguration(): void {
  const allowedOrigins = getAllowedOrigins();
  logger.info('CORS Configuration', {
    environment: process.env.NODE_ENV || 'development',
    allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  });
}
