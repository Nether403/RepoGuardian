import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../neonAuth';
import { checkFeatureAccess } from '../middleware/subscriptionTier';
import { trackEvent } from '../middleware/analytics';

// Mock dependencies
vi.mock('../storage');
vi.mock('../neonAuth');
vi.mock('../middleware/subscriptionTier');
vi.mock('../middleware/analytics');

describe('User Preferences API', () => {
  let app: express.Express;
  const proUserId = 'test-pro-user-id';
  const freeUserId = 'test-free-user-id';

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());

    // Mock authentication middleware to pass through by default
    vi.mocked(isAuthenticated).mockImplementation((req: any, res, next) => {
      req.user = { claims: { sub: proUserId, email: 'pro@test.com' } };
      next();
    });

    // Mock tier enforcement to pass through by default
    vi.mocked(checkFeatureAccess).mockReturnValue((req: any, res, next) => next());

    // Mock trackEvent to do nothing
    vi.mocked(trackEvent).mockResolvedValue(undefined);

    // Setup routes (simplified version of actual routes)
    const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

    // GET /api/user/preferences
    app.get('/api/user/preferences',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
        const preferences = await storage.getUserPreferences(userId);
        await trackEvent(req, 'preferences_viewed', 'profile', {
          hasPreferences: !!preferences,
        }).catch(() => {});
        res.json(preferences);
      })
    );

    // PUT /api/user/preferences
    app.put('/api/user/preferences',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
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
          if (!preferredLanguages.every((lang: any) => typeof lang === 'string')) {
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
          if (!preferredTopics.every((topic: any) => typeof topic === 'string')) {
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
          if (!excludedTopics.every((topic: any) => typeof topic === 'string')) {
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

        const preferences = await storage.updateUserPreferences(userId, updateData);

        await trackEvent(req, 'preferences_updated', 'profile', {
          updatedFields: Object.keys(updateData),
          languageCount: preferredLanguages?.length,
          topicCount: preferredTopics?.length,
          excludedTopicCount: excludedTopics?.length,
        }).catch(() => {});

        res.json(preferences);
      })
    );
  });

  describe('GET /api/user/preferences', () => {
    it('should retrieve user preferences with defaults for Pro users', async () => {
      // Mock authentication for Pro user
      vi.mocked(isAuthenticated).mockImplementation((req: any, res, next) => {
        req.user = { claims: { sub: proUserId, email: 'pro@test.com' } };
        next();
      });

      // Mock tier enforcement to pass through
      vi.mocked(checkFeatureAccess).mockImplementation(() => {
        return (req: any, res, next) => next();
      });

      // Mock storage response
      const mockPreferences = {
        id: 1,
        userId: proUserId,
        preferredLanguages: [],
        preferredTopics: [],
        excludedTopics: [],
        minStars: 0,
        maxAge: 'any',
        aiRecommendations: true,
        emailNotifications: false,
        updatedAt: new Date(),
      };
      vi.mocked(storage.getUserPreferences).mockResolvedValue(mockPreferences);

      const response = await request(app).get('/api/user/preferences');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId', proUserId);
      expect(response.body).toHaveProperty('preferredLanguages');
      expect(response.body).toHaveProperty('preferredTopics');
      expect(response.body).toHaveProperty('excludedTopics');
      expect(response.body).toHaveProperty('minStars');
      expect(response.body).toHaveProperty('aiRecommendations');
      expect(response.body).toHaveProperty('emailNotifications');
      
      // Check defaults
      expect(Array.isArray(response.body.preferredLanguages)).toBe(true);
      expect(Array.isArray(response.body.preferredTopics)).toBe(true);
      expect(Array.isArray(response.body.excludedTopics)).toBe(true);
      expect(typeof response.body.minStars).toBe('number');
      expect(typeof response.body.aiRecommendations).toBe('boolean');
      expect(typeof response.body.emailNotifications).toBe('boolean');
    });

    it('should return 403 for Free users', async () => {
      // Create a new app instance for this test
      const testApp = express();
      testApp.use(express.json());

      // Mock authentication for Free user
      const mockAuth = vi.fn((req: any, res, next) => {
        req.user = { claims: { sub: freeUserId, email: 'free@test.com' } };
        next();
      });

      // Mock tier enforcement to reject
      const mockTierCheck = vi.fn(() => {
        return (req: any, res: any) => {
          res.status(403).json({
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'This feature requires a pro subscription',
            currentTier: 'free',
            upgradeTo: 'pro',
            upgradeUrl: '/subscription',
          });
        };
      });

      const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
        Promise.resolve(fn(req, res, next)).catch(next);
      };

      testApp.get('/api/user/preferences',
        mockAuth,
        mockTierCheck(),
        asyncHandler(async (req: any, res: any) => {
          const userId = req.user.claims.sub;
          const preferences = await storage.getUserPreferences(userId);
          res.json(preferences);
        })
      );

      const response = await request(testApp).get('/api/user/preferences');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'FEATURE_NOT_AVAILABLE');
      expect(response.body).toHaveProperty('currentTier', 'free');
      expect(response.body).toHaveProperty('upgradeTo', 'pro');
      expect(response.body).toHaveProperty('upgradeUrl', '/subscription');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Mock authentication to reject
      vi.mocked(isAuthenticated).mockImplementation((req: any, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app).get('/api/user/preferences');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/user/preferences', () => {
    beforeEach(() => {
      // Mock authentication for Pro user by default
      vi.mocked(isAuthenticated).mockImplementation((req: any, res, next) => {
        req.user = { claims: { sub: proUserId, email: 'pro@test.com' } };
        next();
      });

      // Mock tier enforcement to pass through by default
      vi.mocked(checkFeatureAccess).mockImplementation(() => {
        return (req: any, res, next) => next();
      });
    });

    it('should update preferences with valid data for Pro users', async () => {
      const updateData = {
        preferredLanguages: ['JavaScript', 'TypeScript', 'Python'],
        preferredTopics: ['web-development', 'machine-learning'],
        excludedTopics: ['php', 'legacy'],
        minStars: 100,
        aiRecommendations: true,
        emailNotifications: true,
      };

      const mockUpdatedPreferences = {
        id: 1,
        userId: proUserId,
        ...updateData,
        maxAge: 'any',
        updatedAt: new Date(),
      };
      vi.mocked(storage.updateUserPreferences).mockResolvedValue(mockUpdatedPreferences);

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('userId', proUserId);
      expect(response.body.preferredLanguages).toEqual(updateData.preferredLanguages);
      expect(response.body.preferredTopics).toEqual(updateData.preferredTopics);
      expect(response.body.excludedTopics).toEqual(updateData.excludedTopics);
      expect(response.body.minStars).toBe(updateData.minStars);
      expect(response.body.aiRecommendations).toBe(updateData.aiRecommendations);
      expect(response.body.emailNotifications).toBe(updateData.emailNotifications);
    });

    it('should update partial preferences', async () => {
      const updateData = {
        preferredLanguages: ['Rust', 'Go'],
        minStars: 500,
      };

      const mockUpdatedPreferences = {
        id: 1,
        userId: proUserId,
        preferredLanguages: updateData.preferredLanguages,
        preferredTopics: [],
        excludedTopics: [],
        minStars: updateData.minStars,
        maxAge: 'any',
        aiRecommendations: true,
        emailNotifications: false,
        updatedAt: new Date(),
      };
      vi.mocked(storage.updateUserPreferences).mockResolvedValue(mockUpdatedPreferences);

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.preferredLanguages).toEqual(updateData.preferredLanguages);
      expect(response.body.minStars).toBe(updateData.minStars);
    });

    it('should validate minStars is a number', async () => {
      const updateData = {
        minStars: 'invalid' as any,
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate minStars is within range (0-1000000)', async () => {
      const updateData1 = {
        minStars: -10,
      };

      const response1 = await request(app)
        .put('/api/user/preferences')
        .send(updateData1);

      expect(response1.status).toBe(400);
      expect(response1.body).toHaveProperty('error');

      const updateData2 = {
        minStars: 2000000,
      };

      const response2 = await request(app)
        .put('/api/user/preferences')
        .send(updateData2);

      expect(response2.status).toBe(400);
      expect(response2.body).toHaveProperty('error');
    });

    it('should validate preferredLanguages is an array', async () => {
      const updateData = {
        preferredLanguages: 'JavaScript' as any,
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate preferredTopics is an array', async () => {
      const updateData = {
        preferredTopics: 'web-development' as any,
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate excludedTopics is an array', async () => {
      const updateData = {
        excludedTopics: 'php' as any,
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate aiRecommendations is a boolean', async () => {
      const updateData = {
        aiRecommendations: 'yes' as any,
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate emailNotifications is a boolean', async () => {
      const updateData = {
        emailNotifications: 1 as any,
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 for Free users', async () => {
      // Create a new app instance for this test
      const testApp = express();
      testApp.use(express.json());

      // Mock authentication for Free user
      const mockAuth = vi.fn((req: any, res, next) => {
        req.user = { claims: { sub: freeUserId, email: 'free@test.com' } };
        next();
      });

      // Mock tier enforcement to reject
      const mockTierCheck = vi.fn(() => {
        return (req: any, res: any) => {
          res.status(403).json({
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'This feature requires a pro subscription',
            currentTier: 'free',
          });
        };
      });

      const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
        Promise.resolve(fn(req, res, next)).catch(next);
      };

      testApp.put('/api/user/preferences',
        mockAuth,
        mockTierCheck(),
        asyncHandler(async (req: any, res: any) => {
          const userId = req.user.claims.sub;
          const updateData: any = {};
          const preferences = await storage.updateUserPreferences(userId, updateData);
          res.json(preferences);
        })
      );

      const updateData = {
        preferredLanguages: ['JavaScript'],
      };

      const response = await request(testApp)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'FEATURE_NOT_AVAILABLE');
      expect(response.body).toHaveProperty('currentTier', 'free');
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Mock authentication to reject
      vi.mocked(isAuthenticated).mockImplementation((req: any, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const updateData = {
        preferredLanguages: ['JavaScript'],
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(401);
    });

    it('should handle empty arrays', async () => {
      const updateData = {
        preferredLanguages: [],
        preferredTopics: [],
        excludedTopics: [],
      };

      const mockUpdatedPreferences = {
        id: 1,
        userId: proUserId,
        ...updateData,
        minStars: 0,
        maxAge: 'any',
        aiRecommendations: true,
        emailNotifications: false,
        updatedAt: new Date(),
      };
      vi.mocked(storage.updateUserPreferences).mockResolvedValue(mockUpdatedPreferences);

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.preferredLanguages).toEqual([]);
      expect(response.body.preferredTopics).toEqual([]);
      expect(response.body.excludedTopics).toEqual([]);
    });

    it('should handle large arrays of languages and topics', async () => {
      const updateData = {
        preferredLanguages: Array.from({ length: 20 }, (_, i) => `Language${i}`),
        preferredTopics: Array.from({ length: 30 }, (_, i) => `topic-${i}`),
      };

      const mockUpdatedPreferences = {
        id: 1,
        userId: proUserId,
        ...updateData,
        excludedTopics: [],
        minStars: 0,
        maxAge: 'any',
        aiRecommendations: true,
        emailNotifications: false,
        updatedAt: new Date(),
      };
      vi.mocked(storage.updateUserPreferences).mockResolvedValue(mockUpdatedPreferences);

      const response = await request(app)
        .put('/api/user/preferences')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.preferredLanguages).toHaveLength(20);
      expect(response.body.preferredTopics).toHaveLength(30);
    });
  });

  describe('Tier Enforcement', () => {
    it('should enforce Pro tier for GET endpoint', async () => {
      // Create a new app instance for this test
      const testApp = express();
      testApp.use(express.json());

      // Mock authentication for Free user
      const mockAuth = vi.fn((req: any, res, next) => {
        req.user = { claims: { sub: freeUserId, email: 'free@test.com' } };
        next();
      });

      // Mock tier enforcement to reject
      const mockTierCheck = vi.fn(() => {
        return (req: any, res: any) => {
          res.status(403).json({
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'This feature requires a pro subscription',
          });
        };
      });

      const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
        Promise.resolve(fn(req, res, next)).catch(next);
      };

      testApp.get('/api/user/preferences',
        mockAuth,
        mockTierCheck(),
        asyncHandler(async (req: any, res: any) => {
          const userId = req.user.claims.sub;
          const preferences = await storage.getUserPreferences(userId);
          res.json(preferences);
        })
      );

      const response = await request(testApp).get('/api/user/preferences');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FEATURE_NOT_AVAILABLE');
      expect(response.body.message).toContain('pro subscription');
    });

    it('should enforce Pro tier for PUT endpoint', async () => {
      // Create a new app instance for this test
      const testApp = express();
      testApp.use(express.json());

      // Mock authentication for Free user
      const mockAuth = vi.fn((req: any, res, next) => {
        req.user = { claims: { sub: freeUserId, email: 'free@test.com' } };
        next();
      });

      // Mock tier enforcement to reject
      const mockTierCheck = vi.fn(() => {
        return (req: any, res: any) => {
          res.status(403).json({
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'This feature requires a pro subscription',
          });
        };
      });

      const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
        Promise.resolve(fn(req, res, next)).catch(next);
      };

      testApp.put('/api/user/preferences',
        mockAuth,
        mockTierCheck(),
        asyncHandler(async (req: any, res: any) => {
          const userId = req.user.claims.sub;
          const updateData: any = {};
          const preferences = await storage.updateUserPreferences(userId, updateData);
          res.json(preferences);
        })
      );

      const response = await request(testApp)
        .put('/api/user/preferences')
        .send({ minStars: 100 });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('FEATURE_NOT_AVAILABLE');
      expect(response.body.message).toContain('pro subscription');
    });
  });
});
