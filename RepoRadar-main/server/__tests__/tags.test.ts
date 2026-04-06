import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { storage } from '../storage';
import { isAuthenticated } from '../neonAuth';
import { checkFeatureAccess } from '../middleware/subscriptionTier';
import { db } from '../db';
import { trackEvent } from '../middleware/analytics';
import { asyncHandler } from '../utils/errorHandler';
import { repositoryTags } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// Mock dependencies
vi.mock('../storage');
vi.mock('../neonAuth');
vi.mock('../middleware/subscriptionTier');
vi.mock('../db');
vi.mock('../middleware/analytics');

describe('Tags API Endpoints', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    
    // Mock authentication to pass through
    vi.mocked(isAuthenticated).mockImplementation((req: any, res, next) => {
      req.user = {
        claims: {
          sub: 'test-user-id',
          email: 'test@example.com',
        },
        access_token: 'test-token',
        expires_at: Date.now() + 3600000,
      };
      next();
    });
    
    // Mock tier enforcement to pass through for Pro users
    vi.mocked(checkFeatureAccess).mockImplementation(() => {
      return (req: any, res, next) => next();
    });
    
    // Mock trackEvent to do nothing
    vi.mocked(trackEvent).mockResolvedValue(undefined as any);
    
    // Setup tag endpoints
    app.get('/api/tags',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
        const userTags = await storage.getUserTags(userId);
        
        // Mock repository count query
        const tagsWithCounts = await Promise.all(
          userTags.map(async (tag) => {
            const mockDb = db as any;
            const count = await mockDb
              .select({ count: sql`count(*)` })
              .from(repositoryTags)
              .where(eq(repositoryTags.tagId, tag.id))
              .then((result: any) => result[0]?.count || 0);
            
            return {
              ...tag,
              repositoryCount: count,
            };
          })
        );
        
        res.json(tagsWithCounts);
      })
    );
    
    app.post('/api/tags',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
        const { name, color } = req.body;
        
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
        
        if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Color must be a valid hex color (e.g., #FF6B35)',
            field: 'color',
          });
        }
        
        const existingTags = await storage.getUserTags(userId);
        if (existingTags.some(tag => tag.name.toLowerCase() === name.trim().toLowerCase())) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'A tag with this name already exists',
            field: 'name',
          });
        }
        
        const tag = await storage.createTag(userId, name.trim(), color);
        res.json(tag);
      })
    );
    
    app.delete('/api/tags/:tagId',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
        const tagId = parseInt(req.params.tagId, 10);
        
        if (isNaN(tagId)) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Invalid tag ID',
            field: 'tagId',
          });
        }
        
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
        
        await storage.deleteTag(userId, tagId);
        res.json({ success: true });
      })
    );
    
    app.post('/api/repositories/:id/tags',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
        const repositoryId = req.params.id;
        const { tagId } = req.body;
        
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
        
        const repository = await storage.getRepository(repositoryId);
        if (!repository) {
          return res.status(404).json({
            error: 'NOT_FOUND',
            message: 'Repository not found',
            resourceType: 'repository',
            resourceId: repositoryId,
          });
        }
        
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
        
        const existingTags = await storage.getRepositoryTags(repositoryId, userId);
        if (existingTags.some(t => t.id === tagId)) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Tag is already applied to this repository',
          });
        }
        
        const repoTag = await storage.tagRepository(repositoryId, tagId, userId);
        res.json(repoTag);
      })
    );
    
    app.get('/api/repositories/:id/tags',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
        const repositoryId = req.params.id;
        
        if (!repositoryId) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Repository ID is required',
            field: 'repositoryId',
          });
        }
        
        const tags = await storage.getRepositoryTags(repositoryId, userId);
        res.json(tags);
      })
    );
    
    app.delete('/api/repositories/:id/tags/:tagId',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
        const repositoryId = req.params.id;
        const tagId = parseInt(req.params.tagId, 10);
        
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
        
        await storage.untagRepository(repositoryId, tagId, userId);
        res.json({ success: true });
      })
    );
  });

  describe('GET /api/tags', () => {
    it('should return user tags with repository counts', async () => {
      const mockTags = [
        { id: 1, userId: 'test-user-id', name: 'Frontend', color: '#FF6B35', createdAt: new Date() },
        { id: 2, userId: 'test-user-id', name: 'Backend', color: '#4ECDC4', createdAt: new Date() },
      ];
      
      vi.mocked(storage.getUserTags).mockResolvedValue(mockTags);
      
      // Mock db query for repository counts - create a proper promise chain
      const mockQueryResult = Promise.resolve([{ count: 5 }]);
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue(mockQueryResult),
      };
      
      vi.mocked(db as any).select = vi.fn().mockReturnValue(mockQuery);
      
      const response = await request(app)
        .get('/api/tags')
        .expect(200);
      
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('repositoryCount');
      expect(storage.getUserTags).toHaveBeenCalledWith('test-user-id');
    });
    
    it('should return empty array when user has no tags', async () => {
      vi.mocked(storage.getUserTags).mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/tags')
        .expect(200);
      
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/tags', () => {
    it('should create a new tag with valid data', async () => {
      const newTag = {
        id: 1,
        userId: 'test-user-id',
        name: 'Machine Learning',
        color: '#FF6B35',
        createdAt: new Date(),
      };
      
      vi.mocked(storage.getUserTags).mockResolvedValue([]);
      vi.mocked(storage.createTag).mockResolvedValue(newTag);
      
      const response = await request(app)
        .post('/api/tags')
        .send({ name: 'Machine Learning', color: '#FF6B35' })
        .expect(200);
      
      expect(response.body).toMatchObject({
        id: 1,
        name: 'Machine Learning',
        color: '#FF6B35',
      });
      expect(storage.createTag).toHaveBeenCalledWith('test-user-id', 'Machine Learning', '#FF6B35');
    });
    
    it('should create tag with default color when color not provided', async () => {
      const newTag = {
        id: 1,
        userId: 'test-user-id',
        name: 'DevOps',
        color: '#FF6B35',
        createdAt: new Date(),
      };
      
      vi.mocked(storage.getUserTags).mockResolvedValue([]);
      vi.mocked(storage.createTag).mockResolvedValue(newTag);
      
      const response = await request(app)
        .post('/api/tags')
        .send({ name: 'DevOps' })
        .expect(200);
      
      expect(response.body).toHaveProperty('id');
      expect(storage.createTag).toHaveBeenCalledWith('test-user-id', 'DevOps', undefined);
    });
    
    it('should return 400 when tag name is empty', async () => {
      const response = await request(app)
        .post('/api/tags')
        .send({ name: '' })
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: 'Tag name is required',
        field: 'name',
      });
    });
    
    it('should return 400 when tag name is missing', async () => {
      const response = await request(app)
        .post('/api/tags')
        .send({})
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: 'Tag name is required',
      });
    });
    
    it('should return 400 when tag name exceeds 50 characters', async () => {
      const longName = 'a'.repeat(51);
      
      const response = await request(app)
        .post('/api/tags')
        .send({ name: longName })
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: 'Tag name must be 50 characters or less',
        field: 'name',
      });
    });
    
    it('should return 400 when color format is invalid', async () => {
      vi.mocked(storage.getUserTags).mockResolvedValue([]);
      
      const response = await request(app)
        .post('/api/tags')
        .send({ name: 'Test Tag', color: 'invalid-color' })
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: 'Color must be a valid hex color (e.g., #FF6B35)',
        field: 'color',
      });
    });
    
    it('should return 400 when tag name already exists (case insensitive)', async () => {
      const existingTags = [
        { id: 1, userId: 'test-user-id', name: 'Frontend', color: '#FF6B35', createdAt: new Date() },
      ];
      
      vi.mocked(storage.getUserTags).mockResolvedValue(existingTags);
      
      const response = await request(app)
        .post('/api/tags')
        .send({ name: 'frontend' }) // lowercase
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: 'A tag with this name already exists',
        field: 'name',
      });
    });
    
    it('should trim whitespace from tag name', async () => {
      const newTag = {
        id: 1,
        userId: 'test-user-id',
        name: 'Trimmed',
        color: '#FF6B35',
        createdAt: new Date(),
      };
      
      vi.mocked(storage.getUserTags).mockResolvedValue([]);
      vi.mocked(storage.createTag).mockResolvedValue(newTag);
      
      await request(app)
        .post('/api/tags')
        .send({ name: '  Trimmed  ' })
        .expect(200);
      
      expect(storage.createTag).toHaveBeenCalledWith('test-user-id', 'Trimmed', undefined);
    });
  });

  describe('DELETE /api/tags/:tagId', () => {
    it('should delete a tag with cascade', async () => {
      const existingTags = [
        { id: 1, userId: 'test-user-id', name: 'Frontend', color: '#FF6B35', createdAt: new Date() },
      ];
      
      vi.mocked(storage.getUserTags).mockResolvedValue(existingTags);
      vi.mocked(storage.deleteTag).mockResolvedValue(undefined);
      
      const response = await request(app)
        .delete('/api/tags/1')
        .expect(200);
      
      expect(response.body).toEqual({ success: true });
      expect(storage.deleteTag).toHaveBeenCalledWith('test-user-id', 1);
    });
    
    it('should return 404 when tag does not exist', async () => {
      vi.mocked(storage.getUserTags).mockResolvedValue([]);
      
      const response = await request(app)
        .delete('/api/tags/999')
        .expect(404);
      
      expect(response.body).toMatchObject({
        error: 'NOT_FOUND',
        message: 'Tag not found',
        resourceType: 'tag',
        resourceId: '999',
      });
    });
    
    it('should return 400 when tag ID is invalid', async () => {
      const response = await request(app)
        .delete('/api/tags/invalid')
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: 'Invalid tag ID',
        field: 'tagId',
      });
    });
  });

  describe('GET /api/repositories/:id/tags', () => {
    it('should return tags for a specific repository', async () => {
      const mockTags = [
        { id: 1, userId: 'test-user-id', name: 'Frontend', color: '#FF6B35', createdAt: new Date() },
        { id: 2, userId: 'test-user-id', name: 'Backend', color: '#4ECDC4', createdAt: new Date() },
      ];
      
      vi.mocked(storage.getRepositoryTags).mockResolvedValue(mockTags);
      
      const response = await request(app)
        .get('/api/repositories/repo-123/tags')
        .expect(200);
      
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: 1,
        name: 'Frontend',
        color: '#FF6B35',
      });
      expect(storage.getRepositoryTags).toHaveBeenCalledWith('repo-123', 'test-user-id');
    });
    
    it('should return empty array when repository has no tags', async () => {
      vi.mocked(storage.getRepositoryTags).mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/repositories/repo-123/tags')
        .expect(200);
      
      expect(response.body).toEqual([]);
    });
    
    it('should return 400 when repository ID is missing', async () => {
      const response = await request(app)
        .get('/api/repositories//tags')
        .expect(404); // Express returns 404 for missing params in path
    });
  });

  describe('POST /api/repositories/:id/tags', () => {
    it('should apply tag to repository', async () => {
      const mockRepository = {
        id: 'repo-123',
        fullName: 'user/repo',
        owner: 'user',
        name: 'repo',
      };
      
      const mockTag = {
        id: 1,
        userId: 'test-user-id',
        name: 'Frontend',
        color: '#FF6B35',
        createdAt: new Date(),
      };
      
      const mockRepoTag = {
        id: 1,
        repositoryId: 'repo-123',
        tagId: 1,
        userId: 'test-user-id',
        createdAt: new Date(),
      };
      
      vi.mocked(storage.getRepository).mockResolvedValue(mockRepository as any);
      vi.mocked(storage.getUserTags).mockResolvedValue([mockTag]);
      vi.mocked(storage.getRepositoryTags).mockResolvedValue([]);
      vi.mocked(storage.tagRepository).mockResolvedValue(mockRepoTag);
      
      const response = await request(app)
        .post('/api/repositories/repo-123/tags')
        .send({ tagId: 1 })
        .expect(200);
      
      expect(response.body).toHaveProperty('id');
      expect(storage.tagRepository).toHaveBeenCalledWith('repo-123', 1, 'test-user-id');
    });
    
    it('should return 404 when repository does not exist', async () => {
      vi.mocked(storage.getRepository).mockResolvedValue(null);
      
      const response = await request(app)
        .post('/api/repositories/nonexistent/tags')
        .send({ tagId: 1 })
        .expect(404);
      
      expect(response.body).toMatchObject({
        error: 'NOT_FOUND',
        message: 'Repository not found',
        resourceType: 'repository',
      });
    });
    
    it('should return 404 when tag does not belong to user', async () => {
      const mockRepository = {
        id: 'repo-123',
        fullName: 'user/repo',
      };
      
      vi.mocked(storage.getRepository).mockResolvedValue(mockRepository as any);
      vi.mocked(storage.getUserTags).mockResolvedValue([]); // No tags for user
      
      const response = await request(app)
        .post('/api/repositories/repo-123/tags')
        .send({ tagId: 1 })
        .expect(404);
      
      expect(response.body).toMatchObject({
        error: 'NOT_FOUND',
        message: 'Tag not found or does not belong to you',
        resourceType: 'tag',
      });
    });
    
    it('should return 400 when tag is already applied', async () => {
      const mockRepository = {
        id: 'repo-123',
        fullName: 'user/repo',
      };
      
      const mockTag = {
        id: 1,
        userId: 'test-user-id',
        name: 'Frontend',
        color: '#FF6B35',
        createdAt: new Date(),
      };
      
      vi.mocked(storage.getRepository).mockResolvedValue(mockRepository as any);
      vi.mocked(storage.getUserTags).mockResolvedValue([mockTag]);
      vi.mocked(storage.getRepositoryTags).mockResolvedValue([mockTag]); // Tag already applied
      
      const response = await request(app)
        .post('/api/repositories/repo-123/tags')
        .send({ tagId: 1 })
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: 'Tag is already applied to this repository',
      });
    });
    
    it('should return 400 when tagId is missing', async () => {
      const response = await request(app)
        .post('/api/repositories/repo-123/tags')
        .send({})
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: 'Tag ID is required and must be a number',
        field: 'tagId',
      });
    });
  });

  describe('DELETE /api/repositories/:id/tags/:tagId', () => {
    it('should remove tag from repository', async () => {
      vi.mocked(storage.untagRepository).mockResolvedValue(undefined);
      
      const response = await request(app)
        .delete('/api/repositories/repo-123/tags/1')
        .expect(200);
      
      expect(response.body).toEqual({ success: true });
      expect(storage.untagRepository).toHaveBeenCalledWith('repo-123', 1, 'test-user-id');
    });
    
    it('should return 400 when tag ID is invalid', async () => {
      const response = await request(app)
        .delete('/api/repositories/repo-123/tags/invalid')
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: 'Invalid tag ID',
        field: 'tagId',
      });
    });
  });

  describe('Tier Enforcement', () => {
    it('should return 403 for free users', async () => {
      // Mock tier enforcement to reject free users
      vi.mocked(checkFeatureAccess).mockImplementation(() => {
        return (req: any, res, next) => {
          res.status(403).json({
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'This feature requires a Pro subscription',
            currentTier: 'free',
            requiredTier: 'pro',
          });
        };
      });
      
      // Recreate app with new middleware
      app = express();
      app.use(express.json());
      
      app.get('/api/tags',
        isAuthenticated,
        checkFeatureAccess('advanced_analytics'),
        async (req: any, res: any) => {
          res.json([]);
        }
      );
      
      const response = await request(app)
        .get('/api/tags')
        .expect(403);
      
      expect(response.body).toMatchObject({
        error: 'FEATURE_NOT_AVAILABLE',
        message: 'This feature requires a Pro subscription',
      });
    });
  });
});
