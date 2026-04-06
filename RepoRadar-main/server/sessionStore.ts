import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { redisManager } from './redis.js';
import crypto from 'crypto';
import { config } from './config/index.js';

/**
 * Production-ready session configuration with PostgreSQL default and Redis fallback
 * Implements secure session management with encryption, cleanup, and monitoring
 * 
 * Requirements:
 * - 10.2: Session state sharing via PostgreSQL
 * - 12.5: Secure session configuration with httpOnly cookies
 */

// Encryption key for session data (must be 64 hex characters = 32 bytes)
const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// Validate encryption key format
if (ENCRYPTION_KEY.length !== 64) {
  console.warn('SESSION_ENCRYPTION_KEY should be exactly 64 hex characters (32 bytes). Current length:', ENCRYPTION_KEY.length);
}

// Global session store instance for monitoring and cleanup
let globalSessionStore: session.Store | null = null;

/**
 * Get the current session store instance for monitoring
 */
export function getSessionStore(): session.Store | null {
  return globalSessionStore;
}

/**
 * Encrypt session data
 */
function encryptSessionData(data: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Session encryption error:', error);
    throw new Error('Failed to encrypt session data');
  }
}

/**
 * Decrypt session data
 */
function decryptSessionData(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Session decryption error:', error);
    throw new Error('Failed to decrypt session data');
  }
}

/**
 * Create session store with PostgreSQL default and Redis when available
 * 
 * Production Strategy:
 * - PostgreSQL is the default and recommended store for production
 * - Redis is used when explicitly enabled and available
 * - Automatic fallback chain: Redis → PostgreSQL → Memory (emergency only)
 * 
 * Requirements:
 * - 10.2: PostgreSQL session store for multi-instance session sharing
 * - 3.2: Redis fallback when available for better performance
 */
export async function createSessionStore(): Promise<session.Store> {
  const sessionConfig = config.getSession();
  const useRedis = sessionConfig.useRedis;
  
  // Default to PostgreSQL for production reliability
  if (!useRedis) {
    console.log('Session Store: Using PostgreSQL (default for production)');
    const store = await createPostgreSQLSessionStore();
    globalSessionStore = store;
    return store;
  }

  // Try Redis if explicitly enabled
  try {
    console.log('Session Store: Attempting to initialize Redis store');
    const redisClient = await Promise.race([
      redisManager.getClient(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 15000)
      )
    ]) as any;
    
    // Calculate TTL from session timeout (convert ms to seconds)
    const ttlSeconds = Math.floor(sessionConfig.timeout / 1000);
    
    // Create Redis store with encryption
    const store = new RedisStore({
      client: redisClient,
      prefix: 'reporadar:sess:',
      ttl: ttlSeconds,
      disableTouch: false, // Enable touch to support sliding window
      
      // Custom serializer with encryption for security
      serializer: {
        parse: (data: string) => {
          try {
            const decrypted = decryptSessionData(data);
            return JSON.parse(decrypted);
          } catch (error) {
            console.error('Session parse error:', error);
            return {};
          }
        },
        stringify: (data: any) => {
          try {
            const json = JSON.stringify(data);
            return encryptSessionData(json);
          } catch (error) {
            console.error('Session stringify error:', error);
            return '';
          }
        },
      },
    });

    console.log('Session Store: Redis store initialized successfully');
    console.log(`Session Store: TTL set to ${ttlSeconds} seconds (${Math.floor(ttlSeconds / 86400)} days)`);
    
    globalSessionStore = store;
    return store;
  } catch (error) {
    console.error('Session Store: Failed to initialize Redis store, falling back to PostgreSQL', error);
    const store = await createPostgreSQLSessionStore();
    globalSessionStore = store;
    return store;
  }
}

/**
 * Create PostgreSQL-backed session store (default for production)
 * 
 * PostgreSQL provides:
 * - Reliable session persistence across restarts
 * - Multi-instance session sharing without Redis
 * - Automatic session cleanup via pruning
 * - ACID guarantees for session data
 * 
 * Requirements:
 * - 10.2: PostgreSQL session store for multi-instance deployments
 * - Session cleanup/pruning for expired sessions
 */
