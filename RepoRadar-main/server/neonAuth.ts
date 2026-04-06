import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
import { storage } from './storage';
import { createSessionStore, getSessionConfig } from './sessionStore.js';
import connectPg from 'connect-pg-simple';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { passwordService, PasswordValidationError } from './auth/passwordService';

// Configure Neon to use WebSockets for better connection handling
neonConfig.webSocketConstructor = ws;

// Neon Auth configuration
const NEON_AUTH_CONFIG = {
  projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID,
  publishableKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  secretKey: process.env.STACK_SECRET_SERVER_KEY,
};

// Validate required environment variables
if (!NEON_AUTH_CONFIG.projectId || !NEON_AUTH_CONFIG.publishableKey || !NEON_AUTH_CONFIG.secretKey) {
  console.warn('Neon Auth environment variables not configured. Please set up Neon Auth in your Neon Console.');
}

export async function getSession() {
  const useRedis = process.env.USE_REDIS_SESSIONS === 'true';

  if (useRedis) {
    // Use Redis session store with encryption
    const store = await createSessionStore();
    return session(getSessionConfig(store));
  }

  // Fallback to PostgreSQL session store using Neon's serverless driver
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week

  // Create a connection pool using Neon's serverless driver
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool: pool as any, // Type assertion needed for compatibility
    createTableIfMissing: false, // We already created the table
    ttl: sessionTtl / 1000, // TTL in seconds
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: express.Express) {
  app.set("trust proxy", 1);
  const sessionMiddleware = await getSession();
  app.use(sessionMiddleware);

  // Test route to verify auth routes are working
  app.get("/auth/test", (req, res) => {
    console.log('Auth test route hit!');
    res.json({ message: "Auth routes are working!", timestamp: new Date().toISOString() });
  });

  // Neon Auth routes
  app.get("/api/auth/user", async (req, res) => {
    try {
      // Check if user is stored in session
      const sessionUser = (req.session as any).user;

      if (sessionUser && sessionUser.id) {
        // Fetch fresh user data from database to ensure we have latest info
        const dbUser = await storage.getUser(sessionUser.id);
        
        if (dbUser) {
          // Return fresh data from database with session structure
          res.json({
            authenticated: true,
            user: {
              id: dbUser.id,
              email: dbUser.email,
              name: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email?.split('@')[0] || '',
              firstName: dbUser.firstName,
              lastName: dbUser.lastName,
              profileImageUrl: dbUser.profileImageUrl,
              bio: dbUser.bio,
              githubToken: dbUser.githubToken,
              subscriptionTier: dbUser.subscriptionTier,
              subscriptionStatus: dbUser.subscriptionStatus,
              createdAt: dbUser.createdAt,
            }
          });
        } else {
          // User in session but not in database (shouldn't happen)
          res.status(401).json({
            authenticated: false,
            message: "User not found"
          });
        }
      } else {
        res.status(401).json({
          authenticated: false,
          message: "Not authenticated"
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      res.status(401).json({
        authenticated: false,
        message: "Authentication check failed"
      });
    }
  });

  // Auth callback route for handling Stack Auth redirects
  app.get("/auth/callback", async (req, res) => {
    console.log('Auth callback route hit!', req.query);
    try {
      // This would be where Stack Auth redirects after successful authentication
      // For now, we'll redirect to home page
      // In a full implementation, you'd verify the auth code/token here

      const { code, state, demo } = req.query;

      console.log('Auth callback - code:', code, 'state:', state, 'demo:', demo);

      if (code || demo) {
        // TODO: Exchange code for user info with Stack Auth API
        // For now, we'll create a mock user for demonstration
        const mockUser = {
          id: 'demo-user-' + Date.now(),
          email: 'demo@example.com',
          name: 'Demo User',
          profileImageUrl: '',
        };

        console.log('Creating mock user:', mockUser);

        // Store user in session
        (req.session as any).user = mockUser;

        // Try to sync user to database, but don't fail if it doesn't work
        try {
          await storage.upsertUser({
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.name.split(' ')[0] || '',
            lastName: mockUser.name.split(' ').slice(1).join(' ') || '',
            profileImageUrl: mockUser.profileImageUrl || '',
          });
          console.log('User synced to database');
        } catch (dbError) {
          console.warn('Failed to sync user to database (continuing anyway):', dbError);
        }

        await new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });

        console.log('User saved to session');
      }

      // Redirect to home page after successful auth
      console.log('Redirecting to home page');
      res.redirect('/home');
    } catch (error) {
      console.error('Auth callback error:', error);
      res.redirect('/landing?error=auth_failed');
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Get user from database by email
      const user = await storage.getUserByEmail(email);

      // Use generic error message to avoid revealing if email exists
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password against stored hash
      const isValidPassword = await passwordService.verify(password, user.passwordHash);

      if (!isValidPassword) {
        // Track failed login attempt
        // TODO: Implement account lockout after multiple failures (task 8.2)
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if password hash needs rehashing with higher cost factor
      if (passwordService.needsRehash(user.passwordHash)) {
        // Rehash password with current cost factor
        const newHash = await passwordService.hash(password);
        await storage.upsertUser({
          id: user.id,
          passwordHash: newHash,
        });
      }

      // Initialize session with security features
      const { SessionService } = await import('./auth/sessionService.js');
      await SessionService.initializeSession(req, user.id);

      // Create session user object
      const sessionUser = {
        id: user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email?.split('@')[0] || '',
        profileImageUrl: user.profileImageUrl || '',
      };

      // Store user in session
      (req.session as any).user = sessionUser;

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });

      res.json({ user: sessionUser });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Signup endpoint
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }

      // Validate password strength
      try {
        passwordService.validatePasswordStrength(password);
      } catch (error) {
        if (error instanceof PasswordValidationError) {
          return res.status(400).json({ message: error.message });
        }
        throw error;
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      // Hash the password
      const passwordHash = await passwordService.hash(password);

      // Split name into first and last name
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create new user in database
      const newUser = await storage.upsertUser({
        email,
        passwordHash,
        firstName,
        lastName,
        profileImageUrl: '',
        emailVerified: false, // Email verification will be implemented later
        lastLoginAt: new Date(),
        lastLoginIp: req.ip || req.socket.remoteAddress || '',
      });

      // Create session user object
      const sessionUser = {
        id: newUser.id,
        email: newUser.email,
        name: `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim() || newUser.email?.split('@')[0] || '',
        profileImageUrl: newUser.profileImageUrl || '',
      };

      // Store user in session
      (req.session as any).user = sessionUser;

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });

      res.json({ user: sessionUser });
    } catch (error) {
      console.error('Signup error:', error);
      
      // Don't expose internal errors to client
      if (error instanceof PasswordValidationError) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Signup failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const { SessionService } = await import('./auth/sessionService.js');
      await SessionService.destroySession(req, res);
      res.json({ success: true });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  app.post("/api/auth/logout-all", isAuthenticated, async (req: any, res) => {
    try {
      const { SessionService } = await import('./auth/sessionService.js');
      const userId = req.user?.claims?.sub || req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Invalidate all user sessions
      await SessionService.invalidateAllUserSessions(userId);
      
      // Destroy current session
      await SessionService.destroySession(req, res);
      
      res.json({ success: true, message: "Logged out from all devices" });
    } catch (error) {
      console.error('Logout all devices error:', error);
      res.status(500).json({ message: "Failed to logout from all devices" });
    }
  });
}

export const isAuthenticated: express.RequestHandler = async (req, res, next) => {
  try {
    // Detailed logging for debugging
    console.log('[Auth] Checking authentication...');
    console.log('[Auth] Session ID:', req.sessionID);
    console.log('[Auth] Session exists:', !!req.session);
    
    // Check if session exists
    if (!req.session) {
      console.error('[Auth] No session found on request');
      return res.status(401).json({ 
        message: "Unauthorized",
        error: "No session found" 
      });
    }

    // Check session for authenticated user with consistent extraction
    const sessionUser = (req.session as any).user;
    const sessionUserId = (req.session as any).userId;
    
    console.log('[Auth] Session user:', sessionUser ? 'exists' : 'missing');
    console.log('[Auth] Session userId:', sessionUserId || 'missing');
    console.log('[Auth] Full session data:', JSON.stringify(req.session, null, 2));

    // Support both session.user and session.userId patterns
    if (sessionUser || sessionUserId) {
      const userId = sessionUser?.id || sessionUserId;
      const userEmail = sessionUser?.email;
      const userName = sessionUser?.name;
      const userProfileImage = sessionUser?.profileImageUrl;

      if (!userId) {
        console.error('[Auth] Session exists but no userId found');
        return res.status(401).json({ 
          message: "Unauthorized",
          error: "Invalid session data" 
        });
      }

      console.log('[Auth] User authenticated:', userId);

      // Add user to request for compatibility with existing code
      (req as any).user = {
        claims: {
          sub: userId,
          email: userEmail || '',
          first_name: userName?.split(' ')[0] || '',
          last_name: userName?.split(' ').slice(1).join(' ') || '',
          profile_image_url: userProfileImage || '',
        }
      };
      
      return next();
    }

    // No authenticated user found
    console.log('[Auth] No authenticated user in session');
    return res.status(401).json({ 
      message: "Unauthorized",
      error: "Not authenticated" 
    });
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return res.status(401).json({ 
      message: "Unauthorized",
      error: "Authentication check failed" 
    });
  }
};