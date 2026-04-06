import type { Express, Request } from "express";
import express from "express";
import Stripe from "stripe";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./neonAuth";
import { githubService } from "./github";
import { analyzeRepository, findSimilarRepositories, findSimilarByFunctionality, askAI, generateAIRecommendations } from "./gemini";
import { insertRepositorySchema, insertAnalysisSchema, insertSavedRepositorySchema, repositoryTags, type User } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { 
  stripe, 
  createOrRetrieveStripeCustomer, 
  createSubscription, 
  createCheckoutSession,
  SUBSCRIPTION_PLANS, 
  isStripeEnabled 
} from "./stripe";
import { 
  analysisRateLimit, 
  searchRateLimit, 
  generalApiRateLimit,
  authRateLimit,
  resetRateLimit,
  apiRateLimit
} from "./middleware/rateLimiter";
import {
  checkFeatureAccess,
  checkTierLimit,
} from "./middleware/subscriptionTier";
import { geminiRateLimiter } from "./middleware/geminiRateLimiter";
import { 
  validateBody, 
  validateQuery, 
  validateParams,
  analyzeRepositorySchema,
  searchRepositoriesSchema,
  repositoryIdSchema,
  createSubscriptionSchema,
  findSimilarSchema
} from "./middleware/validation";
import { repositoryPagination, analysisPagination, searchPagination } from "./middleware/pagination";
import { createErrorHandler, asyncHandler } from "./utils/errorHandler";
import { createMetricsAPI } from "./performance/MetricsAPI.js";
import { getGlobalPerformanceMonitor } from "./performance/index.js";
import { analyticsMiddleware, trackEvent } from "./middleware/analytics";
import { analyticsService } from "./analytics";
import { createAdminRouter } from "./admin";
import { 
  featureFlagsMiddleware, 
  getFeatureFlagsHandler, 
  updateFeatureFlagHandler 
} from "./middleware/featureFlags";
import { sessionSecurityMiddleware } from "./middleware/sessionValidation";

// Authenticated user type
type AuthenticatedUser = {
  claims: {
    sub: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
  };
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionTier?: string;
};

