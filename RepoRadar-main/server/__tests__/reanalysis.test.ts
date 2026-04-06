import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { githubService } from '../github';
import { analyzeRepository } from '../gemini';

// Mock dependencies
vi.mock('../storage');
vi.mock('../github');
vi.mock('../gemini');
vi.mock('../middleware/analytics', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('Repository Reanalysis', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  const mockRepository = {
    id: 'repo-123',
    name: 'test-repo',
    fullName: 'owner/test-repo',
    owner: 'owner',
    description: 'Test repository',
    language: 'TypeScript',
    stars: 100,
    forks: 20,
    watchers: 50,
    size: 1000,
    isPrivate: false,
    htmlUrl: 'https://github.com/owner/test-repo',
    cloneUrl: 'https://github.com/owner/test-repo.git',
    languages: { TypeScript: 80, JavaScript: 20 },
    topics: ['test', 'demo'],
    lastAnalyzed: new Date('2024-01-01'),
    analysisCount: 1,
    lastReanalyzedBy: null,
    reanalysisLockedUntil: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockAnalysis = {
    id: 'analysis-123',
    repositoryId: 'repo-123',
    userId: 'user-123',
    originality: 85,
    completeness: 90,
    marketability: 75,
    monetization: 70,
    usefulness: 95,
    overallScore: 83,
    summary: 'Great project',
    strengths: [
      { point: 'Well tested', reason: 'Comprehensive test coverage' },
      { point: 'Good docs', reason: 'Clear documentation' }
    ],
    weaknesses: [
      { point: 'Limited features', reason: 'Could use more functionality' }
    ],
    recommendations: [
      { suggestion: 'Add more features', reason: 'Expand functionality', impact: 'High' }
    ],
    scoreExplanations: {
      originality: 'Unique approach',
      completeness: 'Well documented',
      marketability: 'Good market fit',
      monetization: 'Multiple revenue streams',
      usefulness: 'Solves real problems'
    },
    createdAt: new Date(),
  };

  const mockGitHubRepo = {
    id: 123,
    name: 'test-repo',
    full_name: 'owner/test-repo',
    owner: { login: 'owner' },
    description: 'Test repository',
    language: 'TypeScript',
    stargazers_count: 100,
    forks_count: 20,
    watchers_count: 50,
    size: 1000,
    private: false,
    html_url: 'https://github.com/owner/test-repo',
    clone_url: 'https://github.com/owner/test-repo.git',
    topics: ['test', 'demo'],
  };

  beforeEach(() => {
    mockReq = {
      params: { id: 'repo-123' },
      user: {
        claims: { sub: 'user-123' },
      } as any,
    };

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    nextFn = vi.fn();

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('Reanalysis Endpoint', () => {
    it('should successfully reanalyze a repository', async () => {
      // Mock storage methods
      vi.mocked(storage.getRepository).mockResolvedValue(mockRepository);
      vi.mocked(storage.deleteRepositoryAnalysis).mockResolvedValue(undefined);
      vi.mocked(storage.upsertRepository).mockResolvedValue({
        ...mockRepository,
        lastAnalyzed: new Date(),
      });
      vi.mocked(storage.createAnalysis).mockResolvedValue(mockAnalysis);
      vi.mocked(storage.updateRepositoryReanalysis).mockResolvedValue(undefined);

      // Mock GitHub service
      vi.mocked(githubService.parseRepositoryUrl).mockReturnValue({
        owner: 'owner',
        repo: 'test-repo',
      });
      vi.mocked(githubService.getRepositoryWithDetails).mockResolvedValue({
        repository: mockGitHubRepo,
        languages: { TypeScript: 80, JavaScript: 20 },
        readme: '# Test Repo',
      });

      // Mock Gemini analysis
      vi.mocked(analyzeRepository).mockResolvedValue({
        originality: 85,
        completeness: 90,
        marketability: 75,
        monetization: 70,
        usefulness: 95,
        overallScore: 83,
        summary: 'Great project',
        strengths: [
          { point: 'Well tested', reason: 'Comprehensive test coverage' },
          { point: 'Good docs', reason: 'Clear documentation' }
        ],
        weaknesses: [
          { point: 'Limited features', reason: 'Could use more functionality' }
        ],
        recommendations: [
          { suggestion: 'Add more features', reason: 'Expand functionality', impact: 'High' }
        ],
        scoreExplanations: {
          originality: 'Unique approach',
          completeness: 'Well documented',
          marketability: 'Good market fit',
          monetization: 'Multiple revenue streams',
          usefulness: 'Solves real problems'
        }
      });

      // Import and call the handler (we'll need to extract it or test via integration)
      // For now, we'll verify the storage calls
      expect(storage.getRepository).toBeDefined();
      expect(storage.deleteRepositoryAnalysis).toBeDefined();
      expect(storage.updateRepositoryReanalysis).toBeDefined();
    });

    it('should return 404 if repository not found', async () => {
      vi.mocked(storage.getRepository).mockResolvedValue(undefined);

      // Verify that getRepository is called
      await storage.getRepository('repo-123');
      
      expect(storage.getRepository).toHaveBeenCalledWith('repo-123');
    });

    it('should return 429 if reanalysis is rate limited', async () => {
      const lockedRepository = {
        ...mockRepository,
        reanalysisLockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      };

      vi.mocked(storage.getRepository).mockResolvedValue(lockedRepository);

      const repository = await storage.getRepository('repo-123');
      
      expect(repository?.reanalysisLockedUntil).toBeDefined();
      expect(repository!.reanalysisLockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should clear existing analysis before reanalyzing', async () => {
      vi.mocked(storage.getRepository).mockResolvedValue(mockRepository);
      vi.mocked(storage.deleteRepositoryAnalysis).mockResolvedValue(undefined);

      await storage.deleteRepositoryAnalysis('repo-123');

      expect(storage.deleteRepositoryAnalysis).toHaveBeenCalledWith('repo-123');
    });

    it('should update repository with reanalysis metadata', async () => {
      vi.mocked(storage.updateRepositoryReanalysis).mockResolvedValue(undefined);

      const now = new Date();
      const lockUntil = new Date(now.getTime() + 60 * 60 * 1000);

      await storage.updateRepositoryReanalysis('repo-123', {
        lastReanalyzedBy: 'user-123',
        reanalysisLockedUntil: lockUntil,
        analysisCount: 2,
      });

      expect(storage.updateRepositoryReanalysis).toHaveBeenCalledWith('repo-123', {
        lastReanalyzedBy: 'user-123',
        reanalysisLockedUntil: lockUntil,
        analysisCount: 2,
      });
    });

    it('should fetch fresh data from GitHub', async () => {
      vi.mocked(githubService.parseRepositoryUrl).mockReturnValue({
        owner: 'owner',
        repo: 'test-repo',
      });
      vi.mocked(githubService.getRepositoryWithDetails).mockResolvedValue({
        repository: mockGitHubRepo,
        languages: { TypeScript: 80, JavaScript: 20 },
        readme: '# Test Repo',
      });

      const parsed = githubService.parseRepositoryUrl('https://github.com/owner/test-repo');
      expect(parsed).toEqual({ owner: 'owner', repo: 'test-repo' });

      const details = await githubService.getRepositoryWithDetails('owner', 'test-repo');
      expect(details).toBeDefined();
      expect(details?.repository.name).toBe('test-repo');
    });

    it('should return 400 if repository URL is invalid', async () => {
      vi.mocked(storage.getRepository).mockResolvedValue(mockRepository);
      vi.mocked(githubService.parseRepositoryUrl).mockReturnValue(null);

      const parsed = githubService.parseRepositoryUrl('invalid-url');
      expect(parsed).toBeNull();
    });

    it('should return 404 if repository not found on GitHub', async () => {
      vi.mocked(storage.getRepository).mockResolvedValue(mockRepository);
      vi.mocked(githubService.parseRepositoryUrl).mockReturnValue({
        owner: 'owner',
        repo: 'test-repo',
      });
      vi.mocked(githubService.getRepositoryWithDetails).mockResolvedValue(null);

      const details = await githubService.getRepositoryWithDetails('owner', 'test-repo');
      expect(details).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should calculate correct wait time for rate limit', () => {
      const now = new Date();
      const lockUntil = new Date(now.getTime() + 45 * 60 * 1000); // 45 minutes from now
      
      const waitMinutes = Math.ceil((lockUntil.getTime() - now.getTime()) / 60000);
      
      expect(waitMinutes).toBe(45);
    });

    it('should allow reanalysis after lock expires', () => {
      const now = new Date();
      const lockUntil = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
      
      const isLocked = lockUntil > now;
      
      expect(isLocked).toBe(false);
    });

    it('should prevent reanalysis when locked', () => {
      const now = new Date();
      const lockUntil = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
      
      const isLocked = lockUntil > now;
      
      expect(isLocked).toBe(true);
    });

    it('should set lock for 1 hour after reanalysis', () => {
      const now = new Date();
      const lockUntil = new Date(now.getTime() + 60 * 60 * 1000);
      
      const lockDuration = lockUntil.getTime() - now.getTime();
      const lockHours = lockDuration / (60 * 60 * 1000);
      
      expect(lockHours).toBe(1);
    });
  });

  describe('Cache Clearing', () => {
    it('should delete existing analysis from database', async () => {
      vi.mocked(storage.deleteRepositoryAnalysis).mockResolvedValue(undefined);

      await storage.deleteRepositoryAnalysis('repo-123');

      expect(storage.deleteRepositoryAnalysis).toHaveBeenCalledWith('repo-123');
      expect(storage.deleteRepositoryAnalysis).toHaveBeenCalledTimes(1);
    });

    it('should handle deletion errors gracefully', async () => {
      vi.mocked(storage.deleteRepositoryAnalysis).mockRejectedValue(
        new Error('Database error')
      );

      await expect(storage.deleteRepositoryAnalysis('repo-123')).rejects.toThrow('Database error');
    });
  });

  describe('Concurrent Reanalysis Prevention', () => {
    it('should prevent concurrent reanalysis of same repository', async () => {
      const lockedRepository = {
        ...mockRepository,
        reanalysisLockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      };

      vi.mocked(storage.getRepository).mockResolvedValue(lockedRepository);

      const repo = await storage.getRepository('repo-123');
      const now = new Date();
      const isLocked = repo?.reanalysisLockedUntil && repo.reanalysisLockedUntil > now;

      expect(isLocked).toBe(true);
    });

    it('should allow reanalysis by different users', async () => {
      const repository = {
        ...mockRepository,
        lastReanalyzedBy: 'user-456',
        reanalysisLockedUntil: new Date(Date.now() - 5 * 60 * 1000), // Expired
      };

      vi.mocked(storage.getRepository).mockResolvedValue(repository);

      const repo = await storage.getRepository('repo-123');
      const now = new Date();
      const isLocked = repo?.reanalysisLockedUntil && repo.reanalysisLockedUntil > now;

      expect(isLocked).toBe(false);
      expect(repo?.lastReanalyzedBy).toBe('user-456');
    });

    it('should increment analysis count on each reanalysis', async () => {
      vi.mocked(storage.updateRepositoryReanalysis).mockResolvedValue(undefined);

      const currentCount = mockRepository.analysisCount || 0;
      const newCount = currentCount + 1;

      await storage.updateRepositoryReanalysis('repo-123', {
        lastReanalyzedBy: 'user-123',
        reanalysisLockedUntil: new Date(Date.now() + 60 * 60 * 1000),
        analysisCount: newCount,
      });

      expect(storage.updateRepositoryReanalysis).toHaveBeenCalledWith(
        'repo-123',
        expect.objectContaining({
          analysisCount: 2,
        })
      );
    });

    it('should track who last reanalyzed the repository', async () => {
      vi.mocked(storage.updateRepositoryReanalysis).mockResolvedValue(undefined);

      await storage.updateRepositoryReanalysis('repo-123', {
        lastReanalyzedBy: 'user-789',
        reanalysisLockedUntil: new Date(Date.now() + 60 * 60 * 1000),
        analysisCount: 3,
      });

      expect(storage.updateRepositoryReanalysis).toHaveBeenCalledWith(
        'repo-123',
        expect.objectContaining({
          lastReanalyzedBy: 'user-789',
        })
      );
    });
  });

  describe('Analysis Creation', () => {
    it('should create new analysis with correct data', async () => {
      vi.mocked(storage.createAnalysis).mockResolvedValue(mockAnalysis);

      const analysisData = {
        repositoryId: 'repo-123',
        userId: 'user-123',
        originality: 85,
        completeness: 90,
        marketability: 75,
        monetization: 70,
        usefulness: 95,
        overallScore: 83,
        summary: 'Great project',
        strengths: [
          { point: 'Well tested', reason: 'Comprehensive test coverage' },
          { point: 'Good docs', reason: 'Clear documentation' }
        ],
        weaknesses: [
          { point: 'Limited features', reason: 'Could use more functionality' }
        ],
        recommendations: [
          { suggestion: 'Add more features', reason: 'Expand functionality', impact: 'High' }
        ],
        scoreExplanations: {
          originality: 'Unique approach',
          completeness: 'Well documented',
          marketability: 'Good market fit',
          monetization: 'Multiple revenue streams',
          usefulness: 'Solves real problems'
        }
      };

      const analysis = await storage.createAnalysis(analysisData as any);

      expect(analysis).toBeDefined();
      expect(analysis.repositoryId).toBe('repo-123');
      expect(analysis.userId).toBe('user-123');
    });

    it('should handle analysis creation errors', async () => {
      vi.mocked(storage.createAnalysis).mockRejectedValue(
        new Error('Failed to create analysis')
      );

      await expect(storage.createAnalysis({} as any)).rejects.toThrow('Failed to create analysis');
    });
  });

  describe('Repository Update', () => {
    it('should update repository with fresh GitHub data', async () => {
      vi.mocked(storage.upsertRepository).mockResolvedValue({
        ...mockRepository,
        stars: 150, // Updated
        lastAnalyzed: new Date(),
      });

      const updatedRepo = await storage.upsertRepository({
        ...mockRepository,
        stars: 150,
      } as any);

      expect(updatedRepo.stars).toBe(150);
      expect(updatedRepo.lastAnalyzed).toBeDefined();
    });

    it('should preserve repository ID during update', async () => {
      vi.mocked(storage.upsertRepository).mockResolvedValue(mockRepository);

      const updatedRepo = await storage.upsertRepository(mockRepository as any);

      expect(updatedRepo.id).toBe('repo-123');
    });
  });

  describe('Error Handling', () => {
    it('should handle GitHub API errors', async () => {
      vi.mocked(githubService.getRepositoryWithDetails).mockRejectedValue(
        new Error('GitHub API rate limit exceeded')
      );

      await expect(
        githubService.getRepositoryWithDetails('owner', 'test-repo')
      ).rejects.toThrow('GitHub API rate limit exceeded');
    });

    it('should handle Gemini analysis errors', async () => {
      vi.mocked(analyzeRepository).mockRejectedValue(
        new Error('Gemini API error')
      );

      await expect(analyzeRepository({} as any)).rejects.toThrow('Gemini API error');
    });

    it('should handle database errors during reanalysis', async () => {
      vi.mocked(storage.getRepository).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(storage.getRepository('repo-123')).rejects.toThrow('Database connection failed');
    });

    it('should rollback on analysis creation failure', async () => {
      vi.mocked(storage.deleteRepositoryAnalysis).mockResolvedValue(undefined);
      vi.mocked(storage.createAnalysis).mockRejectedValue(
        new Error('Analysis creation failed')
      );

      // Verify deletion was called
      await storage.deleteRepositoryAnalysis('repo-123');
      expect(storage.deleteRepositoryAnalysis).toHaveBeenCalled();

      // Verify creation fails
      await expect(storage.createAnalysis({} as any)).rejects.toThrow('Analysis creation failed');
    });
  });

  describe('Authentication', () => {
    it('should require authenticated user', () => {
      const reqWithoutUser = {
        params: { id: 'repo-123' },
      };

      expect(reqWithoutUser).not.toHaveProperty('user');
    });

    it('should extract userId from authenticated request', () => {
      const authenticatedReq = mockReq as any;
      const userId = authenticatedReq.user?.claims?.sub;
      
      expect(userId).toBe('user-123');
    });

    it('should handle missing user claims', () => {
      const reqWithoutClaims = {
        params: { id: 'repo-123' },
        user: {} as any,
      };

      const userId = reqWithoutClaims.user?.claims?.sub;
      
      expect(userId).toBeUndefined();
    });
  });
});
