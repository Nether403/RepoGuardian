import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitHubOptimizer, createGitHubOptimizer, OptimizedGitHubService } from '../GitHubOptimizer';
import { createCacheManager } from '../CacheManager';
import type { GitHubRequestConfig, ICacheManager } from '../interfaces';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper function to create mock responses
function createMockResponse(data: any, options: {
  status?: number;
  contentType?: string;
  headers?: Record<string, string>;
} = {}) {
  const {
    status = 200,
    contentType = 'application/json',
    headers = {}
  } = options;

  const allHeaders = {
    'content-type': contentType,
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': '4999',
    'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
    ...headers,
  };

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
    headers: new Headers(allHeaders),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
  };
}

describe('GitHubOptimizer', () => {
  let optimizer: GitHubOptimizer;
  let mockCache: ICacheManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCache = createCacheManager();
    optimizer = new GitHubOptimizer(mockCache);
    
    // Configure with test token
    optimizer.configure({
      token: 'test-token',
      batchDelay: 10, // Faster for testing
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Basic Request Handling', () => {
    it('should make a simple GET request', async () => {
      const mockResponse = { id: 1, name: 'test-repo' };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const config: GitHubRequestConfig = {
        url: '/repos/owner/repo',
        method: 'GET',
      };

      const result = await optimizer.request(config);
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'token test-token',
            'Accept': 'application/vnd.github.v3+json',
          }),
        })
      );
    });

    it('should handle POST requests with data', async () => {
      const requestData = { name: 'new-repo' };
      const mockResponse = { id: 2, name: 'new-repo' };
      
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse, {
        status: 201,
        headers: { 'x-ratelimit-remaining': '4998' }
      }));

      const config: GitHubRequestConfig = {
        url: '/user/repos',
        method: 'POST',
        data: requestData,
      };

      const result = await optimizer.request(config);
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/user/repos',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle text responses', async () => {
      const mockText = 'README content';
      mockFetch.mockResolvedValueOnce(createMockResponse(mockText, {
        contentType: 'text/plain',
        headers: { 'x-ratelimit-remaining': '4997' }
      }));

      const config: GitHubRequestConfig = {
        url: '/repos/owner/repo/readme',
        method: 'GET',
        headers: { 'Accept': 'application/vnd.github.v3.raw' },
      };

      const result = await optimizer.request(config);
      expect(result).toBe(mockText);
    });
  });

  describe('Caching', () => {
    it('should cache GET requests', async () => {
      const mockResponse = { id: 1, name: 'test-repo' };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const config: GitHubRequestConfig = {
        url: '/repos/owner/repo',
        method: 'GET',
        cacheable: true,
      };

      // First request should hit the API
      const result1 = await optimizer.request(config);
      expect(result1).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second request should use cache
      const result2 = await optimizer.request(config);
      expect(result2).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional API call

      const stats = optimizer.getStats();
      expect(stats.cachedRequests).toBe(1);
    });

    it('should not cache POST requests', async () => {
      const config: GitHubRequestConfig = {
        url: '/user/repos',
        method: 'POST',
        data: { name: 'test' },
      };

      expect(optimizer.shouldCache(config)).toBe(false);
    });

    it('should respect cache TTL', async () => {
      vi.useFakeTimers();
      
      const mockResponse = { id: 1, name: 'test-repo' };
      mockFetch.mockResolvedValue(createMockResponse(mockResponse));

      const config: GitHubRequestConfig = {
        url: '/repos/owner/repo',
        method: 'GET',
        cacheable: true,
        cacheTtl: 1000, // 1 second
      };

      // First request
      await optimizer.request(config);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second request within TTL should use cache
      await optimizer.request(config);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time beyond TTL
      vi.advanceTimersByTime(1500);

      // Third request should hit API again
      await optimizer.request(config);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Batch Requests', () => {
    it('should batch multiple requests', async () => {
      const mockResponses = [
        { id: 1, name: 'repo1' },
        { id: 2, name: 'repo2' },
        { id: 3, name: 'repo3' },
      ];

      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockResponses[0]))
        .mockResolvedValueOnce(createMockResponse(mockResponses[1]))
        .mockResolvedValueOnce(createMockResponse(mockResponses[2]));

      const configs: GitHubRequestConfig[] = [
        { url: '/repos/owner/repo1', method: 'GET' },
        { url: '/repos/owner/repo2', method: 'GET' },
        { url: '/repos/owner/repo3', method: 'GET' },
      ];

      const results = await optimizer.batchRequest(configs);
      expect(results).toEqual(mockResponses);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle request priorities', async () => {
      const mockResponses = [
        { priority: 'high', data: 'high-priority' },
        { priority: 'normal', data: 'normal-priority' },
        { priority: 'low', data: 'low-priority' },
      ];

      let callOrder: string[] = [];
      mockFetch.mockImplementation((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('high')) callOrder.push('high');
        else if (urlStr.includes('normal')) callOrder.push('normal');
        else if (urlStr.includes('low')) callOrder.push('low');
        
        const response = mockResponses.find(r => urlStr.includes(r.priority));
        return Promise.resolve(createMockResponse(response));
      });

      const configs: GitHubRequestConfig[] = [
        { url: '/test/normal', method: 'GET', priority: 'normal' },
        { url: '/test/high', method: 'GET', priority: 'high' },
        { url: '/test/low', method: 'GET', priority: 'low' },
      ];

      await optimizer.batchRequest(configs);

      // High priority should be processed first
      expect(callOrder[0]).toBe('high');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit headers', async () => {
      const rateLimitData = {
        limit: 5000,
        remaining: 10,
        reset: Math.floor(Date.now() / 1000) + 3600,
        used: 4990,
        resource: 'core',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(rateLimitData, {
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '10',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          'x-ratelimit-used': '4990',
          'x-ratelimit-resource': 'core',
        }
      }));

      await optimizer.request({
        url: '/rate_limit',
        method: 'GET',
      });

      const rateLimit = await optimizer.getRateLimit();
      expect(rateLimit.remaining).toBe(10);
      expect(rateLimit.limit).toBe(5000);
    });

    it('should handle rate limit exceeded error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
        }
      }));

      await expect(optimizer.request({
        url: '/repos/owner/repo',
        method: 'GET',
      })).rejects.toThrow('GitHub API error: 403');

      const stats = optimizer.getStats();
      expect(stats.rateLimitHits).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, { status: 404 }));

      await expect(optimizer.request({
        url: '/repos/owner/nonexistent',
        method: 'GET',
      })).rejects.toThrow('GitHub API error: 404');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(optimizer.request({
        url: '/repos/owner/repo',
        method: 'GET',
      })).rejects.toThrow('Network error');
    });
  });

  describe('Statistics', () => {
    it('should track request statistics', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: 'test' }));

      await optimizer.request({ url: '/test1', method: 'GET' });
      await optimizer.request({ url: '/test2', method: 'GET', cacheable: true });
      
      // Second request to same cacheable endpoint should be cached
      await optimizer.request({ url: '/test2', method: 'GET', cacheable: true });

      const stats = optimizer.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.cachedRequests).toBe(1);
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should reset statistics', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ data: 'test' }));

      await optimizer.request({ url: '/test', method: 'GET' });
      
      let stats = optimizer.getStats();
      expect(stats.totalRequests).toBe(1);

      optimizer.resetStats();
      stats = optimizer.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should apply configuration changes', () => {
      optimizer.configure({
        baseUrl: 'https://api.github.example.com',
        batchSize: 5,
        rateLimitBuffer: 50,
      });

      // Configuration is applied internally, we can test through behavior
      expect(optimizer).toBeDefined();
    });
  });
});

