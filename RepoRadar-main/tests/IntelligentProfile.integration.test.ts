import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import session from 'express-session';

/**
 * Integration Tests for Intelligent User Profile Feature
 * 
 * This test suite validates complete flows:
 * - Bookmark flow (add, view, remove)
 * - Tag flow (create, apply, filter, delete)
 * - Preferences update flow
 * - Recommendation generation and dismissal flow
 * - Tier enforcement across all features
 */

// Mock dependencies
vi.mock('../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../server/gemini', () => ({
  generateAIRecommendations: vi.fn().mockResolvedValue([
    {
      type: 'repository',
      title: 'Check out react-query',
      description: 'Based on your interest in state management',
      metadata: { url: 'https://github.com/tanstack/react-query' },
    },
  ]),
}));

let app: Express;
let testUserId: string;

describe('Intelligent Profile Integration Tests', () => {
  beforeAll(async () => {
    // Setup test app
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
      })
    );

    // Import routes after mocks are set up
    const { registerRoutes } = await import('../server/routes');
    registerRoutes(app);

    testUserId = 'test-user-123';
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Bookmark Flow', () => {
    const testRepo = {
      owner: 'facebook',
      name: 'react',
      url: 'https://github.com/facebook/react',
    };

    it('should complete full bookmark lifecycle: add, view, remove', async () => {
      const { db } = await import('../server/db');
      
      // Step 1: Add bookmark
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 1,
              userId: testUserId,
              repositoryOwner: testRepo.owner,
              repositoryName: testRepo.name,
              repositoryUrl: testRepo.url,
              createdAt: new Date(),
            },
          ]),
        }),
      });

      const addResponse = await request(app)
        .post('/api/profile/bookmarks')
        .send(testRepo)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(addResponse.status).toBe(201);
      expect(addResponse.body).toMatchObject({
        repositoryOwner: testRepo.owner,
        repositoryName: testRepo.name,
      });

      // Step 2: View bookmarks
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockResolvedValueOnce([
              {
                id: 1,
                userId: testUserId,
                repositoryOwner: testRepo.owner,
                repositoryName: testRepo.name,
                repositoryUrl: testRepo.url,
                createdAt: new Date(),
              },
            ]),
          }),
        }),
      });

      const viewResponse = await request(app)
        .get('/api/profile/bookmarks')
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(viewResponse.status).toBe(200);
      expect(viewResponse.body).toHaveLength(1);
      expect(viewResponse.body[0]).toMatchObject({
        repositoryOwner: testRepo.owner,
        repositoryName: testRepo.name,
      });

      // Step 3: Remove bookmark
      (db.delete as any).mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const removeResponse = await request(app)
        .delete(`/api/profile/bookmarks/${testRepo.owner}/${testRepo.name}`)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(removeResponse.status).toBe(204);
    });

    it('should enforce tier limits on bookmarks', async () => {
      const { db } = await import('../server/db');

      // Mock user with free tier
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: testUserId, subscriptionTier: 'free' },
          ]),
        }),
      });

      // Mock existing bookmarks (10 for free tier)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce(
            Array(10).fill({ id: 1, userId: testUserId })
          ),
        }),
      });

      const response = await request(app)
        .post('/api/profile/bookmarks')
        .send(testRepo)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('limit');
    });
  });

  describe('Complete Tag Flow', () => {
    const testTag = {
      name: 'frontend',
      color: '#3b82f6',
    };

    it('should complete full tag lifecycle: create, apply, filter, delete', async () => {
      const { db } = await import('../server/db');

      // Step 1: Create tag
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 1,
              userId: testUserId,
              name: testTag.name,
              color: testTag.color,
              createdAt: new Date(),
            },
          ]),
        }),
      });

      const createResponse = await request(app)
        .post('/api/profile/tags')
        .send(testTag)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toMatchObject(testTag);

      const tagId = createResponse.body.id;

      // Step 2: Apply tag to bookmark
      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              bookmarkId: 1,
              tagId: tagId,
            },
          ]),
        }),
      });

      const applyResponse = await request(app)
        .post('/api/profile/bookmarks/1/tags')
        .send({ tagId })
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(applyResponse.status).toBe(201);

      // Step 3: Filter bookmarks by tag
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValueOnce([
              {
                id: 1,
                userId: testUserId,
                repositoryOwner: 'facebook',
                repositoryName: 'react',
                tags: [{ id: tagId, name: testTag.name, color: testTag.color }],
              },
            ]),
          }),
        }),
      });

      const filterResponse = await request(app)
        .get(`/api/profile/bookmarks?tagId=${tagId}`)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(filterResponse.status).toBe(200);
      expect(filterResponse.body).toHaveLength(1);

      // Step 4: Delete tag
      (db.delete as any).mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const deleteResponse = await request(app)
        .delete(`/api/profile/tags/${tagId}`)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(deleteResponse.status).toBe(204);
    });

    it('should enforce tier limits on tags', async () => {
      const { db } = await import('../server/db');

      // Mock user with free tier
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: testUserId, subscriptionTier: 'free' },
          ]),
        }),
      });

      // Mock existing tags (5 for free tier)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce(
            Array(5).fill({ id: 1, userId: testUserId })
          ),
        }),
      });

      const response = await request(app)
        .post('/api/profile/tags')
        .send(testTag)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('limit');
    });
  });

  describe('Preferences Update Flow', () => {
    it('should update user preferences successfully', async () => {
      const { db } = await import('../server/db');

      const preferences = {
        favoriteLanguages: ['TypeScript', 'Python'],
        favoriteTopics: ['web-development', 'machine-learning'],
        experienceLevel: 'intermediate' as const,
        interests: ['frontend', 'backend', 'devops'],
      };

      (db.update as any).mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              {
                userId: testUserId,
                ...preferences,
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      });

      const response = await request(app)
        .put('/api/profile/preferences')
        .send(preferences)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(preferences);
    });

    it('should validate preferences data', async () => {
      const invalidPreferences = {
        favoriteLanguages: 'not-an-array', // Should be array
        experienceLevel: 'invalid-level', // Invalid enum value
      };

      const response = await request(app)
        .put('/api/profile/preferences')
        .send(invalidPreferences)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should retrieve preferences after update', async () => {
      const { db } = await import('../server/db');

      const preferences = {
        favoriteLanguages: ['JavaScript'],
        favoriteTopics: ['web-development'],
        experienceLevel: 'beginner' as const,
        interests: ['frontend'],
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              userId: testUserId,
              ...preferences,
            },
          ]),
        }),
      });

      const response = await request(app)
        .get('/api/profile/preferences')
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(preferences);
    });
  });

  describe('Recommendation Generation and Dismissal Flow', () => {
    it('should generate recommendations based on user profile', async () => {
      const { db } = await import('../server/db');
      const { generateAIRecommendations } = await import('../server/gemini');

      // Mock user preferences
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              userId: testUserId,
              favoriteLanguages: ['TypeScript'],
              favoriteTopics: ['web-development'],
              experienceLevel: 'intermediate',
            },
          ]),
        }),
      });

      // Mock bookmarks
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([
                {
                  repositoryOwner: 'facebook',
                  repositoryName: 'react',
                },
              ]),
            }),
          }),
        }),
      });

      const response = await request(app)
        .post('/api/profile/recommendations/generate')
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toBeDefined();
      expect(Array.isArray(response.body.recommendations)).toBe(true);
      expect(generateAIRecommendations).toHaveBeenCalled();
    });

    it('should dismiss a recommendation', async () => {
      const { db } = await import('../server/db');

      const recommendationId = 'rec-123';

      (db.insert as any).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              userId: testUserId,
              recommendationId,
              dismissedAt: new Date(),
            },
          ]),
        }),
      });

      const response = await request(app)
        .post(`/api/profile/recommendations/${recommendationId}/dismiss`)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(200);
    });

    it('should not show dismissed recommendations', async () => {
      const { db } = await import('../server/db');

      // Mock dismissed recommendations
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { recommendationId: 'rec-123' },
          ]),
        }),
      });

      // Mock preferences
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              userId: testUserId,
              favoriteLanguages: ['TypeScript'],
            },
          ]),
        }),
      });

      // Mock bookmarks
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([]),
            }),
          }),
        }),
      });

      const response = await request(app)
        .get('/api/profile/recommendations')
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toBeDefined();
      // Dismissed recommendations should be filtered out
      const hasDismissed = response.body.recommendations.some(
        (r: any) => r.id === 'rec-123'
      );
      expect(hasDismissed).toBe(false);
    });

    it('should enforce tier limits on AI recommendations', async () => {
      const { db } = await import('../server/db');

      // Mock user with free tier
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: testUserId, subscriptionTier: 'free' },
          ]),
        }),
      });

      // Mock recent recommendation generation (within cooldown)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([
                {
                  userId: testUserId,
                  generatedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
                },
              ]),
            }),
          }),
        }),
      });

      const response = await request(app)
        .post('/api/profile/recommendations/generate')
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('cooldown');
    });
  });

  describe('Tier Enforcement Across All Features', () => {
    const tiers = [
      {
        name: 'free',
        limits: { bookmarks: 10, tags: 5, recommendationCooldown: 3600000 },
      },
      {
        name: 'pro',
        limits: { bookmarks: 100, tags: 20, recommendationCooldown: 1800000 },
      },
      {
        name: 'premium',
        limits: { bookmarks: -1, tags: -1, recommendationCooldown: 0 },
      },
    ];

    tiers.forEach((tier) => {
      describe(`${tier.name} tier`, () => {
        it('should enforce bookmark limits', async () => {
          const { db } = await import('../server/db');

          // Mock user with specific tier
          (db.select as any).mockReturnValueOnce({
            from: vi.fn().mockReturnValueOnce({
              where: vi.fn().mockResolvedValueOnce([
                { id: testUserId, subscriptionTier: tier.name },
              ]),
            }),
          });

          // Mock existing bookmarks at limit
          const existingCount =
            tier.limits.bookmarks === -1 ? 0 : tier.limits.bookmarks;
          (db.select as any).mockReturnValueOnce({
            from: vi.fn().mockReturnValueOnce({
              where: vi.fn().mockResolvedValueOnce(
                Array(existingCount).fill({ id: 1 })
              ),
            }),
          });

          const response = await request(app)
            .post('/api/profile/bookmarks')
            .send({
              owner: 'test',
              name: 'repo',
              url: 'https://github.com/test/repo',
            })
            .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

          if (tier.limits.bookmarks === -1) {
            // Premium has unlimited
            expect(response.status).not.toBe(403);
          } else {
            expect(response.status).toBe(403);
          }
        });

        it('should enforce tag limits', async () => {
          const { db } = await import('../server/db');

          // Mock user with specific tier
          (db.select as any).mockReturnValueOnce({
            from: vi.fn().mockReturnValueOnce({
              where: vi.fn().mockResolvedValueOnce([
                { id: testUserId, subscriptionTier: tier.name },
              ]),
            }),
          });

          // Mock existing tags at limit
          const existingCount = tier.limits.tags === -1 ? 0 : tier.limits.tags;
          (db.select as any).mockReturnValueOnce({
            from: vi.fn().mockReturnValueOnce({
              where: vi.fn().mockResolvedValueOnce(
                Array(existingCount).fill({ id: 1 })
              ),
            }),
          });

          const response = await request(app)
            .post('/api/profile/tags')
            .send({ name: 'test-tag', color: '#000000' })
            .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

          if (tier.limits.tags === -1) {
            // Premium has unlimited
            expect(response.status).not.toBe(403);
          } else {
            expect(response.status).toBe(403);
          }
        });

        it('should enforce recommendation cooldown', async () => {
          const { db } = await import('../server/db');

          // Mock user with specific tier
          (db.select as any).mockReturnValueOnce({
            from: vi.fn().mockReturnValueOnce({
              where: vi.fn().mockResolvedValueOnce([
                { id: testUserId, subscriptionTier: tier.name },
              ]),
            }),
          });

          // Mock recent generation
          const recentTime =
            Date.now() - (tier.limits.recommendationCooldown - 1000);
          (db.select as any).mockReturnValueOnce({
            from: vi.fn().mockReturnValueOnce({
              where: vi.fn().mockReturnValueOnce({
                orderBy: vi.fn().mockReturnValueOnce({
                  limit: vi.fn().mockResolvedValueOnce([
                    {
                      userId: testUserId,
                      generatedAt: new Date(recentTime),
                    },
                  ]),
                }),
              }),
            }),
          });

          const response = await request(app)
            .post('/api/profile/recommendations/generate')
            .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

          if (tier.limits.recommendationCooldown === 0) {
            // Premium has no cooldown
            expect(response.status).not.toBe(429);
          } else {
            expect(response.status).toBe(429);
          }
        });
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle unauthenticated requests', async () => {
      const response = await request(app).get('/api/profile/bookmarks');

      expect(response.status).toBe(401);
    });

    it('should handle invalid bookmark data', async () => {
      const response = await request(app)
        .post('/api/profile/bookmarks')
        .send({ invalid: 'data' })
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(400);
    });

    it('should handle duplicate bookmarks gracefully', async () => {
      const { db } = await import('../server/db');

      const testRepo = {
        owner: 'facebook',
        name: 'react',
        url: 'https://github.com/facebook/react',
      };

      // Mock existing bookmark
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 1,
              userId: testUserId,
              repositoryOwner: testRepo.owner,
              repositoryName: testRepo.name,
            },
          ]),
        }),
      });

      const response = await request(app)
        .post('/api/profile/bookmarks')
        .send(testRepo)
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should handle database errors gracefully', async () => {
      const { db } = await import('../server/db');

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockRejectedValueOnce(new Error('Database error')),
        }),
      });

      const response = await request(app)
        .get('/api/profile/bookmarks')
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(500);
    });

    it('should handle AI service errors gracefully', async () => {
      const { db } = await import('../server/db');
      const { generateAIRecommendations } = await import('../server/gemini');

      (generateAIRecommendations as any).mockRejectedValueOnce(
        new Error('AI service unavailable')
      );

      // Mock user data
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { userId: testUserId, favoriteLanguages: ['TypeScript'] },
          ]),
        }),
      });

      const response = await request(app)
        .post('/api/profile/recommendations/generate')
        .set('Cookie', [`connect.sid=test-session-${testUserId}`]);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });
});
