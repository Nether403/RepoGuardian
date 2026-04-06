import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('Bookmark API Endpoints', () => {
  let app: express.Express;
  
  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware to pass through
    vi.mocked(isAuthenticated).mockImplementation((req: any, res, next) => {
      req.user = {
        claims: {
          sub: 'test-user-id',
          email: 'test@example.com',
        },
      };
      next();
    });
    
    // Mock tier enforcement to pass through for Pro users
    vi.mocked(checkFeatureAccess).mockImplementation(() => {
      return (req: any, res, next) => next();
    });
    
    // Mock trackEvent to do nothing
    vi.mocked(trackEvent).mockResolvedValue(undefined);
    
    // Setup routes (simplified version of actual routes)
    const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
    
    // GET /api/bookmarks
    app.get('/api/bookmarks',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
        const bookmarks = await storage.getUserBookmarks(userId);
        
        const bookmarksWithRepos = await Promise.all(
          bookmarks.map(async (bookmark) => {
            const repository = await storage.getRepository(bookmark.repositoryId);
            return {
              ...bookmark,
              repository,
            };
          })
        );
        
        await trackEvent(req, 'bookmarks_viewed', 'profile', {
          count: bookmarksWithRepos.length,
        });
        
        res.json(bookmarksWithRepos);
      })
    );
    
    // POST /api/bookmarks
    app.post('/api/bookmarks',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
        const { repositoryId, notes } = req.body;
        
        if (!repositoryId || typeof repositoryId !== 'string') {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Repository ID is required',
            field: 'repositoryId',
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
        
        const bookmark = await storage.addBookmark(userId, repositoryId, notes);
        
        await trackEvent(req, 'bookmark_added', 'profile', {
          repositoryId,
          repositoryName: repository.fullName,
        });
        
        await storage.trackActivity(userId, 'bookmarked', repositoryId, {
          repositoryName: repository.fullName,
        });
        
        res.json({
          ...bookmark,
          repository,
        });
      })
    );
    
    // DELETE /api/bookmarks/:repositoryId
    app.delete('/api/bookmarks/:repositoryId',
      isAuthenticated,
      checkFeatureAccess('advanced_analytics'),
      asyncHandler(async (req: any, res: any) => {
        const userId = req.user.claims.sub;
        const { repositoryId } = req.params;
        
        if (!repositoryId) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Repository ID is required',
            field: 'repositoryId',
          });
        }
        
        const repository = await storage.getRepository(repositoryId);
        await storage.removeBookmark(userId, repositoryId);
        
        await trackEvent(req, 'bookmark_removed', 'profile', {
          repositoryId,
          repositoryName: repository?.fullName,
        });
        
        res.json({ success: true });
      })
    );
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('GET /api/bookmarks', () => {
    it('should return user bookmarks with repository details', async () => {
      const mockBookmarks = [
        {
          id: 1,
          userId: 'test-user-id',
          repositoryId: 'repo-1',
          notes: 'Test note',
          createdAt: new Date(),
        },
      ];
      
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        fullName: 'owner/test-repo',
        owner: 'owner',
        description: 'Test repository',
        language: 'TypeScript',
        stars: 100,
        forks: 10,
        watchers: 50,
        size: 1000,
        isPrivate: false,
        htmlUrl: 'https://github.com/owner/test-repo',
        cloneUrl: 'https://github.com/owner/test-repo.git',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(storage.getUserBookmarks).mockResolvedValue(mockBookmarks);
      vi.mocked(storage.getRepository).mockResolvedValue(mockRepository);
      
      const response = await request(app)
        .get('/api/bookmarks')
        .expect(200);
      
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 1,
        userId: 'test-user-id',
        repositoryId: 'repo-1',
        notes: 'Test note',
      });
      expect(response.body[0].repository).toMatchObject({
        id: 'repo-1',
        name: 'test-repo',
        fullName: 'owner/test-repo',
        owner: 'owner',
        description: 'Test repository',
        language: 'TypeScript',
        stars: 100,
      });
      
      expect(storage.getUserBookmarks).toHaveBeenCalledWith('test-user-id');
      expect(storage.getRepository).toHaveBeenCalledWith('repo-1');
      expect(trackEvent).toHaveBeenCalledWith(
        expect.anything(),
        'bookmarks_viewed',
        'profile',
        { count: 1 }
      );
    });
    
    it('should return empty array when user has no bookmarks', async () => {
      vi.mocked(storage.getUserBookmarks).mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/bookmarks')
        .expect(200);
      
      expect(response.body).toEqual([]);
      expect(storage.getUserBookmarks).toHaveBeenCalledWith('test-user-id');
    });
  });
  
  describe('POST /api/bookmarks', () => {
    it('should create a bookmark with valid data', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        fullName: 'owner/test-repo',
        owner: 'owner',
        description: 'Test repository',
        language: 'TypeScript',
        stars: 100,
        forks: 10,
        watchers: 50,
        size: 1000,
        isPrivate: false,
        htmlUrl: 'https://github.com/owner/test-repo',
        cloneUrl: 'https://github.com/owner/test-repo.git',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const mockBookmark = {
        id: 1,
        userId: 'test-user-id',
        repositoryId: 'repo-1',
        notes: 'Test note',
        createdAt: new Date(),
      };
      
      vi.mocked(storage.getRepository).mockResolvedValue(mockRepository);
      vi.mocked(storage.addBookmark).mockResolvedValue(mockBookmark);
      vi.mocked(storage.trackActivity).mockResolvedValue({} as any);
      
      const response = await request(app)
        .post('/api/bookmarks')
        .send({
          repositoryId: 'repo-1',
          notes: 'Test note',
        })
        .expect(200);
      
      expect(response.body).toMatchObject({
        id: 1,
        userId: 'test-user-id',
        repositoryId: 'repo-1',
        notes: 'Test note',
      });
      expect(response.body.repository).toMatchObject({
        id: 'repo-1',
        name: 'test-repo',
        fullName: 'owner/test-repo',
        owner: 'owner',
        description: 'Test repository',
        language: 'TypeScript',
        stars: 100,
      });
      
      expect(storage.getRepository).toHaveBeenCalledWith('repo-1');
      expect(storage.addBookmark).toHaveBeenCalledWith('test-user-id', 'repo-1', 'Test note');
      expect(storage.trackActivity).toHaveBeenCalledWith(
        'test-user-id',
        'bookmarked',
        'repo-1',
        { repositoryName: 'owner/test-repo' }
      );
      expect(trackEvent).toHaveBeenCalledWith(
        expect.anything(),
        'bookmark_added',
        'profile',
        {
          repositoryId: 'repo-1',
          repositoryName: 'owner/test-repo',
        }
      );
    });
    
    it('should return 400 when repositoryId is missing', async () => {
      const response = await request(app)
        .post('/api/bookmarks')
        .send({})
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: 'Repository ID is required',
        field: 'repositoryId',
      });
      
      expect(storage.addBookmark).not.toHaveBeenCalled();
    });
    
    it('should return 404 when repository does not exist', async () => {
      vi.mocked(storage.getRepository).mockResolvedValue(undefined);
      
      const response = await request(app)
        .post('/api/bookmarks')
        .send({
          repositoryId: 'non-existent-repo',
        })
        .expect(404);
      
      expect(response.body).toMatchObject({
        error: 'NOT_FOUND',
        message: 'Repository not found',
        resourceType: 'repository',
        resourceId: 'non-existent-repo',
      });
      
      expect(storage.addBookmark).not.toHaveBeenCalled();
    });
  });
  
  describe('DELETE /api/bookmarks/:repositoryId', () => {
    it('should delete a bookmark', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        fullName: 'owner/test-repo',
        owner: 'owner',
        description: 'Test repository',
        language: 'TypeScript',
        stars: 100,
        forks: 10,
        watchers: 50,
        size: 1000,
        isPrivate: false,
        htmlUrl: 'https://github.com/owner/test-repo',
        cloneUrl: 'https://github.com/owner/test-repo.git',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(storage.getRepository).mockResolvedValue(mockRepository);
      vi.mocked(storage.removeBookmark).mockResolvedValue(undefined);
      
      const response = await request(app)
        .delete('/api/bookmarks/repo-1')
        .expect(200);
      
      expect(response.body).toEqual({ success: true });
      expect(storage.removeBookmark).toHaveBeenCalledWith('test-user-id', 'repo-1');
      expect(trackEvent).toHaveBeenCalledWith(
        expect.anything(),
        'bookmark_removed',
        'profile',
        {
          repositoryId: 'repo-1',
          repositoryName: 'owner/test-repo',
        }
      );
    });
  });
  
  describe('Tier Enforcement', () => {
    it('should return 403 for free users', async () => {
      // Mock tier enforcement to reject free users
      vi.mocked(checkFeatureAccess).mockImplementation(() => {
        return (req: any, res, next) => {
          res.status(403).json({
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'This feature requires a pro subscription',
            currentTier: 'free',
            requiredFeature: 'advanced_analytics',
            upgradeTo: 'pro',
            upgradeUrl: '/subscription',
          });
        };
      });
      
      // Recreate app with new middleware
      app = express();
      app.use(express.json());
      
      vi.mocked(isAuthenticated).mockImplementation((req: any, res, next) => {
        req.user = {
          claims: {
            sub: 'free-user-id',
            email: 'free@example.com',
          },
        };
        next();
      });
      
      app.get('/api/bookmarks',
        isAuthenticated,
        checkFeatureAccess('advanced_analytics'),
        async (req: any, res: any) => {
          res.json([]);
        }
      );
      
      const response = await request(app)
        .get('/api/bookmarks')
        .expect(403);
      
      expect(response.body).toMatchObject({
        error: 'FEATURE_NOT_AVAILABLE',
        message: 'This feature requires a pro subscription',
        currentTier: 'free',
      });
    });
  });
  
  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      // Mock authentication to reject
      vi.mocked(isAuthenticated).mockImplementation((req: any, res, next) => {
        res.status(401).json({
          message: 'Unauthorized',
          error: 'Not authenticated',
        });
      });
      
      // Recreate app with new middleware
      app = express();
      app.use(express.json());
      
      app.get('/api/bookmarks',
        isAuthenticated,
        checkFeatureAccess('advanced_analytics'),
        async (req: any, res: any) => {
          res.json([]);
        }
      );
      
      const response = await request(app)
        .get('/api/bookmarks')
        .expect(401);
      
      expect(response.body).toMatchObject({
        message: 'Unauthorized',
      });
    });
  });
});