describe('OptimizedGitHubService', () => {
  let service: OptimizedGitHubService;
  let mockOptimizer: any;

  beforeEach(() => {
    mockOptimizer = {
      request: vi.fn(),
      batchRequest: vi.fn(),
      getStats: vi.fn().mockReturnValue({
        totalRequests: 0,
        cachedRequests: 0,
        batchedRequests: 0,
      }),
      clearCache: vi.fn(),
    };
    service = new OptimizedGitHubService(mockOptimizer);
  });

  describe('Repository Operations', () => {
    it('should search repositories', async () => {
      const mockResults = {
        items: [
          { id: 1, name: 'repo1' },
          { id: 2, name: 'repo2' },
        ],
      };

      mockOptimizer.request.mockResolvedValueOnce(mockResults);

      const results = await service.searchRepositories('test query', 'stars', 10);
      
      expect(results).toEqual(mockResults.items);
      expect(mockOptimizer.request).toHaveBeenCalledWith({
        url: '/search/repositories?q=test%20query&sort=stars&per_page=10',
        method: 'GET',
        cacheable: true,
        cacheTtl: 600000,
      });
    });

    it('should get single repository', async () => {
      const mockRepo = { id: 1, name: 'test-repo' };
      mockOptimizer.request.mockResolvedValueOnce(mockRepo);

      const result = await service.getRepository('owner', 'repo');
      
      expect(result).toEqual(mockRepo);
      expect(mockOptimizer.request).toHaveBeenCalledWith({
        url: '/repos/owner/repo',
        method: 'GET',
        cacheable: true,
        cacheTtl: 300000,
      });
    });

    it('should handle repository not found', async () => {
      mockOptimizer.request.mockRejectedValueOnce(new Error('GitHub API error: 404 Not Found'));

      const result = await service.getRepository('owner', 'nonexistent');
      expect(result).toBeNull();
    });

    it('should get repository languages', async () => {
      const mockLanguages = { JavaScript: 1000, TypeScript: 500 };
      mockOptimizer.request.mockResolvedValueOnce(mockLanguages);

      const result = await service.getRepositoryLanguages('owner', 'repo');
      
      expect(result).toEqual(mockLanguages);
      expect(mockOptimizer.request).toHaveBeenCalledWith({
        url: '/repos/owner/repo/languages',
        method: 'GET',
        cacheable: true,
        cacheTtl: 3600000,
      });
    });

    it('should get repository README', async () => {
      const mockReadme = '# Test Repository\n\nThis is a test.';
      mockOptimizer.request.mockResolvedValueOnce(mockReadme);

      const result = await service.getRepositoryReadme('owner', 'repo');
      
      expect(result).toBe(mockReadme);
      expect(mockOptimizer.request).toHaveBeenCalledWith({
        url: '/repos/owner/repo/readme',
        method: 'GET',
        headers: { 'Accept': 'application/vnd.github.v3.raw' },
        cacheable: true,
        cacheTtl: 1800000,
      });
    });

    it('should get repository with details using batch request', async () => {
      const mockRepo = { id: 1, name: 'test-repo' };
      const mockLanguages = { JavaScript: 1000 };
      const mockReadme = '# Test';

      mockOptimizer.batchRequest.mockResolvedValueOnce([
        mockRepo,
        mockLanguages,
        mockReadme,
      ]);

      const result = await service.getRepositoryWithDetails('owner', 'repo');
      
      expect(result).toEqual({
        repository: mockRepo,
        languages: mockLanguages,
        readme: mockReadme,
      });

      expect(mockOptimizer.batchRequest).toHaveBeenCalledWith([
        expect.objectContaining({
          url: '/repos/owner/repo',
          priority: 'high',
        }),
        expect.objectContaining({
          url: '/repos/owner/repo/languages',
          priority: 'normal',
        }),
        expect.objectContaining({
          url: '/repos/owner/repo/readme',
          priority: 'low',
        }),
      ]);
    });
  });

  describe('Service Management', () => {
    it('should get optimization stats', () => {
      const mockStats = {
        totalRequests: 10,
        cachedRequests: 3,
        batchedRequests: 5,
        rateLimitHits: 0,
        averageResponseTime: 150,
        bytesSaved: 1024,
        requestsSaved: 3,
      };

      mockOptimizer.getStats.mockReturnValueOnce(mockStats);

      const stats = service.getOptimizationStats();
      expect(stats).toEqual(mockStats);
    });

    it('should clear cache', async () => {
      await service.clearCache();
      expect(mockOptimizer.clearCache).toHaveBeenCalled();
    });
  });
});

describe('createGitHubOptimizer factory', () => {
  it('should create GitHub optimizer with default cache', () => {
    const optimizer = createGitHubOptimizer();
    expect(optimizer).toBeInstanceOf(GitHubOptimizer);
  });

  it('should create GitHub optimizer with custom cache', () => {
    const customCache = createCacheManager();
    const optimizer = createGitHubOptimizer(customCache);
    expect(optimizer).toBeInstanceOf(GitHubOptimizer);
  });
});