async function createPostgreSQLSessionStore(): Promise<session.Store> {
  try {
    const ConnectPgSimple = (await import('connect-pg-simple')).default;
    const PgSession = ConnectPgSimple(session);
    const { pool } = await import('./db.js');
    
    // Calculate TTL from session timeout (convert ms to seconds)
    const sessionConfig = config.getSession();
    const ttlSeconds = Math.floor(sessionConfig.timeout / 1000);
    
    // Prune interval: clean up expired sessions every 15 minutes
    const pruneIntervalSeconds = 60 * 15;
    
    const store = new PgSession({
      pool: pool,
      tableName: 'sessions',
      createTableIfMissing: true,
      
      // Automatic cleanup of expired sessions
      pruneSessionInterval: pruneIntervalSeconds,
      
      // Session TTL from configuration
      ttl: ttlSeconds,
      
      // Error handling
      errorLog: (error: Error) => {
        console.error('PostgreSQL session store error:', error);
      },
    });

    console.log('Session Store: PostgreSQL store initialized');
    console.log(`Session Store: TTL set to ${ttlSeconds} seconds (${Math.floor(ttlSeconds / 86400)} days)`);
    console.log(`Session Store: Automatic cleanup every ${pruneIntervalSeconds / 60} minutes`);
    
    // Log initial session count for monitoring
    logSessionStats(store);
    
    // Start cleanup scheduler for non-PostgreSQL stores
    startSessionCleanup(store);
    
    return store;
  } catch (error) {
    console.error('Session Store: Failed to initialize PostgreSQL store, falling back to memory', error);
    
    // Last resort: memory store (not recommended for production)
    console.warn('Session Store: Using memory store - sessions will not persist across restarts!');
    const MemoryStore = (await import('memorystore')).default;
    const MemoryStoreSession = MemoryStore(session);
    const sessionConfig = config.getSession();
    return new MemoryStoreSession({
      checkPeriod: 86400000, // 24 hours
      ttl: sessionConfig.timeout,
    });
  }
}

/**
 * Log session statistics for monitoring
 */
async function logSessionStats(store: session.Store): Promise<void> {
  try {
    // Get session count if store supports it
    if ('length' in store && typeof store.length === 'function') {
      store.length((err: any, length?: number) => {
        if (!err && length !== undefined) {
          console.log(`Session Store: Currently ${length} active sessions`);
        }
      });
    }
  } catch (error) {
    // Ignore errors in stats logging
  }
}

/**
 * Get production-ready session middleware configuration
 * 
 * Security features:
 * - Secure cookies (HTTPS only in production)
 * - HttpOnly cookies (prevent XSS)
 * - SameSite strict (prevent CSRF)
 * - Rolling sessions (sliding window expiration)
 * - Session regeneration on login
 * 
 * Requirements:
 * - 12.5: Secure session configuration with httpOnly cookies
 */
export function getSessionConfig(store: session.Store): session.SessionOptions {
  const isProduction = config.isProduction();
  const isStaging = config.isStaging();
  const sessionConfig = config.getSession();
  const securityConfig = config.getSecurity();
  
  // Validate session secret
  if (!sessionConfig.secret) {
    throw new Error('SESSION_SECRET is required but not configured');
  }
  
  if (sessionConfig.secret.length < 32) {
    console.warn('SESSION_SECRET should be at least 32 characters for security');
  }
  
  return {
    store,
    secret: sessionConfig.secret,
    
    // Session behavior
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    
    // Session name (prevents fingerprinting)
    name: 'reporadar.sid',
    
    // Cookie security settings
    cookie: {
      // HTTPS only in production and staging
      secure: isProduction || isStaging,
      
      // Prevent JavaScript access (XSS protection)
      httpOnly: true,
      
      // Session timeout from configuration
      maxAge: sessionConfig.timeout,
      
      // CSRF protection (strict in production)
      sameSite: isProduction ? 'strict' : 'lax',
      
      // Cookie path
      path: '/',
      
      // Domain (for subdomain sharing if configured)
      domain: securityConfig.cookieDomain || undefined,
    },
    
    // Rolling sessions: extend expiration on each request (sliding window)
    rolling: sessionConfig.slidingWindow,
    
    // Proxy trust (required for secure cookies behind load balancer)
    proxy: isProduction || isStaging,
  };
}