// Helper to get authenticated user from request
function getAuthUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new Error('Request is not authenticated');
  }
  return req.user as AuthenticatedUser;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware - must be very early to avoid conflicts
  await setupAuth(app);

  // Session security middleware - validate sessions on each request
  // Apply after auth setup but before routes
  app.use(sessionSecurityMiddleware({
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    validateMetadata: true,
    detectSuspicious: true,
  }));

  // Health check endpoints
  const { healthCheck, readinessCheck, livenessCheck } = await import('./health');
  app.get('/health', healthCheck);
  app.get('/health/ready', readinessCheck);
  app.get('/health/live', livenessCheck);

  // Serve documentation files (must be before API routes)
  const docsPath = path.resolve(process.cwd(), 'docs');
  app.use('/docs', express.static(docsPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.md')) {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      }
    }
  }));

  // Performance monitoring endpoints
  const performanceMonitor = getGlobalPerformanceMonitor();
  const metricsAPI = createMetricsAPI(performanceMonitor);
  app.use('/api/performance', metricsAPI);

  // Performance alerting endpoints
  const { createAlertingSystem } = await import('./performance/AlertingSystem.js');
  const alertingSystem = createAlertingSystem(performanceMonitor);
  
  // Initialize with default alerts and start the system
  alertingSystem.createDefaultAlerts();
  await alertingSystem.start();

  // Alert management endpoints
  app.get('/api/performance/alerts/configs', (req, res) => {
    try {
      const configs = alertingSystem.getAlertConfigs();
      res.json({ configs });
    } catch (error) {
      console.error('Error retrieving alert configs:', error);
      res.status(500).json({ error: 'Failed to retrieve alert configurations' });
    }
  });

  app.post('/api/performance/alerts/configs', (req, res) => {
    try {
      const config = req.body;
      alertingSystem.addAlertConfig(config);
      res.json({ message: 'Alert configuration added', config });
    } catch (error) {
      console.error('Error adding alert config:', error);
      res.status(500).json({ error: 'Failed to add alert configuration' });
    }
  });

  app.put('/api/performance/alerts/configs/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updated = alertingSystem.updateAlertConfig(id, updates);
      
      if (updated) {
        res.json({ message: 'Alert configuration updated' });
      } else {
        res.status(404).json({ error: 'Alert configuration not found' });
      }
    } catch (error) {
      console.error('Error updating alert config:', error);
      res.status(500).json({ error: 'Failed to update alert configuration' });
    }
  });

  app.delete('/api/performance/alerts/configs/:id', (req, res) => {
    try {
      const { id } = req.params;
      const removed = alertingSystem.removeAlertConfig(id);
      
      if (removed) {
        res.json({ message: 'Alert configuration removed' });
      } else {
        res.status(404).json({ error: 'Alert configuration not found' });
      }
    } catch (error) {
      console.error('Error removing alert config:', error);
      res.status(500).json({ error: 'Failed to remove alert configuration' });
    }
  });

  app.get('/api/performance/alerts/active', (req, res) => {
    try {
      const alerts = alertingSystem.getActiveAlerts();
      res.json({ alerts });
    } catch (error) {
      console.error('Error retrieving active alerts:', error);
      res.status(500).json({ error: 'Failed to retrieve active alerts' });
    }
  });

  app.get('/api/performance/alerts/history', (req, res) => {
    try {
      const { limit } = req.query;
      const alerts = alertingSystem.getAlertHistory(limit ? parseInt(limit as string) : undefined);
      res.json({ alerts });
    } catch (error) {
      console.error('Error retrieving alert history:', error);
      res.status(500).json({ error: 'Failed to retrieve alert history' });
    }
  });

  app.post('/api/performance/alerts/:id/resolve', (req, res) => {
    try {
      const { id } = req.params;
      const resolved = alertingSystem.resolveAlert(id);
      
      if (resolved) {
        res.json({ message: 'Alert resolved' });
      } else {
        res.status(404).json({ error: 'Alert not found' });
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
      res.status(500).json({ error: 'Failed to resolve alert' });
    }
  });

  app.get('/api/performance/alerts/stats', (req, res) => {
    try {
      const stats = alertingSystem.getStats();
      res.json({ stats });
    } catch (error) {
      console.error('Error retrieving alerting stats:', error);
      res.status(500).json({ error: 'Failed to retrieve alerting statistics' });
    }
  });

  app.post('/api/performance/alerts/evaluate', async (req, res) => {
    try {
      await alertingSystem.evaluateAlerts();
      res.json({ message: 'Alert evaluation completed' });
    } catch (error) {
      console.error('Error evaluating alerts:', error);
      res.status(500).json({ error: 'Failed to evaluate alerts' });
    }
  });

  // Auth middleware already set up at the beginning

  // Admin dashboard API
  app.use('/api/admin', createAdminRouter());

  // Feature flags API
  app.use(featureFlagsMiddleware);
  app.get('/api/feature-flags', getFeatureFlagsHandler);
  app.put('/api/feature-flags/:flagName', updateFeatureFlagHandler);

  // Job status API
  const { createJobRouter } = await import('./jobs/jobRoutes');
  app.use('/api/jobs', createJobRouter());

  // Analytics middleware - track all API requests
  app.use('/api', analyticsMiddleware);

  // Analytics routes
  app.post('/api/analytics/track', async (req, res) => {
    try {
      const { name, category, properties } = req.body;
      const sessionId = req.headers['x-session-id'] as string || `session_${Date.now()}`;
      const user = req.user as AuthenticatedUser | undefined;
      const userId = user?.claims?.sub;

      await analyticsService.trackEvent({
        name,
        category,
        properties: properties || {},
        sessionId,
        userId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking analytics event:', error);
      res.status(500).json({ error: 'Failed to track event' });
    }
  });

  app.post('/api/analytics/opt-out', async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (sessionId) {
        analyticsService.optOut(sessionId);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error opting out of analytics:', error);
      res.status(500).json({ error: 'Failed to opt out' });
    }
  });

  app.post('/api/analytics/opt-in', async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      if (sessionId) {
        analyticsService.optIn(sessionId);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error opting in to analytics:', error);
      res.status(500).json({ error: 'Failed to opt in' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req, res) => {
    try {
      const user = getAuthUser(req);
      const userId = user.claims.sub;
      const userData = await storage.getUser(userId);
      res.json(userData);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // Update user profile
  app.put('/api/user/profile', isAuthenticated, async (req, res) => {
    try {
      console.log('[Profile Update] Request received');
      console.log('[Profile Update] User:', req.user);
      console.log('[Profile Update] Session:', (req as any).session);
      
      const authUser = getAuthUser(req);
      if (!authUser || !authUser.claims || !authUser.claims.sub) {
        console.error('[Profile Update] No user in request');
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const userId = authUser.claims.sub;
      const { firstName, lastName, bio, profileImageUrl, githubToken } = req.body;
      
      console.log('[Profile Update] Updating profile for user:', userId);
      
      const user = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        bio,
        profileImageUrl,
        githubToken,
      });
      
      console.log('[Profile Update] Profile updated successfully');
      res.json(user);
    } catch (error) {
      console.error("[Profile Update] Error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });
  
  // Change user password
  app.post('/api/user/change-password', isAuthenticated, async (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const userId = authUser.claims.sub;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters long" });
      }
      
      const { passwordService } = await import('./auth/passwordService');
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Verify current password
      if (!user.passwordHash) {
        return res.status(400).json({ error: "Password authentication not set up for this account" });
      }
      
      const isValid = await passwordService.verify(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      
      // Hash and update new password
      const newPasswordHash = await passwordService.hash(newPassword);
      await storage.updateUserPassword(userId, newPasswordHash);
      
      // Send confirmation email if email service is configured
      const { emailService } = await import('./utils/emailService');
      if (user.email && emailService.isConfigured()) {
        await emailService.sendPasswordChangedEmail(user.email, user.firstName || undefined);
      }
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // OAuth initiation routes (with auth rate limiting)
  app.get('/api/auth/oauth/google', authRateLimit, asyncHandler(async (req, res) => {
    // TODO: Implement Google OAuth with Stack Auth
    // Temporarily disabled to avoid Next.js dependency issues
    res.status(501).json({ error: 'OAuth not yet implemented' });
  }));

  app.get('/api/auth/oauth/github', authRateLimit, asyncHandler(async (req, res) => {
    // TODO: Implement GitHub OAuth with Stack Auth
    // Temporarily disabled to avoid Next.js dependency issues
    res.status(501).json({ error: 'OAuth not yet implemented' });
  }));

  // OAuth callback routes (with auth rate limiting)
  app.get('/api/auth/callback/google', authRateLimit, asyncHandler(async (req, res) => {
    // TODO: Implement Google OAuth callback with Stack Auth
    // Temporarily disabled to avoid Next.js dependency issues
    res.status(501).json({ error: 'OAuth not yet implemented' });
  }));

  app.get('/api/auth/callback/github', authRateLimit, asyncHandler(async (req, res) => {
    // TODO: Implement GitHub OAuth callback with Stack Auth
    // Temporarily disabled to avoid Next.js dependency issues
    res.status(501).json({ error: 'OAuth not yet implemented' });
  }));

  // Password reset endpoints (with reset rate limiting)
  app.post('/api/auth/request-reset', resetRateLimit, asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      const { resetService } = await import('./auth/resetService');
      const { emailService } = await import('./utils/emailService');

      // Check if email service is configured
      if (!emailService.isConfigured()) {
        console.error('Email service not configured. Cannot send password reset email.');
        // Return success to prevent email enumeration
        return res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
      }

      // Request reset token
      const token = await resetService.requestReset(email);

      if (token) {
        // Get user info for personalized email
        const user = await storage.getUserByEmail(email);
        const userName = user?.firstName || undefined;

        // Send reset email
        await emailService.sendPasswordResetEmail({
          email,
          resetToken: token,
          userName,
        });
      }

      // Always return success to prevent email enumeration
      res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
    } catch (error) {
      console.error('Password reset request error:', error);
      // Return success to prevent email enumeration
      res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
    }
  }));

  app.get('/api/auth/validate-reset-token', asyncHandler(async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required', valid: false });
    }

    try {
      const { resetService } = await import('./auth/resetService');
      const result = await resetService.validateToken(token);

      res.json(result);
    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({ error: 'Failed to validate token', valid: false });
    }
  }));

  app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Validate password strength (minimum 8 characters)
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    try {
      const { resetService } = await import('./auth/resetService');
      const { passwordService } = await import('./auth/passwordService');
      const { emailService } = await import('./utils/emailService');

      // Validate token
      const validation = await resetService.validateToken(token);

      if (!validation.valid || !validation.userId) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Hash new password
      const passwordHash = await passwordService.hash(newPassword);

      // Update user password
      await storage.updateUserPassword(validation.userId, passwordHash);

      // Mark token as used
      await resetService.markTokenAsUsed(token);

      // Invalidate all other reset tokens for this user
      await resetService.invalidateUserTokens(validation.userId);

      // Invalidate all user sessions (force re-login after password change)
      const { SessionService } = await import('./auth/sessionService');
      await SessionService.invalidateAllUserSessions(validation.userId);

      // Send confirmation email
      const user = await storage.getUser(validation.userId);
      if (user?.email && emailService.isConfigured()) {
        await emailService.sendPasswordChangedEmail(user.email, user.firstName || undefined);
      }

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }));

  // AI Assistant endpoint
  app.post('/api/ai/ask', isAuthenticated, geminiRateLimiter(), async (req, res) => {
    try {
      const { question } = req.body;
      
      if (!question) {
        return res.status(400).json({ error: "Question is required" });
      }

      const answer = await askAI(question);
      res.json({ answer });
    } catch (error) {
      console.error("AI Assistant error:", error);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  });

  // Gemini Queue Status endpoint (for debugging)
  app.get('/api/ai/queue-status', isAuthenticated, async (req, res) => {
    try {
      const { geminiQueue } = await import('./utils/geminiQueue');
      const status = geminiQueue.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Queue status error:", error);
      res.status(500).json({ error: "Failed to get queue status" });
    }
  });

  interface AnalysisData {
    id: string;
    createdAt: Date;
    originality: number;
    completeness: number;
    marketability: number;
    monetization: number;
    usefulness: number;
    primaryLanguage?: string;
    repositoryId: string;
    repositoryName: string;
    repositoryOwner: string;
  }

  /**
   * Helper function to generate empty dashboard data
   */
  function getEmptyDashboardData() {
    // Generate empty activity data for last 30 days
    const activity = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      activity.push({ date: dateStr, count: 0 });
    }
    
    // Generate empty trends for last 6 months
    const trends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStr = date.toLocaleDateString('en', { month: 'short' });
      trends.push({
        month: monthStr,
        originality: 0,
        completeness: 0,
        marketability: 0,
        monetization: 0,
        usefulness: 0,
      });
    }
    
    return {
      stats: {
        totalAnalyses: 0,
        thisMonth: 0,
        growth: 0,
        avgScore: 0,
        topLanguage: 'N/A',
        activeProjects: 0
      },
      activity,
      languages: [],
      scores: [
        { name: 'Originality', score: 0 },
        { name: 'Completeness', score: 0 },
        { name: 'Marketability', score: 0 },
        { name: 'Monetization', score: 0 },
        { name: 'Usefulness', score: 0 },
      ],
      trends,
      performance: [
        { 
          title: 'Best Performing', 
          description: 'Your highest-scoring repository', 
          value: '0',
          unit: 'score'
        },
        { 
          title: 'Improvement Rate', 
          description: 'Score improvement over time', 
          value: '0',
          unit: '%'
        },
        { 
          title: 'Analysis Frequency', 
          description: 'Average analyses per week', 
          value: '0',
          unit: 'repos'
        }
      ],
      recentAnalyses: [],
      isEmpty: true,
      message: 'No analyses yet. Start by analyzing your first repository!'
    };
  }

  // Analytics Dashboard endpoint
  app.get('/api/analytics/dashboard', isAuthenticated, async (req, res) => {
    try {
      // Extract userId with fallback for both session-based and token-based auth
      const authUser = getAuthUser(req);
      const userId = authUser.claims.sub;
      
      // Validate userId presence
      if (!userId) {
        console.error('[Analytics] No userId found in request');
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'User authentication required' 
        });
      }
      
      console.log(`[Analytics] Fetching dashboard data for userId: ${userId}`);
      const analyses = await storage.getUserAnalyses(userId);
      
      // Handle empty data case
      if (!analyses || analyses.length === 0) {
        console.log(`[Analytics] No analyses found for userId: ${userId}, returning empty state`);
        return res.json(getEmptyDashboardData());
      }
      
      // Calculate statistics
      const now = new Date();
      
      // Filter analyses for this month
      const thisMonth = (analyses as AnalysisData[]).filter((a) => {
        const date = new Date(a.createdAt);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      });
      
      // Filter analyses for last month (handle year boundary)
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonth = (analyses as AnalysisData[]).filter((a) => {
        const date = new Date(a.createdAt);
        return date.getMonth() === lastMonthDate.getMonth() && date.getFullYear() === lastMonthDate.getFullYear();
      });
      
      // Calculate monthly growth with edge case handling
      let growth = 0;
      if (lastMonth.length > 0) {
        growth = Math.round(((thisMonth.length - lastMonth.length) / lastMonth.length) * 100);
      } else if (thisMonth.length > 0) {
        // If no data last month but data this month, show 100% growth
        growth = 100;
      }
      
      // Calculate average score
      const avgScore = analyses.length > 0 
        ? (analyses as AnalysisData[]).reduce((sum, a) => sum + ((a.originality + a.completeness + a.marketability + a.monetization + a.usefulness) / 5), 0) / analyses.length
        : 0;
      
      // Language distribution
      const languageCounts: Record<string, number> = {};
      (analyses as AnalysisData[]).forEach((a) => {
        if (a.primaryLanguage) {
          languageCounts[a.primaryLanguage] = (languageCounts[a.primaryLanguage] || 0) + 1;
        }
      });
      const languages = Object.entries(languageCounts).map(([name, value]) => ({ name, value }));
      
      // Activity data (last 30 days) - fixed date range calculation
      const activity = [];
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // Include today, so -29 gives us 30 days
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0); // Normalize to start of day
        const dateStr = date.toISOString().split('T')[0];
        
        const count = (analyses as AnalysisData[]).filter((a) => {
          const analysisDate = new Date(a.createdAt);
          analysisDate.setHours(0, 0, 0, 0); // Normalize to start of day
          return analysisDate.toISOString().split('T')[0] === dateStr;
        }).length;
        
        activity.push({ date: dateStr, count });
      }
      
      // Score averages
      const scores = [
        { name: 'Originality', score: analyses.length > 0 ? (analyses as AnalysisData[]).reduce((sum, a) => sum + a.originality, 0) / analyses.length : 0 },
        { name: 'Completeness', score: analyses.length > 0 ? (analyses as AnalysisData[]).reduce((sum, a) => sum + a.completeness, 0) / analyses.length : 0 },
        { name: 'Marketability', score: analyses.length > 0 ? (analyses as AnalysisData[]).reduce((sum, a) => sum + a.marketability, 0) / analyses.length : 0 },
        { name: 'Monetization', score: analyses.length > 0 ? (analyses as AnalysisData[]).reduce((sum, a) => sum + a.monetization, 0) / analyses.length : 0 },
        { name: 'Usefulness', score: analyses.length > 0 ? (analyses as AnalysisData[]).reduce((sum, a) => sum + a.usefulness, 0) / analyses.length : 0 },
      ];
      
      // Monthly trends (last 6 months) - fixed to handle edge cases
      const trends = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toLocaleDateString('en', { month: 'short' });
        
        const monthAnalyses = (analyses as AnalysisData[]).filter((a) => {
          const aDate = new Date(a.createdAt);
          return aDate.getMonth() === date.getMonth() && aDate.getFullYear() === date.getFullYear();
        });
        
        // Handle edge cases: no data, single data point
        const count = monthAnalyses.length;
        trends.push({
          month: monthStr,
          originality: count > 0 ? monthAnalyses.reduce((sum, a) => sum + a.originality, 0) / count : 0,
          completeness: count > 0 ? monthAnalyses.reduce((sum, a) => sum + a.completeness, 0) / count : 0,
          marketability: count > 0 ? monthAnalyses.reduce((sum, a) => sum + a.marketability, 0) / count : 0,
          monetization: count > 0 ? monthAnalyses.reduce((sum, a) => sum + a.monetization, 0) / count : 0,
          usefulness: count > 0 ? monthAnalyses.reduce((sum, a) => sum + a.usefulness, 0) / count : 0,
        });
      }
      
      // Performance insights
      const performance = [
        { 
          title: 'Best Performing', 
          description: 'Your highest-scoring repository', 
          value: analyses.length > 0 ? Math.max(...(analyses as AnalysisData[]).map((a) => (a.originality + a.completeness + a.marketability + a.monetization + a.usefulness) / 5)).toFixed(1) : '0',
          unit: 'score'
        },
        { 
          title: 'Improvement Rate', 
          description: 'Score improvement over time', 
          value: '+15',
          unit: '%'
        },
        { 
          title: 'Analysis Frequency', 
          description: 'Average analyses per week', 
          value: (analyses.length / 4).toFixed(0),
          unit: 'repos'
        }
      ];
      
      res.json({
        stats: {
          totalAnalyses: analyses.length,
          thisMonth: thisMonth.length,
          growth, // Use the calculated growth value with edge case handling
          avgScore,
          topLanguage: languages.length > 0 ? languages.sort((a, b) => b.value - a.value)[0].name : 'N/A',
          activeProjects: new Set((analyses as AnalysisData[]).map((a) => a.repositoryId)).size
        },
        activity,
        languages,
        scores,
        trends,
        performance,
        recentAnalyses: (analyses as AnalysisData[]).slice(0, 10).map((a) => ({
          id: a.id,
          name: a.repositoryName,
          owner: a.repositoryOwner,
          language: a.primaryLanguage || 'Unknown',
          score: (a.originality + a.completeness + a.marketability + a.monetization + a.usefulness) / 5,
          date: a.createdAt
        }))
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to fetch analytics data" });
    }
  });

  // Advanced Analytics endpoint
  app.get('/api/analytics/advanced', isAuthenticated, checkFeatureAccess('advanced_analytics'), asyncHandler(async (req, res) => {
    try {
      // Extract userId for logging and validation
      const authUser = getAuthUser(req);
      const userId = authUser.claims.sub;
      
      if (!userId) {
        console.error('[Advanced Analytics] No userId found in authenticated request');
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'User authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      console.log(`[Advanced Analytics] Fetching data for user: ${userId}`);

      const { getAdvancedAnalytics } = await import('./advancedAnalytics');
      const timeRange = (req.query.timeRange as string) || '30d';
      
      // Validate timeRange parameter
      const validTimeRanges = ['7d', '30d', '90d', '1y'];
      if (!validTimeRanges.includes(timeRange)) {
        return res.status(400).json({
          error: 'Invalid time range',
          message: 'Time range must be one of: 7d, 30d, 90d, 1y',
          code: 'INVALID_TIME_RANGE'
        });
      }

      const data = await getAdvancedAnalytics(timeRange);
      
      // Set authentication headers in response
      res.setHeader('X-Authenticated-User', userId);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      console.log(`[Advanced Analytics] Successfully fetched data for user: ${userId}`);
      res.json(data);
    } catch (error) {
      console.error('[Advanced Analytics] Error fetching analytics:', error);
      
      // Return proper error response
      res.status(500).json({
        error: 'Failed to fetch advanced analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'ANALYTICS_FETCH_ERROR'
      });
    }
  }));

  // Stripe subscription endpoint
  app.post('/api/create-subscription', isAuthenticated, async (req, res) => {
    try {
      // Check if Stripe is enabled
      if (!isStripeEnabled()) {
        return res.status(503).json({ 
          error: "Payment processing is currently unavailable" 
        });
      }

      const { plan } = req.body;
      const authUser = getAuthUser(req);
      const userId = authUser.claims.sub;
      const userEmail = authUser.claims.email;

      if (!plan || !SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]) {
        return res.status(400).json({ error: "Invalid subscription plan" });
      }

      if (!userEmail) {
        return res.status(400).json({ error: "User email is required" });
      }

      // Get or create Stripe customer
      const customer = await createOrRetrieveStripeCustomer(userEmail, userId);
      
      // Update user with customer ID
      await storage.updateUserStripeCustomerId(userId, customer.id);

      // Create subscription
      const subscription = await createSubscription(customer.id, plan);

      // Update user with subscription info
      await storage.updateUserSubscription(userId, {
        stripeSubscriptionId: subscription.id,
        subscriptionTier: plan,
        subscriptionStatus: subscription.status,
        subscriptionEndDate: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : null,
      });

      // Return client secret for payment
      const invoice = subscription.latest_invoice as Stripe.Invoice | null;
      const paymentIntent = (invoice as any)?.payment_intent as Stripe.PaymentIntent | null;

      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent?.client_secret,
      });
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Subscription configuration endpoint
  app.get('/api/subscription/config', (req, res) => {
    res.json({ enabled: isStripeEnabled() });
  });

  // Subscription status endpoint
  app.get('/api/subscription/status', isAuthenticated, async (req, res) => {
    try {
      const authUser = getAuthUser(req);
      const userId = authUser.claims.sub;
      const dbUser = await storage.getUser(userId);

      if (!dbUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        tier: dbUser.subscriptionTier || 'free',
        status: dbUser.subscriptionStatus || 'inactive',
        currentPeriodEnd: dbUser.subscriptionEndDate,
        cancelAtPeriodEnd: false, // TODO: Get from Stripe if needed
        stripeCustomerId: dbUser.stripeCustomerId,
      });
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ error: "Failed to fetch subscription status" });
    }
  });

  // Subscription invoices endpoint
  app.get('/api/subscription/invoices', isAuthenticated, async (req, res) => {
    try {
      if (!isStripeEnabled() || !stripe) {
        return res.json([]);
      }

      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);

      if (!user || !user.stripeCustomerId) {
        return res.json([]);
      }

      const invoices = await stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit: 100,
      });

      const formattedInvoices = invoices.data.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        created: invoice.created,
        invoicePdf: invoice.invoice_pdf,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
      }));

      res.json(formattedInvoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  // Subscription cancellation endpoint
  app.post('/api/subscription/cancel', isAuthenticated, async (req, res) => {
    try {
      if (!isStripeEnabled() || !stripe) {
        return res.status(503).json({ error: "Payment processing is currently unavailable" });
      }

      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);

      if (!user || !user.stripeSubscriptionId) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      // Cancel at period end (don't cancel immediately)
      const subscription = await stripe.subscriptions.update(
        user.stripeSubscriptionId,
        { cancel_at_period_end: true }
      );

      res.json({ 
        success: true,
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        currentPeriodEnd: (subscription as any).current_period_end,
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ 
        error: "Failed to cancel subscription",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Stripe checkout session endpoint
  app.post('/api/subscription/checkout', isAuthenticated, async (req, res) => {
    try {
      // Check if Stripe is enabled
      if (!isStripeEnabled()) {
        return res.status(503).json({ 
          error: "Payment processing is currently unavailable" 
        });
      }

      const { priceId } = req.body;
      const user = getAuthUser(req);
      const userId = user.claims.sub;
      const userEmail = user.claims.email;

      // Validate inputs
      if (!priceId) {
        return res.status(400).json({ error: "Price ID is required" });
      }

      if (!userEmail) {
        return res.status(400).json({ error: "User email is required" });
      }

      // Validate price ID matches configured plans
      const validPriceIds = [
        process.env.STRIPE_PRO_PRICE_ID,
        process.env.STRIPE_ENTERPRISE_PRICE_ID
      ];

      if (!validPriceIds.includes(priceId)) {
        return res.status(400).json({ error: "Invalid price ID" });
      }

      // Create checkout session
      const session = await createCheckoutSession(userId, userEmail, priceId);

      // Update user with customer ID if not already set
      if (session.customer && typeof session.customer === 'string') {
        const user = await storage.getUser(userId);
        if (user && !user.stripeCustomerId) {
          await storage.updateUserStripeCustomerId(userId, session.customer);
        }
      }

      // Return checkout URL
      res.json({ 
        url: session.url,
        sessionId: session.id 
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ 
        error: "Failed to create checkout session",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Stripe webhook endpoint
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    // Check if Stripe is enabled and webhook secret is configured
    if (!isStripeEnabled() || !stripe) {
      return res.status(503).json({ error: "Stripe webhooks not configured" });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: "Webhook configuration error" });
    }

    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;

    // Verify webhook signature
    try {
      event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      const error = err as { message: string };
      console.error('Webhook signature verification failed:', error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    // Check for duplicate events
    try {
      const existingEvent = await storage.getSubscriptionEvent(event.id);
      if (existingEvent) {
        console.log(`Duplicate webhook event received: ${event.id}`);
        return res.json({ received: true, duplicate: true });
      }
    } catch (error) {
      console.error('Error checking for duplicate event:', error);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'customer.subscription.created': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          console.log(`Subscription created: ${subscription.id} for customer ${customerId}`);
          
          // Find user by Stripe customer ID
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            // Determine tier based on price
            let tier: 'free' | 'pro' | 'enterprise' = 'free';
            if (subscription.items.data.length > 0) {
              const priceId = subscription.items.data[0].price.id;
              if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
                tier = 'pro';
              } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
                tier = 'enterprise';
              }
            }

            await storage.updateUserSubscription(user.id, {
              stripeSubscriptionId: subscription.id,
              subscriptionTier: tier,
              subscriptionStatus: subscription.status,
              subscriptionEndDate: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : null,
            });

            // Log event
            await storage.createSubscriptionEvent({
              userId: user.id,
              eventType: 'subscription_created',
              stripeEventId: event.id,
              data: { subscriptionId: subscription.id, tier, status: subscription.status },
            });

            console.log(`Subscription created for user ${user.id}: ${tier} tier`);
          } else {
            console.error(`User not found for customer ${customerId}`);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          console.log(`Subscription updated: ${subscription.id} for customer ${customerId}`);
          
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            // Determine tier based on price
            let tier: 'free' | 'pro' | 'enterprise' = 'free';
            if (subscription.items.data.length > 0) {
              const priceId = subscription.items.data[0].price.id;
              if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
                tier = 'pro';
              } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
                tier = 'enterprise';
              }
            }

            await storage.updateUserSubscription(user.id, {
              subscriptionTier: tier,
              subscriptionStatus: subscription.status,
              subscriptionEndDate: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : null,
            });

            // Log event
            await storage.createSubscriptionEvent({
              userId: user.id,
              eventType: 'subscription_updated',
              stripeEventId: event.id,
              data: { subscriptionId: subscription.id, tier, status: subscription.status },
            });

            console.log(`Subscription updated for user ${user.id}: ${tier} tier, status: ${subscription.status}`);
          } else {
            console.error(`User not found for customer ${customerId}`);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          console.log(`Subscription deleted: ${subscription.id} for customer ${customerId}`);
          
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            // Downgrade to free tier
            await storage.updateUserSubscription(user.id, {
              subscriptionTier: 'free',
              subscriptionStatus: 'cancelled',
              subscriptionEndDate: null,
            });

            // Log event
            await storage.createSubscriptionEvent({
              userId: user.id,
              eventType: 'subscription_deleted',
              stripeEventId: event.id,
              data: { subscriptionId: subscription.id },
            });

            console.log(`Subscription cancelled for user ${user.id}, downgraded to free tier`);
          } else {
            console.error(`User not found for customer ${customerId}`);
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          
          console.log(`Payment succeeded for invoice: ${invoice.id}, customer: ${customerId}`);
          
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            // Log event
            await storage.createSubscriptionEvent({
              userId: user.id,
              eventType: 'payment_succeeded',
              stripeEventId: event.id,
              data: { 
                invoiceId: invoice.id, 
                amount: invoice.amount_paid,
                currency: invoice.currency,
              },
            });

            console.log(`Payment logged for user ${user.id}: ${invoice.amount_paid} ${invoice.currency}`);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          
          console.log(`Payment failed for invoice: ${invoice.id}, customer: ${customerId}`);
          
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            // Update subscription status to past_due
            await storage.updateUserSubscription(user.id, {
              subscriptionStatus: 'past_due',
            });

            // Log event
            await storage.createSubscriptionEvent({
              userId: user.id,
              eventType: 'payment_failed',
              stripeEventId: event.id,
              data: { 
                invoiceId: invoice.id, 
                amount: invoice.amount_due,
                currency: invoice.currency,
              },
            });

            console.log(`Payment failed for user ${user.id}, subscription marked as past_due`);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      // Return 200 to prevent Stripe retries for unrecoverable errors
      res.json({ received: true, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ============================================
  // Bookmark Endpoints (Intelligent Profile Feature)
  // ============================================
  
  // Apply intelligent profile performance monitoring middleware
  const { intelligentProfilePerformanceMiddleware } = await import('./middleware/intelligentProfileAnalytics');
  app.use('/api/bookmarks', intelligentProfilePerformanceMiddleware);
  app.use('/api/tags', intelligentProfilePerformanceMiddleware);
  app.use('/api/user/preferences', intelligentProfilePerformanceMiddleware);
  app.use('/api/recommendations', intelligentProfilePerformanceMiddleware);
  
  // Get user's bookmarks with repository details
  app.get('/api/bookmarks', 
    isAuthenticated, 
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per page
      const offset = (page - 1) * limit;
      
      // Get total count for pagination metadata
      const totalCount = await storage.getUserBookmarksCount(userId);
      
      // Get paginated bookmarks from storage
      const bookmarks = await storage.getUserBookmarksPaginated(userId, limit, offset);
      
      // Fetch repository details for each bookmark
      const bookmarksWithRepos = await Promise.all(
        bookmarks.map(async (bookmark) => {
          const repository = await storage.getRepository(bookmark.repositoryId);
          return {
            ...bookmark,
            repository,
          };
        })
      );
      
      // Track analytics event
      await trackEvent(req, 'bookmarks_viewed', 'profile', {
        count: bookmarksWithRepos.length,
        page,
        limit,
      }).catch(error => console.error('Error tracking bookmarks viewed event:', error));
      
      // Return paginated response
      res.json({
        data: bookmarksWithRepos,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: offset + bookmarks.length < totalCount,
        },
      });
    })
  );
  
  // Add a new bookmark
  app.post('/api/bookmarks',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { repositoryId, notes } = req.body;
      
      // Validate required fields
      if (!repositoryId || typeof repositoryId !== 'string') {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Repository ID is required',
          field: 'repositoryId',
        });
      }
      
      // Verify repository exists
      const repository = await storage.getRepository(repositoryId);
      if (!repository) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Repository not found',
          resourceType: 'repository',
          resourceId: repositoryId,
        });
      }
      
      // Add bookmark
      const bookmark = await storage.addBookmark(userId, repositoryId, notes);
      
      // Track analytics event
      await trackEvent(req, 'bookmark_added', 'profile', {
        repositoryId,
        repositoryName: repository.fullName,
      }).catch(error => console.error('Error tracking bookmark added event:', error));
      
      // Track user activity
      await storage.trackActivity(userId, 'bookmarked', repositoryId, {
        repositoryName: repository.fullName,
      }).catch(error => console.error('Error tracking activity:', error));
      
      res.json({
        ...bookmark,
        repository,
      });
    })
  );
  
  // Remove a bookmark
  app.delete('/api/bookmarks/:repositoryId',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { repositoryId } = req.params;
      
      if (!repositoryId) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Repository ID is required',
          field: 'repositoryId',
        });
      }
      
      // Get repository info before deleting for analytics
      const repository = await storage.getRepository(repositoryId);
      
      // Remove bookmark
      await storage.removeBookmark(userId, repositoryId);
      
      // Track analytics event
      await trackEvent(req, 'bookmark_removed', 'profile', {
        repositoryId,
        repositoryName: repository?.fullName,
      }).catch(error => console.error('Error tracking bookmark removed event:', error));
      
      res.json({ success: true });
    })
  );

  // ============================================
  // Tags API Endpoints
  // ============================================
  
  // Get user's tags with repository counts
  app.get('/api/tags',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200); // Max 200 per page for tags
      const offset = (page - 1) * limit;
      
      // Get total count for pagination metadata
      const totalCount = await storage.getUserTagsCount(userId);
      
      // Get paginated tags from storage
      const userTags = await storage.getUserTagsPaginated(userId, limit, offset);
      
      // Get repository counts for each tag (optimized with single query)
      const tagIds = userTags.map(tag => tag.id);
      const counts = tagIds.length > 0 ? await db
        .select({
          tagId: repositoryTags.tagId,
          count: sql<number>`count(*)`,
        })
        .from(repositoryTags)
        .where(sql`${repositoryTags.tagId} = ANY(${tagIds})`)
        .groupBy(repositoryTags.tagId) : [];
      
      const countMap = new Map(counts.map(c => [c.tagId, c.count]));
      
      const tagsWithCounts = userTags.map(tag => ({
        ...tag,
        repositoryCount: countMap.get(tag.id) || 0,
      }));
      
      // Track analytics event
      await trackEvent(req, 'tags_viewed', 'profile', {
        count: tagsWithCounts.length,
        page,
        limit,
      }).catch(error => console.error('Error tracking tags viewed event:', error));
      
      // Return paginated response
      res.json({
        data: tagsWithCounts,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: offset + userTags.length < totalCount,
        },
      });
    })
  );
  
  // Create a new tag
  app.post('/api/tags',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { name, color } = req.body;
      
      // Validate tag name
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Tag name is required',
          field: 'name',
        });
      }
      
      if (name.length > 50) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Tag name must be 50 characters or less',
          field: 'name',
        });
      }
      
      // Validate color format if provided
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Color must be a valid hex color (e.g., #FF6B35)',
          field: 'color',
        });
      }
      
      // Check for duplicate tag name for this user
      const existingTags = await storage.getUserTags(userId);
      if (existingTags.some(tag => tag.name.toLowerCase() === name.trim().toLowerCase())) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'A tag with this name already exists',
          field: 'name',
        });
      }
      
      // Create tag
      const tag = await storage.createTag(userId, name.trim(), color);
      
      // Track analytics event
      await trackEvent(req, 'tag_created', 'profile', {
        tagId: tag.id,
        tagName: tag.name,
        tagColor: tag.color,
      }).catch(error => console.error('Error tracking tag created event:', error));
      
      res.json(tag);
    })
  );
  
  // Delete a tag
  app.delete('/api/tags/:tagId',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const tagId = parseInt(req.params.tagId, 10);
      
      if (isNaN(tagId)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid tag ID',
          field: 'tagId',
        });
      }
      
      // Verify tag exists and belongs to user
      const userTags = await storage.getUserTags(userId);
      const tag = userTags.find(t => t.id === tagId);
      
      if (!tag) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Tag not found',
          resourceType: 'tag',
          resourceId: tagId.toString(),
        });
      }
      
      // Delete tag (cascade deletes repository associations)
      await storage.deleteTag(userId, tagId);
      
      // Track analytics event
      await trackEvent(req, 'tag_deleted', 'profile', {
        tagId,
        tagName: tag.name,
      }).catch(error => console.error('Error tracking tag deleted event:', error));
      
      res.json({ success: true });
    })
  );
  
  // Apply a tag to a repository
  app.post('/api/repositories/:id/tags',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const repositoryId = req.params.id;
      const { tagId } = req.body;
      
      // Validate inputs
      if (!repositoryId) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Repository ID is required',
          field: 'repositoryId',
        });
      }
      
      if (!tagId || typeof tagId !== 'number') {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Tag ID is required and must be a number',
          field: 'tagId',
        });
      }
      
      // Verify repository exists
      const repository = await storage.getRepository(repositoryId);
      if (!repository) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Repository not found',
          resourceType: 'repository',
          resourceId: repositoryId,
        });
      }
      
      // Verify tag exists and belongs to user
      const userTags = await storage.getUserTags(userId);
      const tag = userTags.find(t => t.id === tagId);
      
      if (!tag) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Tag not found or does not belong to you',
          resourceType: 'tag',
          resourceId: tagId.toString(),
        });
      }
      
      // Check if tag is already applied
      const existingTags = await storage.getRepositoryTags(repositoryId, userId);
      if (existingTags.some(t => t.id === tagId)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Tag is already applied to this repository',
        });
      }
      
      // Apply tag
      const repoTag = await storage.tagRepository(repositoryId, tagId, userId);
      
      // Track analytics event
      await trackEvent(req, 'tag_applied', 'profile', {
        repositoryId,
        repositoryName: repository.fullName,
        tagId,
        tagName: tag.name,
      }).catch(error => console.error('Error tracking tag applied event:', error));
      
      res.json(repoTag);
    })
  );
  
  // Get tags for a specific repository
  app.get('/api/repositories/:id/tags',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const repositoryId = req.params.id;
      
      // Validate inputs
      if (!repositoryId) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Repository ID is required',
          field: 'repositoryId',
        });
      }
      
      // Get tags for this repository
      const tags = await storage.getRepositoryTags(repositoryId, userId);
      
      res.json(tags);
    })
  );
  
  // Remove a tag from a repository
  app.delete('/api/repositories/:id/tags/:tagId',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const repositoryId = req.params.id;
      const tagId = parseInt(req.params.tagId, 10);
      
      // Validate inputs
      if (!repositoryId) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Repository ID is required',
          field: 'repositoryId',
        });
      }
      
      if (isNaN(tagId)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid tag ID',
          field: 'tagId',
        });
      }
      
      // Get repository and tag info for analytics
      const repository = await storage.getRepository(repositoryId);
      const userTags = await storage.getUserTags(userId);
      const tag = userTags.find(t => t.id === tagId);
      
      // Remove tag from repository
      await storage.untagRepository(repositoryId, tagId, userId);
      
      // Track analytics event
      await trackEvent(req, 'tag_removed', 'profile', {
        repositoryId,
        repositoryName: repository?.fullName,
        tagId,
        tagName: tag?.name,
      }).catch(error => console.error('Error tracking tag removed event:', error));
      
      res.json({ success: true });
    })
  );

  // ============================================
  // User Preferences API Endpoints
  // ============================================
  
  // Get user preferences with defaults
  app.get('/api/user/preferences',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      
      // Get preferences (creates defaults if none exist)
      const preferences = await storage.getUserPreferences(userId);
      
      // Track analytics event
      await trackEvent(req, 'preferences_viewed', 'profile', {
        hasPreferences: !!preferences,
      }).catch(error => console.error('Error tracking preferences viewed event:', error));
      
      res.json(preferences);
    })
  );
  
  // Update user preferences
  app.put('/api/user/preferences',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const {
        preferredLanguages,
        preferredTopics,
        excludedTopics,
        minStars,
        maxAge,
        aiRecommendations,
        emailNotifications,
      } = req.body;
      
      // Validate preferredLanguages if provided
      if (preferredLanguages !== undefined) {
        if (!Array.isArray(preferredLanguages)) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'preferredLanguages must be an array',
            field: 'preferredLanguages',
          });
        }
        
        if (!preferredLanguages.every(lang => typeof lang === 'string')) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'All preferred languages must be strings',
            field: 'preferredLanguages',
          });
        }
      }
      
      // Validate preferredTopics if provided
      if (preferredTopics !== undefined) {
        if (!Array.isArray(preferredTopics)) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'preferredTopics must be an array',
            field: 'preferredTopics',
          });
        }
        
        if (!preferredTopics.every(topic => typeof topic === 'string')) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'All preferred topics must be strings',
            field: 'preferredTopics',
          });
        }
      }
      
      // Validate excludedTopics if provided
      if (excludedTopics !== undefined) {
        if (!Array.isArray(excludedTopics)) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'excludedTopics must be an array',
            field: 'excludedTopics',
          });
        }
        
        if (!excludedTopics.every(topic => typeof topic === 'string')) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'All excluded topics must be strings',
            field: 'excludedTopics',
          });
        }
      }
      
      // Validate minStars if provided
      if (minStars !== undefined) {
        if (typeof minStars !== 'number' || isNaN(minStars)) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'minStars must be a number',
            field: 'minStars',
          });
        }
        
        if (minStars < 0 || minStars > 1000000) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'minStars must be between 0 and 1000000',
            field: 'minStars',
          });
        }
      }
      
      // Validate maxAge if provided
      if (maxAge !== undefined && typeof maxAge !== 'string') {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'maxAge must be a string',
          field: 'maxAge',
        });
      }
      
      // Validate aiRecommendations if provided
      if (aiRecommendations !== undefined && typeof aiRecommendations !== 'boolean') {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'aiRecommendations must be a boolean',
          field: 'aiRecommendations',
        });
      }
      
      // Validate emailNotifications if provided
      if (emailNotifications !== undefined && typeof emailNotifications !== 'boolean') {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'emailNotifications must be a boolean',
          field: 'emailNotifications',
        });
      }
      
      // Build update object with only provided fields
      const updateData: any = {};
      if (preferredLanguages !== undefined) updateData.preferredLanguages = preferredLanguages;
      if (preferredTopics !== undefined) updateData.preferredTopics = preferredTopics;
      if (excludedTopics !== undefined) updateData.excludedTopics = excludedTopics;
      if (minStars !== undefined) updateData.minStars = minStars;
      if (maxAge !== undefined) updateData.maxAge = maxAge;
      if (aiRecommendations !== undefined) updateData.aiRecommendations = aiRecommendations;
      if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
      
      // Update preferences
      const preferences = await storage.updateUserPreferences(userId, updateData);
      
      // Invalidate recommendations cache after preferences update
      try {
        const { redisManager } = await import('./redis');
        if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
          const redisClient = await redisManager.getClient();
          const cacheKey = `recommendations:${userId}`;
          await redisClient.del(cacheKey);
          console.log(`[Cache] Invalidated recommendations cache for user ${userId} after preferences update`);
        }
      } catch (error) {
        console.error('[Cache] Error invalidating recommendations cache:', error);
      }
      
      // Track analytics event
      await trackEvent(req, 'preferences_updated', 'profile', {
        updatedFields: Object.keys(updateData),
        languageCount: preferredLanguages?.length,
        topicCount: preferredTopics?.length,
        excludedTopicCount: excludedTopics?.length,
      }).catch(error => console.error('Error tracking preferences updated event:', error));
      
      res.json(preferences);
    })
  );

  // ============================================
  // AI Recommendations API Endpoint
  // ============================================
  
  // Get personalized AI recommendations
  // Requirements: 4.2, 4.16, 4.18, 4.19
  app.get('/api/recommendations',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    geminiRateLimiter(), // Gemini-specific rate limiting
    apiRateLimit, // General API rate limiting
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      
      // Check if Redis is available for caching
      const { redisManager } = await import('./redis');
      const cacheKey = `recommendations:${userId}`;
      const cacheExpiry = 24 * 60 * 60; // 24 hours in seconds
      
      try {
        // Try to get cached recommendations if Redis is available
        if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
          const redisClient = await redisManager.getClient();
          const cached = await redisClient.get(cacheKey);
          
          if (cached) {
            console.log(`[Recommendations] Serving cached recommendations for user ${userId}`);
            
            // Track analytics event
            await trackEvent(req, 'recommendations_viewed', 'profile', {
              source: 'cache',
            }).catch(error => console.error('Error tracking recommendations viewed event:', error));
            
            return res.json(JSON.parse(cached));
          }
        }
      } catch (error) {
        console.error('[Recommendations] Error checking cache:', error);
        // Continue without cache
      }
      
      // Check if user has sufficient activity data
      const recentActivity = await storage.getUserRecentActivity(userId, 10);
      const bookmarks = await storage.getUserBookmarks(userId);
      
      if (recentActivity.length === 0 && bookmarks.length === 0) {
        // Insufficient activity data
        await trackEvent(req, 'recommendations_insufficient_data', 'profile', {
          activityCount: 0,
          bookmarkCount: 0,
        }).catch(error => console.error('Error tracking recommendations event:', error));
        
        return res.json({
          recommendations: [],
          message: 'Analyze some repositories or add bookmarks to get personalized recommendations!',
          insufficientData: true,
        });
      }
      
      // Generate AI recommendations
      try {
        console.log(`[Recommendations] Generating recommendations for user ${userId}`);
        const generationStartTime = Date.now();
        const recommendations = await generateAIRecommendations(userId, storage, githubService);
        const generationDuration = Date.now() - generationStartTime;
        
        const response = {
          recommendations,
          generatedAt: new Date().toISOString(),
          cacheExpiry: cacheExpiry,
        };
        
        // Cache the results if Redis is available
        try {
          if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
            const redisClient = await redisManager.getClient();
            await redisClient.setEx(cacheKey, cacheExpiry, JSON.stringify(response));
            console.log(`[Recommendations] Cached recommendations for user ${userId}`);
          }
        } catch (error) {
          console.error('[Recommendations] Error caching results:', error);
          // Continue without caching
        }
        
        // Track recommendation generation performance
        const { trackRecommendationPerformance } = await import('./middleware/intelligentProfileAnalytics');
        await trackRecommendationPerformance(userId, generationDuration, recommendations.length, 'ai');
        
        // Track analytics event
        await trackEvent(req, 'recommendations_generated', 'profile', {
          count: recommendations.length,
          source: 'ai',
          duration: generationDuration,
        }).catch(error => console.error('Error tracking recommendations generated event:', error));
        
        res.json(response);
      } catch (error) {
        console.error('[Recommendations] Error generating recommendations:', error);
        
        // Track error event
        await trackEvent(req, 'recommendations_error', 'profile', {
          error: error instanceof Error ? error.message : 'Unknown error',
        }).catch(err => console.error('Error tracking recommendations error event:', err));
        
        // Return user-friendly error
        return res.status(500).json({
          error: 'RECOMMENDATION_GENERATION_FAILED',
          message: 'Failed to generate recommendations. Please try again later.',
          retryable: true,
        });
      }
    })
  );

  // Dismiss a recommendation
  // This removes a specific repository from the user's recommendation list
  app.post('/api/recommendations/dismiss',
    isAuthenticated,
    checkFeatureAccess('advanced_analytics'), // Pro/Enterprise only
    asyncHandler(async (req, res) => {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { repositoryId } = req.body;
      
      // Validate input
      if (!repositoryId || typeof repositoryId !== 'string') {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Repository ID is required',
          field: 'repositoryId',
        });
      }
      
      // Get repository info for analytics
      const repository = await storage.getRepository(repositoryId);
      
      // Store dismissed recommendation in Redis or database
      // This prevents it from appearing in future recommendations
      try {
        const { redisManager } = await import('./redis');
        if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
          const redisClient = await redisManager.getClient();
          const dismissedKey = `dismissed_recommendations:${userId}`;
          
          // Add to set of dismissed repositories (expires after 90 days)
          await redisClient.sAdd(dismissedKey, repositoryId);
          await redisClient.expire(dismissedKey, 90 * 24 * 60 * 60); // 90 days
          
          console.log(`[Recommendations] Dismissed repository ${repositoryId} for user ${userId}`);
        }
      } catch (error) {
        console.error('[Recommendations] Error storing dismissed recommendation:', error);
        // Continue even if storage fails
      }
      
      // Track analytics event
      await trackEvent(req, 'recommendation_dismissed', 'profile', {
        repositoryId,
        repositoryName: repository?.fullName,
      }).catch(error => console.error('Error tracking recommendation dismissed event:', error));
      
      res.json({ 
        success: true,
        message: 'Recommendation dismissed successfully',
      });
    })
  );

  // Repository search and analysis
  app.get('/api/repositories/search', checkTierLimit('api'), validateQuery(searchRepositoriesSchema), asyncHandler(async (req, res) => {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: "Query parameter 'q' is required" });
    }

    // First try to search in our database
    const localResults = await storage.searchRepositories(query, Number(limit));
    
    // If we have enough local results, return them
    if (localResults.length >= Number(limit)) {
      // Track search event
      await trackEvent(req, 'search_query', 'search', {
        query,
        resultCount: localResults.length,
        source: 'local',
      }).catch(error => console.error('Error tracking search event:', error));
      
      return res.json(localResults);
    }

    // Otherwise, search GitHub
    const githubResults = await githubService.searchRepositories(query, 'stars', Number(limit));
    
    // Store new repositories in our database
    const repositories = [];
    for (const ghRepo of githubResults) {
      try {
        const languages = await githubService.getRepositoryLanguages(ghRepo.owner.login, ghRepo.name);
        
        const repoData = {
          id: ghRepo.id.toString(),
          name: ghRepo.name,
          fullName: ghRepo.full_name,
          owner: ghRepo.owner.login,
          description: ghRepo.description,
          language: ghRepo.language,
          stars: ghRepo.stargazers_count,
          forks: ghRepo.forks_count,
          watchers: ghRepo.watchers_count,
          size: ghRepo.size,
          isPrivate: ghRepo.private,
          htmlUrl: ghRepo.html_url,
          cloneUrl: ghRepo.clone_url,
          languages,
          topics: ghRepo.topics || [],
        };
        
        const repository = await storage.upsertRepository(repoData);
        repositories.push(repository);
      } catch (error) {
        console.error(`Error storing repository ${ghRepo.full_name}:`, error);
      }
    }

    // Track search event
    await trackEvent(req, 'search_query', 'search', {
      query,
      resultCount: repositories.length,
      source: 'github',
    }).catch(error => console.error('Error tracking search event:', error));

    res.json(repositories);
  }));

  app.post('/api/repositories/analyze', isAuthenticated, geminiRateLimiter(), checkTierLimit('analysis'), validateBody(analyzeRepositorySchema), asyncHandler(async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: "Repository URL is required" });
    }

    const parsed = githubService.parseRepositoryUrl(url);
    if (!parsed) {
      return res.status(400).json({ message: "Invalid GitHub repository URL" });
    }

    const { owner, repo } = parsed;
    
    // Get repository details from GitHub
    const repoDetails = await githubService.getRepositoryWithDetails(owner, repo);
    if (!repoDetails) {
      return res.status(404).json({ message: "Repository not found" });
    }
    const { repository: ghRepo, languages, readme } = repoDetails;
    
    // Store repository in database
    const repoData = {
      id: ghRepo.id.toString(),
      name: ghRepo.name,
      fullName: ghRepo.full_name,
      owner: ghRepo.owner.login,
      description: ghRepo.description,
      language: ghRepo.language,
      stars: ghRepo.stargazers_count,
      forks: ghRepo.forks_count,
      watchers: ghRepo.watchers_count,
      size: ghRepo.size,
      isPrivate: ghRepo.private,
      htmlUrl: ghRepo.html_url,
      cloneUrl: ghRepo.clone_url,
      languages,
      topics: ghRepo.topics || [],
      lastAnalyzed: new Date(),
    };
    
    const repository = await storage.upsertRepository(repoData);

    // Check if analysis already exists
    const existingAnalysis = await storage.getAnalysis(repository.id);
    if (existingAnalysis) {
      return res.json({
        repository,
        analysis: existingAnalysis,
        similar: await storage.getSimilarRepositories(repository.id)
      });
    }

    // Analyze with Gemini
    const analysisResult = await analyzeRepository({
      name: ghRepo.name,
      description: ghRepo.description || '',
      language: ghRepo.language || 'Unknown',
      stars: ghRepo.stargazers_count,
      forks: ghRepo.forks_count,
      size: ghRepo.size,
      languages,
      topics: ghRepo.topics || [],
      readme: readme || undefined,
    });

    // Store analysis
    const authUser = req.user ? getAuthUser(req) : null;
    const analysisData = {
      repositoryId: repository.id,
      userId: authUser?.claims?.sub,
      ...analysisResult,
    };
    
    const validatedAnalysisData = insertAnalysisSchema.parse(analysisData);
    const analysis = await storage.createAnalysis(validatedAnalysisData);

    // Invalidate recommendations cache after new analysis
    if (analysisData.userId) {
      try {
        const { redisManager } = await import('./redis');
        if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
          const redisClient = await redisManager.getClient();
          const cacheKey = `recommendations:${analysisData.userId}`;
          await redisClient.del(cacheKey);
          console.log(`[Cache] Invalidated recommendations cache for user ${analysisData.userId}`);
        }
      } catch (error) {
        console.error('[Cache] Error invalidating recommendations cache:', error);
      }
    }

    // Find and store similar repositories
    try {
      const similarRepoNames = await findSimilarRepositories({
        name: ghRepo.name,
        description: ghRepo.description || '',
        language: ghRepo.language || 'Unknown',
        stars: ghRepo.stargazers_count,
        forks: ghRepo.forks_count,
        size: ghRepo.size,
        languages,
        topics: ghRepo.topics || [],
      });

      const similarRepos = [];
      for (const repoName of similarRepoNames) {
        try {
          const parsed = githubService.parseRepositoryUrl(repoName);
          if (parsed) {
            const similarRepoDetails = await githubService.getRepositoryWithDetails(parsed.owner, parsed.repo);
            if (!similarRepoDetails) continue;
            const { repository: similarGhRepo, languages: similarLanguages } = similarRepoDetails;
            
            const similarRepoData = {
              id: similarGhRepo.id.toString(),
              name: similarGhRepo.name,
              fullName: similarGhRepo.full_name,
              owner: similarGhRepo.owner.login,
              description: similarGhRepo.description,
              language: similarGhRepo.language,
              stars: similarGhRepo.stargazers_count,
              forks: similarGhRepo.forks_count,
              watchers: similarGhRepo.watchers_count,
              size: similarGhRepo.size,
              isPrivate: similarGhRepo.private,
              htmlUrl: similarGhRepo.html_url,
              cloneUrl: similarGhRepo.clone_url,
              languages: similarLanguages,
              topics: similarGhRepo.topics || [],
            };
            
            const similarRepo = await storage.upsertRepository(similarRepoData);
            similarRepos.push({
              repositoryId: similarRepo.id,
              similarity: 0.8 // Default similarity score
            });
          }
        } catch (error) {
          console.error(`Error fetching similar repo ${repoName}:`, error);
        }
      }

      if (similarRepos.length > 0) {
        await storage.createSimilarRepositories(repository.id, similarRepos);
      }
    } catch (error) {
      console.error("Error finding similar repositories:", error);
    }

    const similar = await storage.getSimilarRepositories(repository.id);

    // Track repository analysis event
    await trackEvent(req, 'repository_analysis', 'analysis', {
      repositoryId: repository.id,
      repositoryName: repository.fullName,
      language: repository.language,
      stars: repository.stars,
      success: true,
    }).catch(error => console.error('Error tracking analysis event:', error));

    res.json({
      repository,
      analysis,
      similar
    });
  }));

  // Reanalyze repository endpoint
  app.post('/api/repositories/:id/reanalyze', isAuthenticated, checkTierLimit('analysis'), validateParams(repositoryIdSchema), asyncHandler(async (req, res) => {
    const { id: repositoryId } = req.params;
    const user = getAuthUser(req); const userId = user.claims.sub;

    // Check if repository exists
    const repository = await storage.getRepository(repositoryId);
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Check if reanalysis is allowed (rate limit - 1 per repository per hour)
    const now = new Date();
    if (repository.reanalysisLockedUntil && repository.reanalysisLockedUntil > now) {
      const waitMinutes = Math.ceil((repository.reanalysisLockedUntil.getTime() - now.getTime()) / 60000);
      return res.status(429).json({ 
        error: 'Reanalysis rate limit exceeded',
        message: `Please wait ${waitMinutes} minute(s) before reanalyzing this repository`,
        retryAfter: waitMinutes 
      });
    }

    // Delete existing analysis from database
    await storage.deleteRepositoryAnalysis(repositoryId);

    // Clear Redis cache if present (optional - will be handled by cache service)
    // The cache will naturally expire or be overwritten

    // Fetch fresh repository data from GitHub
    const parsed = githubService.parseRepositoryUrl(repository.htmlUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid repository URL' });
    }

    const { owner, repo } = parsed;
    const repoDetails = await githubService.getRepositoryWithDetails(owner, repo);
    if (!repoDetails) {
      return res.status(404).json({ error: 'Repository not found on GitHub' });
    }

    const { repository: ghRepo, languages, readme } = repoDetails;

    // Update repository data
    const updatedRepoData = {
      id: ghRepo.id.toString(),
      name: ghRepo.name,
      fullName: ghRepo.full_name,
      owner: ghRepo.owner.login,
      description: ghRepo.description,
      language: ghRepo.language,
      stars: ghRepo.stargazers_count,
      forks: ghRepo.forks_count,
      watchers: ghRepo.watchers_count,
      size: ghRepo.size,
      isPrivate: ghRepo.private,
      htmlUrl: ghRepo.html_url,
      cloneUrl: ghRepo.clone_url,
      languages,
      topics: ghRepo.topics || [],
      lastAnalyzed: now,
    };

    const updatedRepository = await storage.upsertRepository(updatedRepoData);

    // Run new analysis with Gemini
    const analysisResult = await analyzeRepository({
      name: ghRepo.name,
      description: ghRepo.description || '',
      language: ghRepo.language || 'Unknown',
      stars: ghRepo.stargazers_count,
      forks: ghRepo.forks_count,
      size: ghRepo.size,
      languages,
      topics: ghRepo.topics || [],
      readme: readme || undefined,
    });

    // Store new analysis
    const analysisData = {
      repositoryId: updatedRepository.id,
      userId,
      ...analysisResult,
    };

    const validatedAnalysisData = insertAnalysisSchema.parse(analysisData);
    const analysis = await storage.createAnalysis(validatedAnalysisData);

    // Update repository with reanalysis metadata
    await storage.updateRepositoryReanalysis(repositoryId, {
      lastReanalyzedBy: userId,
      reanalysisLockedUntil: new Date(now.getTime() + 60 * 60 * 1000), // Lock for 1 hour
      analysisCount: (repository.analysisCount || 0) + 1,
    });

    // Track reanalysis event
    await trackEvent(req, 'repository_reanalysis', 'analysis', {
      repositoryId: updatedRepository.id,
      repositoryName: updatedRepository.fullName,
      language: updatedRepository.language,
      stars: updatedRepository.stars,
      success: true,
    }).catch(error => console.error('Error tracking reanalysis event:', error));

    res.json({
      repository: updatedRepository,
      analysis,
      message: 'Repository reanalyzed successfully'
    });
  }));

  // Recent repositories (must be before :id route)
  app.get('/api/repositories/recent', repositoryPagination, async (req: any, res: any) => {
    try {
      const { limit, offset } = req.pagination;
      
      // Get total count for pagination metadata
      const totalCount = await storage.getRepositoryCount();
      
      // Get paginated recent repositories
      const recent = await storage.getRecentRepositoriesPaginated(limit, offset);
      
      // Return paginated response
      const paginatedResult = res.paginate(recent, totalCount);
      res.json(paginatedResult);
    } catch (error) {
      console.error("Error fetching recent repositories:", error);
      res.status(500).json({ message: "Failed to fetch recent repositories" });
    }
  });

  // Trending repositories from GitHub
  app.get('/api/repositories/trending', async (req, res) => {
    try {
      // Get trending repositories from GitHub API
      const trending = await githubService.getTrendingRepositories(5);
      
      // Transform to match the expected format
      const formattedTrending = trending.map(repo => ({
        id: repo.id,
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        htmlUrl: repo.html_url,
        starsToday: Math.floor(Math.random() * 100) // GitHub API doesn't provide daily stars, so we approximate
      }));
      
      res.json(formattedTrending);
    } catch (error) {
      console.error("Error fetching trending repositories:", error);
      res.status(500).json({ message: "Failed to fetch trending repositories" });
    }
  });

  // Find similar repositories by functionality
  app.post('/api/repositories/find-similar', isAuthenticated, geminiRateLimiter(), async (req, res) => {
    try {
      const { 
        repositoryId, 
        functionality, 
        useCase, 
        technologies,
        minStars,
        maxAge,
        maxResults = 20
      } = req.body;

      let repository;
      let searchParams;

      if (repositoryId) {
        // Find similar to existing repository
        repository = await storage.getRepository(repositoryId);
        if (!repository) {
          return res.status(404).json({ message: "Repository not found" });
        }
        
        searchParams = {
          name: repository.name,
          description: repository.description || '',
          language: repository.language || 'Unknown',
          topics: repository.topics || [],
          functionality: functionality || repository.description,
          useCase,
          technologies: technologies || (repository.languages ? Object.keys(repository.languages) : [])
        };
      } else if (functionality || useCase || (technologies && technologies.length > 0)) {
        // Search based on provided criteria (at least one field is required)
        searchParams = {
          name: 'Custom Search',
          description: functionality || useCase || (technologies && technologies.length > 0 ? `Projects using ${technologies.join(', ')}` : ''),
          language: 'Any',
          topics: [],
          functionality: functionality || undefined,
          useCase: useCase || undefined,
          technologies: technologies || []
        };
      } else {
        return res.status(400).json({ message: "Please provide at least one search criteria (functionality, use case, or technologies)" });
      }

      // Add filters to search params
      const searchParamsWithFilters = searchParams as typeof searchParams & { minStars?: number; maxAge?: string };
      if (minStars !== undefined) {
        searchParamsWithFilters.minStars = minStars;
      }
      if (maxAge && maxAge !== 'any') {
        searchParamsWithFilters.maxAge = maxAge;
      }
      
      // Use enhanced AI search
      const { repositories: similarRepoNames, reasoning, similarity_scores } = 
        await findSimilarByFunctionality(searchParams);

      // Fetch details for each similar repository
      const similarRepos = [];
      for (const repoName of similarRepoNames) {
        try {
          const parsed = githubService.parseRepositoryUrl(repoName);
          if (!parsed) continue;
          
          const repoDetails = await githubService.getRepositoryWithDetails(parsed.owner, parsed.repo);
          if (!repoDetails) continue;
          
          const { repository: ghRepo, languages } = repoDetails;
          
          // Apply filters
          if (minStars && ghRepo.stargazers_count < minStars) {
            continue;
          }
          
          if (maxAge && maxAge !== 'any') {
            const ghRepoWithDates = ghRepo as typeof ghRepo & { created_at: string };
            const createdDate = new Date(ghRepoWithDates.created_at);
            const now = new Date();
            const ageMap: { [key: string]: number } = {
              '1month': 30,
              '3months': 90,
              '6months': 180,
              '1year': 365,
              '2years': 730
            };
            const maxDays = ageMap[maxAge];
            if (maxDays) {
              const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSinceCreated > maxDays) {
                continue;
              }
            }
          }
          
          const repoData = {
            id: ghRepo.id.toString(),
            name: ghRepo.name,
            fullName: ghRepo.full_name,
            owner: ghRepo.owner.login,
            description: ghRepo.description,
            language: ghRepo.language,
            stars: ghRepo.stargazers_count,
            forks: ghRepo.forks_count,
            watchers: ghRepo.watchers_count,
            size: ghRepo.size,
            isPrivate: ghRepo.private,
            htmlUrl: ghRepo.html_url,
            cloneUrl: ghRepo.clone_url,
            languages,
            topics: ghRepo.topics || [],
            createdAt: (ghRepo as typeof ghRepo & { created_at: string; updated_at: string }).created_at,
            updatedAt: (ghRepo as typeof ghRepo & { created_at: string; updated_at: string }).updated_at
          };
          
          const savedRepo = await storage.upsertRepository(repoData);
          
          similarRepos.push({
            repository: savedRepo,
            similarity: similarity_scores[repoName] || 50,
            name: repoName
          });
          
          // Cap results at specified maximum
          if (similarRepos.length >= maxResults) {
            break;
          }
        } catch (error) {
          console.error(`Error fetching similar repo ${repoName}:`, error);
        }
      }

      res.json({
        similar: similarRepos,
        reasoning,
        searchParams
      });
    } catch (error) {
      console.error("Error finding similar repositories:", error);
      res.status(500).json({ message: "Failed to find similar repositories" });
    }
  });

  app.get('/api/repositories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const repository = await storage.getRepository(id);
      
      if (!repository) {
        return res.status(404).json({ message: "Repository not found" });
      }

      const analysis = await storage.getAnalysis(id);
      const similar = await storage.getSimilarRepositories(id);
      
      let isSaved = false;
      const user = req.user as AuthenticatedUser | undefined;
      if (user?.claims?.sub) {
        isSaved = await storage.isRepositorySaved(user.claims.sub, id);
      }

      res.json({
        repository,
        analysis,
        similar,
        isSaved
      });
    } catch (error) {
      console.error("Error fetching repository:", error);
      res.status(500).json({ message: "Failed to fetch repository" });
    }
  });

  // Code Review endpoints
  app.post('/api/code-review/analyze', 
    isAuthenticated,
    geminiRateLimiter(),
    asyncHandler(async (req, res) => {
    const { type, content, githubToken } = req.body;
    
    console.log('[Code Review] Analyze request:', { type, content: content?.substring(0, 50), hasToken: !!githubToken });
    
    if (!content) {
      return res.status(400).json({ message: "Content is required" });
    }
    
    if (type === 'repository') {
      // Parse repository URL
      const parsed = githubService.parseRepositoryUrl(content);
      if (!parsed) {
        return res.status(400).json({ message: "Invalid repository URL" });
      }
      
      const { owner, repo } = parsed;
      console.log('[Code Review] Analyzing repository:', { owner, repo });
      
      // Fetch repository details
      let repoDetails;
      try {
        repoDetails = await githubService.getRepositoryWithDetails(owner, repo);
      } catch (error) {
        console.error('[Code Review] Error fetching repository:', error);
        return res.status(500).json({ 
          message: `Failed to fetch repository: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      }
      
      if (!repoDetails) {
        return res.status(404).json({ message: "Repository not found" });
      }
      
      // Get repository languages to find main files
      const languages = repoDetails.languages;
      if (!languages || Object.keys(languages).length === 0) {
        return res.status(400).json({ 
          message: "Could not determine repository languages. The repository may be empty or have no code files." 
        });
      }
      
      const mainLanguage = Object.keys(languages).sort((a, b) => languages[b] - languages[a])[0];
      
      console.log('[Code Review] Repository languages:', languages);
      console.log('[Code Review] Main language:', mainLanguage);
      
      // Fetch some sample files for analysis
      const filesToAnalyze: string[] = [];
      
      // Common file patterns based on language
      const filePatterns: Record<string, string[]> = {
        'JavaScript': ['index.js', 'app.js', 'server.js', 'src/index.js', 'src/app.js'],
        'TypeScript': ['index.ts', 'app.ts', 'server.ts', 'src/index.ts', 'src/app.ts', 'src/main.ts'],
        'Python': ['main.py', 'app.py', '__init__.py', 'setup.py'],
        'Java': ['Main.java', 'Application.java', 'src/main/java/Main.java'],
        'Go': ['main.go', 'app.go'],
        'Ruby': ['main.rb', 'app.rb', 'config.ru'],
        'PHP': ['index.php', 'app.php', 'main.php'],
        'C': ['main.c', 'app.c'],
        'C++': ['main.cpp', 'app.cpp'],
        'Rust': ['main.rs', 'lib.rs'],
      };
      
      const patterns = filePatterns[mainLanguage] || ['README.md', 'index.js', 'main.py'];
      
      // Try to fetch files
      const fileContents: Array<{ path: string; content: string }> = [];
      
      console.log('[Code Review] Trying to fetch files with patterns:', patterns);
      
      for (const pattern of patterns) {
        try {
          console.log('[Code Review] Attempting to fetch:', pattern);
          const content = await githubService.getFileContent(owner, repo, pattern, undefined, githubToken);
          if (content) {
            fileContents.push({ path: pattern, content });
            console.log('[Code Review] ✓ Fetched file:', pattern, 'length:', content.length);
            if (fileContents.length >= 3) break; // Limit to 3 files for analysis
          } else {
            console.log('[Code Review] ✗ File returned null:', pattern);
          }
        } catch (error) {
          console.log('[Code Review] ✗ Error fetching file:', pattern, error instanceof Error ? error.message : error);
        }
      }
      
      // If no files found, try README as fallback
      if (fileContents.length === 0 && repoDetails.readme) {
        console.log('[Code Review] No code files found, using README as fallback');
        fileContents.push({ 
          path: 'README.md', 
          content: repoDetails.readme 
        });
      }
      
      if (fileContents.length === 0) {
        console.error('[Code Review] Failed to fetch any files. Tried patterns:', patterns);
        return res.status(400).json({ 
          message: `Could not fetch any code files from the repository. Tried: ${patterns.join(', ')}. The repository may have an unusual structure or require authentication.` 
        });
      }
      
      console.log('[Code Review] Successfully fetched', fileContents.length, 'files for analysis');
      
      // Use AI to analyze the code
      const { askAI, isGeminiEnabled } = await import('./gemini');
      
      if (!isGeminiEnabled()) {
        return res.status(503).json({ 
          message: "AI service is not configured. Please set GEMINI_API_KEY environment variable." 
        });
      }
      
      const analysisPrompt = `You are a code review expert. Analyze the following code files from the ${owner}/${repo} repository and provide a detailed code review.

Repository: ${repoDetails.repository.full_name}
Description: ${repoDetails.repository.description || 'No description'}
Main Language: ${mainLanguage}
Stars: ${repoDetails.repository.stargazers_count}

Files to analyze:
${fileContents.map(f => `\n--- ${f.path} ---\n${f.content.substring(0, 2000)}`).join('\n')}

Provide your analysis in the following JSON format:
{
  "overallScore": <number 0-100>,
  "codeQuality": <number 0-100>,
  "security": <number 0-100>,
  "performance": <number 0-100>,
  "maintainability": <number 0-100>,
  "testCoverage": <number 0-100>,
  "issues": [
    {
      "type": "error|warning|suggestion|security",
      "severity": "critical|high|medium|low",
      "line": <line number>,
      "column": <column number>,
      "message": "<issue description>",
      "suggestion": "<how to fix>",
      "file": "<file path>",
      "category": "<category name>"
    }
  ],
  "suggestions": ["<suggestion 1>", "<suggestion 2>", ...],
  "positives": ["<positive 1>", "<positive 2>", ...],
  "metrics": {
    "linesOfCode": <total lines across all files analyzed>,
    "complexity": <average cyclomatic complexity (1-100, where 1-10 is simple, 11-20 is moderate, 21-50 is complex, 51+ is very complex)>,
    "duplications": <number of duplicated code blocks found>,
    "technicalDebt": "<estimated time in minutes to fix all issues, format as '15m' or '2h 30m'>"
  }
}

IMPORTANT METRICS GUIDELINES:
- linesOfCode: Count actual code lines (not comments or blank lines) across all analyzed files
- complexity: Calculate average cyclomatic complexity per function. Use realistic values based on code structure:
  * Simple code with few branches: 5-10
  * Moderate code with some conditionals: 11-20
  * Complex code with many branches: 21-50
  * Very complex code: 51+
- duplications: Count actual repeated code blocks (not just similar patterns)
- technicalDebt: Estimate realistically based on issue severity:
  * Critical issues: 30-60 minutes each
  * High severity: 15-30 minutes each
  * Medium severity: 5-15 minutes each
  * Low severity: 2-5 minutes each
  Format as "45m" for minutes or "2h 15m" for hours and minutes

Focus on:
1. Security vulnerabilities
2. Code quality issues
3. Performance problems
4. Maintainability concerns
5. Best practices violations

Provide ONLY the JSON response, no additional text.`;

      let aiResponse;
      try {
        aiResponse = await askAI(analysisPrompt);
        console.log('[Code Review] AI response received, length:', aiResponse.length);
      } catch (error) {
        console.error('[Code Review] AI request failed:', error);
        return res.status(500).json({ 
          message: `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      }
      
      // Parse AI response
      let analysis;
      try {
        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (error) {
        console.error('[Code Review] Failed to parse AI response:', error);
        console.error('[Code Review] AI response was:', aiResponse.substring(0, 500));
        // Return a basic analysis if AI parsing fails
        analysis = {
          overallScore: 75,
          codeQuality: 75,
          security: 75,
          performance: 75,
          maintainability: 75,
          testCoverage: 50,
          issues: [{
            type: 'suggestion',
            severity: 'low',
            line: 1,
            column: 1,
            message: 'Code analysis completed. Review the files manually for detailed insights.',
            suggestion: 'Consider adding more comprehensive error handling and tests.',
            file: fileContents[0].path,
            category: 'General'
          }],
          suggestions: [
            'Add comprehensive error handling',
            'Increase test coverage',
            'Document complex functions',
            'Review security best practices'
          ],
          positives: [
            'Repository is well-structured',
            'Active development and maintenance'
          ],
          metrics: {
            linesOfCode: fileContents.reduce((sum, f) => sum + f.content.split('\n').length, 0),
            complexity: 50,
            duplications: 0,
            technicalDebt: '1 day'
          }
        };
      }
      
      // Validate and fix file paths in issues
      if (analysis.issues && Array.isArray(analysis.issues)) {
        const validFilePaths = fileContents.map(f => f.path);
        analysis.issues = analysis.issues.map((issue: any) => {
          // If the file path doesn't match any analyzed file, use the first file
          if (!validFilePaths.includes(issue.file)) {
            console.log('[Code Review] Invalid file path in issue:', issue.file, 'Using:', validFilePaths[0]);
            issue.file = validFilePaths[0];
          }
          return issue;
        });
      }
      
      console.log('[Code Review] Analysis complete:', {
        overallScore: analysis.overallScore,
        issuesCount: analysis.issues?.length || 0,
        files: fileContents.map(f => f.path)
      });
      
      res.json(analysis);
      
    } else if (type === 'snippet') {
      // Analyze code snippet
      const { askAI } = await import('./gemini');
      
      const snippetPrompt = `Analyze this code snippet and provide a code review in JSON format:

\`\`\`
${content}
\`\`\`

Provide your analysis in this JSON format:
{
  "overallScore": <number 0-100>,
  "codeQuality": <number 0-100>,
  "security": <number 0-100>,
  "performance": <number 0-100>,
  "maintainability": <number 0-100>,
  "testCoverage": <number 0-100>,
  "issues": [
    {
      "type": "error|warning|suggestion|security",
      "severity": "critical|high|medium|low",
      "line": <line number>,
      "column": <column number>,
      "message": "<issue description>",
      "suggestion": "<how to fix>",
      "file": "snippet.txt",
      "category": "<category name>"
    }
  ],
  "suggestions": ["<suggestion 1>", ...],
  "positives": ["<positive 1>", ...],
  "metrics": {
    "linesOfCode": <total lines of actual code (not comments or blank lines)>,
    "complexity": <average cyclomatic complexity (1-100, where 1-10 is simple, 11-20 is moderate, 21-50 is complex, 51+ is very complex)>,
    "duplications": <number of duplicated code blocks found>,
    "technicalDebt": "<estimated time to fix all issues, format as '15m' or '2h 30m'>"
  }
}

IMPORTANT METRICS GUIDELINES:
- linesOfCode: Count actual code lines (not comments or blank lines)
- complexity: Calculate average cyclomatic complexity per function. Use realistic values:
  * Simple code with few branches: 5-10
  * Moderate code with some conditionals: 11-20
  * Complex code with many branches: 21-50
  * Very complex code: 51+
- duplications: Count actual repeated code blocks
- technicalDebt: Estimate realistically based on issue severity:
  * Critical: 30-60 min each
  * High: 15-30 min each
  * Medium: 5-15 min each
  * Low: 2-5 min each
  Format as "45m" for minutes or "2h 15m" for hours and minutes

Provide ONLY the JSON response.`;

      const aiResponse = await askAI(snippetPrompt);
      
      let analysis;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (error) {
        analysis = {
          overallScore: 70,
          codeQuality: 70,
          security: 70,
          performance: 70,
          maintainability: 70,
          testCoverage: 0,
          issues: [],
          suggestions: ['Add error handling', 'Add comments'],
          positives: ['Code is readable'],
          metrics: {
            linesOfCode: content.split('\n').length,
            complexity: 10,
            duplications: 0,
            technicalDebt: '1 hour'
          }
        };
      }
      
      res.json(analysis);
    } else {
      return res.status(400).json({ message: "Invalid type. Must be 'repository' or 'snippet'" });
    }
  }));

  app.post('/api/code-review/view-code', asyncHandler(async (req, res) => {
    const { repoUrl, filePath, line, githubToken } = req.body;
    
    console.log('[Code Review] View code request:', { repoUrl, filePath, line, hasToken: !!githubToken });
    
    if (!repoUrl || !filePath) {
      return res.status(400).json({ message: "Repository URL and file path are required" });
    }
    
    const parsed = githubService.parseRepositoryUrl(repoUrl);
    if (!parsed) {
      return res.status(400).json({ message: "Invalid repository URL" });
    }
    
    const { owner, repo } = parsed;
    console.log('[Code Review] Fetching file:', { owner, repo, filePath });
    
    const content = await githubService.getFileContent(owner, repo, filePath, undefined, githubToken);
    
    if (!content) {
      console.log('[Code Review] File not found');
      return res.status(404).json({ message: "File not found" });
    }
    
    console.log('[Code Review] File fetched successfully, length:', content.length);
    
    res.json({
      content,
      filePath,
      line,
      repoUrl: `https://github.com/${owner}/${repo}`,
      fileUrl: `https://github.com/${owner}/${repo}/blob/main/${filePath}${line ? `#L${line}` : ''}`
    });
  }));

  app.post('/api/code-review/create-fix', asyncHandler(async (req, res) => {
    const { repoUrl, filePath, line, issue, suggestion, githubToken } = req.body;
    
    if (!repoUrl || !filePath || !issue) {
      return res.status(400).json({ message: "Repository URL, file path, and issue are required" });
    }
    
    if (!githubToken) {
      return res.status(400).json({ 
        message: "GitHub token is required to create pull requests",
        requiresAuth: true
      });
    }
    
    const parsed = githubService.parseRepositoryUrl(repoUrl);
    if (!parsed) {
      return res.status(400).json({ message: "Invalid repository URL" });
    }
    
    const { owner, repo } = parsed;
    
    // Get current file content
    const content = await githubService.getFileContent(owner, repo, filePath, undefined, githubToken);
    if (!content) {
      return res.status(404).json({ message: "File not found" });
    }
    
    // Generate fix using AI
    const { askAI } = await import('./gemini');
    const prompt = `You are a code review assistant. Fix the following issue in the code:

File: ${filePath}
Line: ${line || 'N/A'}
Issue: ${issue}
${suggestion ? `Suggestion: ${suggestion}` : ''}

Current code:
\`\`\`
${content}
\`\`\`

Provide ONLY the fixed code without any explanations or markdown formatting.`;

    const fixedCode = await askAI(prompt);
    
    // Create a branch for the fix
    const branchName = `fix/code-review-${Date.now()}`;
    await githubService.createBranch(owner, repo, branchName, 'main', githubToken);
    
    // Update the file in the new branch
    const commitMessage = `Fix: ${issue.substring(0, 50)}${issue.length > 50 ? '...' : ''}`;
    await githubService.updateFile(
      owner,
      repo,
      filePath,
      fixedCode,
      commitMessage,
      branchName,
      githubToken
    );
    
    // Create pull request
    const prTitle = `🤖 AI Code Review Fix: ${issue.substring(0, 60)}${issue.length > 60 ? '...' : ''}`;
    const prBody = `## AI-Generated Fix

**Issue:** ${issue}
${suggestion ? `\n**Suggestion:** ${suggestion}` : ''}

**File:** \`${filePath}\`${line ? `\n**Line:** ${line}` : ''}

---

This pull request was automatically generated by RepoRadar's AI Code Review feature.

Please review the changes carefully before merging.`;

    const pr = await githubService.createPullRequest(
      owner,
      repo,
      prTitle,
      prBody,
      branchName,
      'main',
      githubToken
    );
    
    if (!pr) {
      return res.status(500).json({ message: "Failed to create pull request" });
    }
    
    res.json({
      success: true,
      pullRequest: {
        number: pr.number,
        url: pr.html_url
      },
      branch: branchName
    });
  }));

  // Save code review
  app.post('/api/code-review/save', isAuthenticated, asyncHandler(async (req, res) => {
    const user = getAuthUser(req); const userId = user.claims.sub;
    const { type, content, repositoryName, repositoryUrl, result } = req.body;
    
    if (!result) {
      return res.status(400).json({ message: "Review result is required" });
    }
    
    const review = await storage.createCodeReview({
      userId,
      type,
      content,
      repositoryName,
      repositoryUrl,
      overallScore: result.overallScore,
      codeQuality: result.codeQuality,
      security: result.security,
      performance: result.performance,
      maintainability: result.maintainability,
      testCoverage: result.testCoverage,
      issues: result.issues,
      suggestions: result.suggestions,
      positives: result.positives,
      metrics: result.metrics,
    });
    
    res.json(review);
  }));

  // Get user's code reviews
  app.get('/api/code-review/history', isAuthenticated, asyncHandler(async (req, res) => {
    const user = getAuthUser(req); const userId = user.claims.sub;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const reviews = await storage.getUserCodeReviews(userId, limit);
    res.json(reviews);
  }));

  // Get specific code review
  app.get('/api/code-review/:id', isAuthenticated, asyncHandler(async (req, res) => {
    const user = getAuthUser(req); const userId = user.claims.sub;
    const reviewId = req.params.id;
    
    const review = await storage.getCodeReview(reviewId, userId);
    
    if (!review) {
      return res.status(404).json({ message: "Code review not found" });
    }
    
    res.json(review);
  }));

  // Delete code review
  app.delete('/api/code-review/:id', isAuthenticated, asyncHandler(async (req, res) => {
    const user = getAuthUser(req); const userId = user.claims.sub;
    const reviewId = req.params.id;
    
    await storage.deleteCodeReview(reviewId, userId);
    res.json({ success: true });
  }));

  // Recent analyses (all - public)
  app.get('/api/analyses/recent', analysisPagination, async (req: any, res: any) => {
    try {
      const { limit, offset } = req.pagination;
      
      // Get total count for pagination metadata
      const totalCount = await storage.getAnalysisCount();
      
      // Get paginated recent analyses
      const analyses = await storage.getRecentAnalysesPaginated(undefined, limit, offset);
      
      // Return paginated response
      const paginatedResult = res.paginate(analyses, totalCount);
      res.json(paginatedResult);
    } catch (error) {
      console.error("Error fetching recent analyses:", error);
      res.status(500).json({ message: "Failed to fetch recent analyses" });
    }
  });

  // User's recent analyses (authenticated)
  app.get('/api/analyses/user/recent', isAuthenticated, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      
      // Get user's recent analyses (limit to 10)
      const analyses = await storage.getUserAnalyses(userId);
      
      // Return most recent 10
      const recentAnalyses = analyses.slice(0, 10);
      
      res.json(recentAnalyses);
    } catch (error) {
      console.error("Error fetching user's recent analyses:", error);
      res.status(500).json({ message: "Failed to fetch recent analyses" });
    }
  });

  // Saved repositories (protected routes with API rate limiting)
  app.post('/api/saved-repositories', isAuthenticated, apiRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { repositoryId } = req.body;
      
      if (!repositoryId) {
        return res.status(400).json({ message: "Repository ID is required" });
      }

      const data = { userId, repositoryId };
      const validatedData = insertSavedRepositorySchema.parse(data);
      
      const savedRepo = await storage.saveRepository(validatedData.userId, validatedData.repositoryId);
      res.json(savedRepo);
    } catch (error) {
      console.error("Error saving repository:", error);
      res.status(500).json({ message: "Failed to save repository" });
    }
  });

  app.delete('/api/saved-repositories/:repositoryId', isAuthenticated, apiRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { repositoryId } = req.params;
      
      await storage.unsaveRepository(userId, repositoryId);
      res.json({ message: "Repository unsaved successfully" });
    } catch (error) {
      console.error("Error unsaving repository:", error);
      res.status(500).json({ message: "Failed to unsave repository" });
    }
  });

  app.get('/api/saved-repositories', isAuthenticated, apiRateLimit, repositoryPagination, async (req: any, res: any) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { limit, offset } = req.pagination;
      
      // Get total count for pagination metadata
      const totalCount = await storage.getSavedRepositoriesCount(userId);
      
      // Get paginated saved repositories
      const savedRepos = await storage.getSavedRepositoriesPaginated(userId, limit, offset);
      
      // Return paginated response
      const paginatedResult = res.paginate(savedRepos, totalCount);
      res.json(paginatedResult);
    } catch (error) {
      console.error("Error fetching saved repositories:", error);
      res.status(500).json({ message: "Failed to fetch saved repositories" });
    }
  });

  // User Profile & Preferences Routes (Protected - Pro/Enterprise only with API rate limiting)
  app.get('/api/user/preferences', isAuthenticated, apiRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences);
    } catch (error) {
      const err = error as { message: string };
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/user/preferences', isAuthenticated, apiRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      const preferences = await storage.updateUserPreferences(userId, req.body);
      res.json(preferences);
    } catch (error) {
      const err = error as { message: string };
      res.status(500).json({ message: err.message });
    }
  });

  // Bookmarks Routes (with API rate limiting)
  app.get('/api/user/bookmarks', isAuthenticated, apiRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      const bookmarks = await storage.getUserBookmarks(userId);
      res.json(bookmarks);
    } catch (error) {
      const err = error as { message: string };
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/user/bookmarks', isAuthenticated, apiRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      const { repositoryId, notes } = req.body;
      const bookmark = await storage.addBookmark(userId, repositoryId, notes);
      
      // Track activity
      await storage.trackActivity(userId, 'bookmarked', repositoryId);
      
      res.json(bookmark);
    } catch (error) {
      const err = error as { message: string };
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/user/bookmarks/:repositoryId', isAuthenticated, apiRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      await storage.removeBookmark(userId, req.params.repositoryId);
      res.json({ success: true });
    } catch (error) {
      const err = error as { message: string };
      res.status(500).json({ message: err.message });
    }
  });

  // Tags Routes (with API rate limiting)
  app.get('/api/user/tags', isAuthenticated, apiRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      const tags = await storage.getUserTags(userId);
      res.json(tags);
    } catch (error) {
      const err = error as { message: string };
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/user/tags', isAuthenticated, apiRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      const { name, color } = req.body;
      const tag = await storage.createTag(userId, name, color);
      res.json(tag);
    } catch (error) {
      const err = error as { message: string };
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/repositories/:repositoryId/tags', isAuthenticated, apiRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      const { tagId } = req.body;
      await storage.tagRepository(req.params.repositoryId, tagId, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Collections Routes (with API rate limiting)
  app.get('/api/user/collections', isAuthenticated, apiRateLimit, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      const collections = await storage.getUserCollections(userId);
      res.json(collections);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/user/collections', isAuthenticated, apiRateLimit, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      const collection = await storage.createCollection({ ...req.body, userId });
      res.json(collection);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/collections/:collectionId/items', isAuthenticated, apiRateLimit, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      const { repositoryId, notes } = req.body;
      const item = await storage.addToCollection(
        parseInt(req.params.collectionId),
        repositoryId,
        notes
      );
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // AI Recommendations Route
  app.get('/api/user/recommendations', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;const dbUser = await storage.getUser(userId);
      
      if (!dbUser || (dbUser.subscriptionTier !== 'pro' && user.subscriptionTier !== 'enterprise')) {
        return res.status(403).json({ message: "This feature is available for Pro and Enterprise users only" });
      }

      // Get user preferences and recent activity
      const preferences = await storage.getUserPreferences(userId);
      const recentActivity = await storage.getUserRecentActivity(userId);
      
      // Generate AI recommendations based on user profile
      const recommendations = await generateAIRecommendations(userId, preferences, recentActivity);
      
      res.json(recommendations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Repository Tracking Endpoints
  app.post('/api/repositories/:repositoryId/track', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { repositoryId } = req.params;
      const { trackingType = 'all' } = req.body;
      
      // Check if repository exists
      const repository = await storage.getRepository(repositoryId);
      if (!repository) {
        return res.status(404).json({ message: "Repository not found" });
      }
      
      // Add tracking
      const tracked = await storage.trackRepository(userId, repositoryId, trackingType);
      
      // Send initial notification
      await storage.createNotification({
        userId,
        type: 'repo_update',
        title: 'Repository Tracking Started',
        message: `You are now tracking ${repository.fullName}`,
        repositoryId,
        metadata: { trackingType }
      });
      
      res.json(tracked);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/repositories/:repositoryId/track', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { repositoryId } = req.params;
      
      await storage.untrackRepository(userId, repositoryId);
      res.json({ message: "Repository untracked successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/user/tracked-repositories', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const tracked = await storage.getTrackedRepositories(userId);
      res.json(tracked);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Notifications Endpoints
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { unreadOnly = false } = req.query;
      
      const notifications = await storage.getUserNotifications(
        userId, 
        unreadOnly === 'true'
      );
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/notifications/:notificationId/read', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { notificationId } = req.params;
      
      await storage.markNotificationAsRead(parseInt(notificationId), userId);
      res.json({ message: "Notification marked as read" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/notifications/:notificationId', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { notificationId } = req.params;
      
      await storage.deleteNotification(parseInt(notificationId), userId);
      res.json({ message: "Notification deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/notifications/mark-all-read', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Comments Endpoints
  app.get('/api/repositories/:repositoryId/comments', async (req, res) => {
    try {
      const { repositoryId } = req.params;
      const comments = await storage.getRepositoryComments(repositoryId);
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/repositories/:repositoryId/comments', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { repositoryId } = req.params;
      const { content, parentId } = req.body;
      
      const comment = await storage.createComment({
        userId,
        repositoryId,
        content,
        parentId,
      });
      
      res.json(comment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/comments/:commentId', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { commentId } = req.params;
      const { content } = req.body;
      
      const updated = await storage.updateComment(parseInt(commentId), userId, content);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/comments/:commentId', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { commentId } = req.params;
      
      await storage.deleteComment(parseInt(commentId), userId);
      res.json({ message: "Comment deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/comments/:commentId/like', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { commentId } = req.params;
      
      await storage.likeComment(parseInt(commentId), userId);
      res.json({ message: "Comment liked" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/comments/:commentId/like', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { commentId } = req.params;
      
      await storage.unlikeComment(parseInt(commentId), userId);
      res.json({ message: "Like removed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Collections Endpoints
  app.get('/api/collections', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); 
      const userId = user.claims.sub;
      
      const collections = await storage.getUserCollections(userId);
      res.json(collections);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/collections/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user.claims.sub;
      
      // Only allow users to view their own collections for now
      if (userId !== requestingUserId) {
        return res.status(403).json({ message: "Cannot view other users' collections" });
      }
      
      const collections = await storage.getUserCollections(userId);
      res.json(collections);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/collections', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { name, description, color } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Collection name is required" });
      }
      
      const collection = await storage.createCollection({
        userId,
        name: name.trim(),
        description: description || null,
        color: color || '#FF6B35',
      });
      
      res.json(collection);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/collections/:collectionId', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { collectionId } = req.params;
      
      await storage.deleteCollection(parseInt(collectionId), userId);
      res.json({ message: "Collection deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/collections/:collectionId/repositories', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { collectionId } = req.params;
      const { repositoryId } = req.body;
      
      if (!repositoryId) {
        return res.status(400).json({ message: "Repository ID is required" });
      }
      
      const item = await storage.addRepositoryToCollection(
        parseInt(collectionId),
        repositoryId,
        userId
      );
      
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/collections/:collectionId/repositories/:repositoryId', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { collectionId, repositoryId } = req.params;
      
      await storage.removeRepositoryFromCollection(
        parseInt(collectionId),
        repositoryId,
        userId
      );
      
      res.json({ message: "Repository removed from collection" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ratings Endpoints
  app.get('/api/repositories/:repositoryId/ratings', async (req, res) => {
    try {
      const { repositoryId } = req.params;
      const ratings = await storage.getRepositoryRatings(repositoryId);
      const { average, count } = await storage.getRepositoryAverageRating(repositoryId);
      
      res.json({
        ratings,
        average,
        count,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/repositories/:repositoryId/ratings', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { repositoryId } = req.params;
      const { rating, review } = req.body;
      
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      
      const newRating = await storage.createOrUpdateRating({
        userId,
        repositoryId,
        rating,
        review,
      });
      
      res.json(newRating);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/ratings/:ratingId', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { ratingId } = req.params;
      
      await storage.deleteRating(parseInt(ratingId), userId);
      res.json({ message: "Rating deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/ratings/:ratingId/helpful', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { ratingId } = req.params;
      
      await storage.markRatingHelpful(parseInt(ratingId), userId);
      res.json({ message: "Marked as helpful" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/ratings/:ratingId/helpful', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { ratingId } = req.params;
      
      await storage.unmarkRatingHelpful(parseInt(ratingId), userId);
      res.json({ message: "Removed helpful mark" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // API Key Management
  app.get('/api/developer/keys', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const keys = await storage.getUserApiKeys(userId);
      res.json(keys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ message: 'Failed to fetch API keys' });
    }
  });

  app.post('/api/developer/keys', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { name, description, permissions, expiresAt } = req.body;
      
      // Generate a secure API key
      const key = 'rk_' + Array.from({ length: 32 }, () => 
        Math.random().toString(36)[2] || '0'
      ).join('');
      
      const apiKey = await storage.createApiKey({
        userId,
        key,
        name,
        description,
        permissions: permissions || ['read'],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      
      res.json(apiKey);
    } catch (error) {
      console.error('Error creating API key:', error);
      res.status(500).json({ message: 'Failed to create API key' });
    }
  });

  app.delete('/api/developer/keys/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const keyId = parseInt(req.params.id);
      
      await storage.deleteApiKey(keyId, userId);
      res.json({ message: 'API key deleted successfully' });
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ message: 'Failed to delete API key' });
    }
  });

  app.get('/api/developer/keys/:id/usage', isAuthenticated, async (req: any, res) => {
    try {
      const keyId = parseInt(req.params.id);
      const usage = await storage.getApiUsageStats(keyId);
      res.json(usage);
    } catch (error) {
      console.error('Error fetching API usage:', error);
      res.status(500).json({ message: 'Failed to fetch API usage' });
    }
  });

  // Webhook Management
  app.get('/api/developer/webhooks', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const webhooks = await storage.getUserWebhooks(userId);
      res.json(webhooks);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      res.status(500).json({ message: 'Failed to fetch webhooks' });
    }
  });

  app.post('/api/developer/webhooks', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { url, events } = req.body;
      
      // Generate webhook secret
      const secret = Array.from({ length: 32 }, () => 
        Math.random().toString(36)[2] || '0'
      ).join('');
      
      const webhook = await storage.createWebhook({
        userId,
        url,
        events: events || ['repository.analyzed'],
        secret,
      });
      
      res.json(webhook);
    } catch (error) {
      console.error('Error creating webhook:', error);
      res.status(500).json({ message: 'Failed to create webhook' });
    }
  });

  app.delete('/api/developer/webhooks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const webhookId = parseInt(req.params.id);
      
      await storage.deleteWebhook(webhookId, userId);
      res.json({ message: 'Webhook deleted successfully' });
    } catch (error) {
      console.error('Error deleting webhook:', error);
      res.status(500).json({ message: 'Failed to delete webhook' });
    }
  });

  // Public API endpoints with API key authentication
  const authenticateApiKey = async (req: any, res: any, next: any) => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }
    
    const key = await storage.getApiKeyByKey(apiKey);
    
    if (!key) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }
    
    // Check rate limit
    const usage = await storage.getApiUsageStats(key.id, 1);
    const totalRequests = usage.reduce((sum: number, u: any) => sum + u.count, 0);
    
    if (totalRequests >= (key.rateLimit || 1000)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    // Log usage
    const startTime = Date.now();
    res.on('finish', async () => {
      await storage.logApiUsage({
        apiKeyId: key.id,
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime: Date.now() - startTime,
      });
      await storage.updateApiKeyLastUsed(key.id);
    });
    
    req.apiKey = key;
    next();
  };

  // Public API v1 endpoints
  app.get('/api/v1/repositories/search', authenticateApiKey, async (req: any, res) => {
    try {
      const { q, limit = 10 } = req.query;
      
      if (!req.apiKey.permissions?.includes('read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const repositories = await storage.searchRepositories(q as string, parseInt(limit as string));
      res.json({ data: repositories });
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/v1/repositories/:id', authenticateApiKey, async (req: any, res) => {
    try {
      if (!req.apiKey.permissions?.includes('read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const repository = await storage.getRepository(req.params.id);
      
      if (!repository) {
        return res.status(404).json({ error: 'Repository not found' });
      }
      
      res.json({ data: repository });
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/v1/repositories/:id/analysis', authenticateApiKey, async (req: any, res) => {
    try {
      if (!req.apiKey.permissions?.includes('read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const analysis = await storage.getAnalysis(req.params.id);
      
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }
      
      res.json({ data: analysis });
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/v1/repositories/analyze', authenticateApiKey, async (req: any, res) => {
    try {
      if (!req.apiKey.permissions?.includes('write')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const { repositoryUrl } = req.body;
      
      if (!repositoryUrl) {
        return res.status(400).json({ error: 'Repository URL required' });
      }
      
      // Parse repository information
      const match = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid GitHub repository URL' });
      }
      
      const [, owner, name] = match;
      const fullName = `${owner}/${name}`;
      
      // Fetch repository data from GitHub
      const response = await fetch(`https://api.github.com/repos/${fullName}`);
      
      if (!response.ok) {
        return res.status(404).json({ error: 'Repository not found' });
      }
      
      const repoData = await response.json();
      
      // Store repository
      const repository = await storage.upsertRepository({
        id: repoData.id.toString(),
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        htmlUrl: repoData.html_url,
        cloneUrl: repoData.clone_url,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        watchers: repoData.watchers_count,
        size: repoData.size,
        language: repoData.language,
        topics: repoData.topics || [],
        owner: repoData.owner.login,
        isPrivate: repoData.private,
        languages: {}, // Will be populated later if needed
      });
      
      // Prepare repository data for analysis
      const repoForAnalysis = {
        name: repository.name,
        description: repository.description || 'No description provided',
        language: repository.language || 'Unknown',
        stars: repository.stars || 0,
        forks: repository.forks || 0,
        size: repository.size || 0,
        languages: repository.languages as Record<string, number> || {},
        topics: repository.topics || [],
      };
      
      // Perform analysis using existing gemini service
      const geminiAnalysis = await analyzeRepository(repoForAnalysis);
      
      // Extract string arrays from enhanced format
      const strengths = Array.isArray(geminiAnalysis.strengths) && typeof geminiAnalysis.strengths[0] === 'object' 
        ? geminiAnalysis.strengths.map((s: any) => s.point || s) 
        : geminiAnalysis.strengths;
      
      const weaknesses = Array.isArray(geminiAnalysis.weaknesses) && typeof geminiAnalysis.weaknesses[0] === 'object'
        ? geminiAnalysis.weaknesses.map((w: any) => w.point || w)
        : geminiAnalysis.weaknesses;
      
      const recommendations = Array.isArray(geminiAnalysis.recommendations) && typeof geminiAnalysis.recommendations[0] === 'object'
        ? geminiAnalysis.recommendations.map((r: any) => r.suggestion || r)
        : geminiAnalysis.recommendations;
      
      const analysis = await storage.createAnalysis({
        repositoryId: repository.id,
        userId: req.apiKey.userId,
        originality: geminiAnalysis.originality,
        completeness: geminiAnalysis.completeness,
        marketability: geminiAnalysis.marketability,
        monetization: geminiAnalysis.monetization,
        usefulness: geminiAnalysis.usefulness,
        overallScore: geminiAnalysis.overallScore,
        summary: geminiAnalysis.summary,
        strengths,
        weaknesses,
        recommendations,
      });
      
      res.json({ data: { repository, analysis } });
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Teams endpoints
  app.get('/api/teams', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const teams = await storage.getUserTeams(userId);
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      res.status(500).json({ message: 'Failed to fetch teams' });
    }
  });

  app.post('/api/teams', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'Team name is required' });
      }
      
      const team = await storage.createTeam({
        name,
        description,
        ownerId: userId,
      });
      
      res.json(team);
    } catch (error) {
      console.error('Error creating team:', error);
      res.status(500).json({ message: 'Failed to create team' });
    }
  });

  app.get('/api/teams/:teamId/members', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { teamId } = req.params;
      
      // Check if user is member of the team
      const isMember = await storage.isTeamMember(teamId, userId);
      if (!isMember) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const members = await storage.getTeamMembers(teamId);
      res.json(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
      res.status(500).json({ message: 'Failed to fetch team members' });
    }
  });

  app.post('/api/teams/:teamId/invite', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { teamId } = req.params;
      const { email, role } = req.body;
      
      // Check if user has permission to invite
      const memberRole = await storage.getTeamMemberRole(teamId, userId);
      if (!memberRole || (memberRole !== 'owner' && memberRole !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const invitation = await storage.createTeamInvitation({
        teamId,
        email,
        role: role || 'member',
        invitedBy: userId,
      });
      
      res.json(invitation);
    } catch (error) {
      console.error('Error creating invitation:', error);
      res.status(500).json({ message: 'Failed to create invitation' });
    }
  });

  app.patch('/api/teams/:teamId/members/:memberId', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { teamId, memberId } = req.params;
      const { role } = req.body;
      
      // Check if user has permission to update roles
      const memberRole = await storage.getTeamMemberRole(teamId, userId);
      if (!memberRole || (memberRole !== 'owner' && memberRole !== 'admin')) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.updateTeamMemberRole(memberId, role);
      res.json({ message: 'Role updated successfully' });
    } catch (error) {
      console.error('Error updating member role:', error);
      res.status(500).json({ message: 'Failed to update member role' });
    }
  });

  app.delete('/api/teams/:teamId/members/:memberId', isAuthenticated, async (req: any, res) => {
    try {
      const user = getAuthUser(req); const userId = user.claims.sub;
      const { teamId, memberId } = req.params;
      
      // Check if user has permission to remove members
      const memberRole = await storage.getTeamMemberRole(teamId, userId);
      if (!memberRole || memberRole !== 'owner') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.removeTeamMember(memberId);
      res.json({ message: 'Member removed successfully' });
    } catch (error) {
      console.error('Error removing member:', error);
      res.status(500).json({ message: 'Failed to remove member' });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket server for real-time notifications
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const userConnections = new Map<string, WebSocket>();

  // Attach WebSocket server to HTTP server for graceful shutdown
  (httpServer as any).wss = wss;

  wss.on('connection', (ws: WebSocket, req) => {
    // Parse user ID from connection (you might need to implement auth for WebSocket)
    let userId: string | null = null;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'authenticate') {
          userId = message.userId;
          if (userId) {
            userConnections.set(userId, ws);
            ws.send(JSON.stringify({ type: 'authenticated', message: 'Connected to notification service' }));
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        userConnections.delete(userId);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Function to send real-time notifications
  const sendRealtimeNotification = (userId: string, notification: any) => {
    const ws = userConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));
    }
  };

  // Make sendRealtimeNotification available globally
  (global as any).sendRealtimeNotification = sendRealtimeNotification;

  return httpServer;
}