/**
 * Manual session cleanup utility
 * Can be called periodically or on-demand to clean up expired sessions
 * 
 * Note: PostgreSQL store has automatic pruning, but this provides manual control
 */
export async function cleanupExpiredSessions(store: session.Store): Promise<number> {
  return new Promise((resolve, reject) => {
    // Check if store supports cleanup
    if (!('all' in store) || typeof store.all !== 'function') {
      console.log('Session cleanup: Store does not support manual cleanup');
      return resolve(0);
    }
    
    // Get all sessions
    store.all((err: any, sessions: any) => {
      if (err) {
        console.error('Session cleanup error:', err);
        return reject(err);
      }
      
      if (!sessions) {
        return resolve(0);
      }
      
      let cleanedCount = 0;
      const now = Date.now();
      
      // Check each session for expiration
      Object.keys(sessions).forEach((sid) => {
        const session = sessions[sid];
        
        // Check if session has expired
        if (session.cookie && session.cookie.expires) {
          const expires = new Date(session.cookie.expires).getTime();
          
          if (expires < now) {
            // Session expired, destroy it
            store.destroy(sid, (destroyErr) => {
              if (!destroyErr) {
                cleanedCount++;
              }
            });
          }
        }
      });
      
      console.log(`Session cleanup: Removed ${cleanedCount} expired sessions`);
      resolve(cleanedCount);
    });
  });
}

/**
 * Get session statistics for monitoring
 */
export async function getSessionStats(store: session.Store): Promise<{
  total: number;
  active: number;
  expired: number;
}> {
  return new Promise((resolve) => {
    // Check if store supports stats
    if (!('all' in store) || typeof store.all !== 'function') {
      return resolve({ total: 0, active: 0, expired: 0 });
    }
    
    store.all((err: any, sessions: any) => {
      if (err || !sessions) {
        return resolve({ total: 0, active: 0, expired: 0 });
      }
      
      const now = Date.now();
      let active = 0;
      let expired = 0;
      
      Object.keys(sessions).forEach((sid) => {
        const session = sessions[sid];
        
        if (session.cookie && session.cookie.expires) {
          const expires = new Date(session.cookie.expires).getTime();
          
          if (expires >= now) {
            active++;
          } else {
            expired++;
          }
        } else {
          active++; // No expiration means active
        }
      });
      
      resolve({
        total: active + expired,
        active,
        expired,
      });
    });
  });
}

/**
 * Session cleanup scheduler
 * Runs periodic cleanup for stores that don't have automatic pruning
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startSessionCleanup(store: session.Store, intervalMs: number = 15 * 60 * 1000): void {
  // Don't start if already running
  if (cleanupInterval) {
    console.log('Session cleanup: Already running');
    return;
  }
  
  // PostgreSQL store has automatic pruning, so skip manual cleanup
  if (store.constructor.name === 'PGStore') {
    console.log('Session cleanup: PostgreSQL store has automatic pruning, skipping manual cleanup');
    return;
  }
  
  console.log(`Session cleanup: Starting periodic cleanup every ${intervalMs / 60000} minutes`);
  
  // Run cleanup immediately
  cleanupExpiredSessions(store).catch((err) => {
    console.error('Initial session cleanup failed:', err);
  });
  
  // Schedule periodic cleanup
  cleanupInterval = setInterval(() => {
    cleanupExpiredSessions(store).catch((err) => {
      console.error('Periodic session cleanup failed:', err);
    });
  }, intervalMs);
}

export function stopSessionCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('Session cleanup: Stopped');
  }
}

/**
 * Session data interface
 */
export interface SessionData {
  userId?: string;
  createdAt: Date;
  lastAccessedAt: Date;
  data: Record<string, any>;
}

/**
 * Extend express-session types
 */
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    createdAt?: Date;
    lastAccessedAt?: Date;
    data?: Record<string, any>;
  }
}
