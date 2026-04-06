import { ICacheManager } from './interfaces';
import { createCacheManager } from './CacheManager';
import type {
  IGitHubOptimizer,
  GitHubRequestConfig,
  GitHubBatchRequest,
  GitHubRateLimit,
  GitHubOptimizationStats,
} from './interfaces';

/**
 * GitHub API optimizer with request batching, caching, and rate limit management
 */
export class GitHubOptimizer implements IGitHubOptimizer {
  private cache: ICacheManager;
  private config = {
    token: process.env.GITHUB_TOKEN || '',
    baseUrl: 'https://api.github.com',
    batchSize: 10,
    batchDelay: 100, // ms
    rateLimitBuffer: 100, // Keep 100 requests as buffer
    defaultCacheTtl: 300000, // 5 minutes
  };

  private batchQueue: GitHubBatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private rateLimitInfo: GitHubRateLimit | null = null;
  private lastRateLimitCheck = 0;
  private requestQueue: GitHubBatchRequest[] = [];
  private isProcessingQueue = false;

  private stats: GitHubOptimizationStats = {
    totalRequests: 0,
    batchedRequests: 0,
    cachedRequests: 0,
    rateLimitHits: 0,
    averageResponseTime: 0,
    bytesSaved: 0,
    requestsSaved: 0,
  };

  private responseTimes: number[] = [];

  constructor(cacheManager?: ICacheManager) {
    this.cache = cacheManager || createCacheManager({
      key: 'github-api',
      ttl: this.config.defaultCacheTtl,
      maxSize: 50 * 1024 * 1024, // 50MB
    });
  }

  configure(options: {
    token?: string;
    baseUrl?: string;
    batchSize?: number;
    batchDelay?: number;
    rateLimitBuffer?: number;
    defaultCacheTtl?: number;
  }): void {
    this.config = { ...this.config, ...options };
  }

  async request<T = any>(config: GitHubRequestConfig): Promise<T> {
    this.stats.totalRequests++;

    // Check cache first for GET requests
    if (config.method === 'GET' && this.shouldCache(config)) {
      const cacheKey = this.getCacheKey(config);
      const cached = await this.cache.get<T>(cacheKey);
      
      if (cached) {
        this.stats.cachedRequests++;
        this.stats.requestsSaved++;
        return cached;
      }
    }

    // Check rate limits
    await this.checkRateLimit();

    return new Promise<T>((resolve, reject) => {
      const batchRequest: GitHubBatchRequest = {
        id: this.generateRequestId(),
        config,
        resolve,
        reject,
        timestamp: new Date(),
      };

      // Add to batch queue
      this.batchQueue.push(batchRequest);
      this.scheduleBatchProcessing();
    });
  }

  async batchRequest<T = any>(configs: GitHubRequestConfig[]): Promise<T[]> {
    const promises = configs.map(config => this.request<T>(config));
    return Promise.all(promises);
  }

  async getRateLimit(): Promise<GitHubRateLimit> {
    if (this.rateLimitInfo && Date.now() - this.lastRateLimitCheck < 60000) {
      return this.rateLimitInfo;
    }

    try {
      const response = await this.makeHttpRequest({
        url: '/rate_limit',
        method: 'GET',
      });

      this.rateLimitInfo = response.rate || response;
      this.lastRateLimitCheck = Date.now();
      return this.rateLimitInfo;
    } catch (error) {
      // Fallback to conservative estimates if rate limit check fails
      const fallback = {
        limit: 5000,
        remaining: 1000,
        reset: Math.floor(Date.now() / 1000) + 3600,
        used: 4000,
        resource: 'core',
      };
      this.rateLimitInfo = fallback;
      return fallback;
    }
  }

  shouldCache(config: GitHubRequestConfig): boolean {
    // Only cache GET requests
    if (config.method !== 'GET') {
      return false;
    }

    // Don't cache if explicitly disabled
    if (config.cacheable === false) {
      return false;
    }

    // Cache repository data, search results, etc.
    const cacheableEndpoints = [
      '/repos/',
      '/search/',
      '/users/',
      '/orgs/',
    ];

    return cacheableEndpoints.some(endpoint => config.url.includes(endpoint));
  }

  getStats(): GitHubOptimizationStats {
    return {
      ...this.stats,
      averageResponseTime: this.calculateAverageResponseTime(),
    };
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      batchedRequests: 0,
      cachedRequests: 0,
      rateLimitHits: 0,
      averageResponseTime: 0,
      bytesSaved: 0,
      requestsSaved: 0,
    };
    this.responseTimes = [];
  }

  private scheduleBatchProcessing(): void {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.processBatch();
      this.batchTimer = null;
    }, this.config.batchDelay);
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const batch = this.batchQueue.splice(0, this.config.batchSize);
    this.stats.batchedRequests += batch.length;

    // Group requests by priority
    const highPriority = batch.filter(req => req.config.priority === 'high');
    const normalPriority = batch.filter(req => req.config.priority === 'normal' || !req.config.priority);
    const lowPriority = batch.filter(req => req.config.priority === 'low');

    // Process in priority order
    const orderedBatch = [...highPriority, ...normalPriority, ...lowPriority];

    for (const request of orderedBatch) {
      this.requestQueue.push(request);
    }

    if (!this.isProcessingQueue) {
      this.processRequestQueue();
    }
  }

  private async processRequestQueue(): Promise<void> {
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      
      try {
        await this.checkRateLimit();
        const result = await this.executeRequest(request);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  private async executeRequest(request: GitHubBatchRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      const result = await this.makeHttpRequest(request.config);
      const responseTime = Date.now() - startTime;
      
      this.responseTimes.push(responseTime);
      if (this.responseTimes.length > 1000) {
        this.responseTimes = this.responseTimes.slice(-1000);
      }

      // Cache the result if applicable
      if (this.shouldCache(request.config)) {
        const cacheKey = this.getCacheKey(request.config);
        const cacheTtl = request.config.cacheTtl || this.config.defaultCacheTtl;
        await this.cache.set(cacheKey, result, cacheTtl);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  private async makeHttpRequest(config: GitHubRequestConfig): Promise<any> {
    const url = config.url.startsWith('http') 
      ? config.url 
      : `${this.config.baseUrl}${config.url}`;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'RepoRadar/1.0',
      ...config.headers,
    };

    if (this.config.token) {
      headers['Authorization'] = `token ${this.config.token}`;
    }

    const fetchOptions: RequestInit = {
      method: config.method,
      headers,
    };

    if (config.data && config.method !== 'GET') {
      fetchOptions.body = JSON.stringify(config.data);
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, fetchOptions);

    // Update rate limit info from response headers
    this.updateRateLimitFromHeaders(response.headers);

    if (!response.ok) {
      if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
        this.stats.rateLimitHits++;
        throw new Error(`GitHub API rate limit exceeded. Reset at: ${new Date(parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000)}`);
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    } else {
      return response.text();
    }
  }

  private async checkRateLimit(): Promise<void> {
    try {
      const rateLimit = await this.getRateLimit();
      
      if (rateLimit && rateLimit.remaining <= this.config.rateLimitBuffer) {
        const resetTime = rateLimit.reset * 1000;
        const waitTime = resetTime - Date.now();
        
        if (waitTime > 0) {
          this.stats.rateLimitHits++;
          // Implement exponential backoff
          const backoffTime = Math.min(waitTime, 60000); // Max 1 minute wait
          await this.sleep(backoffTime);
        }
      }
    } catch (error) {
      // If rate limit check fails, continue with request
      console.warn('Rate limit check failed:', error);
    }
  }

  private updateRateLimitFromHeaders(headers: Headers): void {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const used = headers.get('x-ratelimit-used');
    const resource = headers.get('x-ratelimit-resource');

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: parseInt(reset),
        used: parseInt(used || '0'),
        resource: resource || 'core',
      };
      this.lastRateLimitCheck = Date.now();
    }
  }

  private getCacheKey(config: GitHubRequestConfig): string {
    if (config.cacheKey) {
      return config.cacheKey;
    }

    const url = config.url.replace(this.config.baseUrl, '');
    const params = new URLSearchParams();
    
    // Add relevant parameters to cache key
    if (config.data && config.method === 'GET') {
      Object.entries(config.data).forEach(([key, value]) => {
        params.append(key, String(value));
      });
    }

    const paramString = params.toString();
    return `github:${config.method}:${url}${paramString ? `?${paramString}` : ''}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.responseTimes.length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create GitHub optimizer
 */
export function createGitHubOptimizer(cacheManager?: ICacheManager): IGitHubOptimizer {
  return new GitHubOptimizer(cacheManager);
}

/**
 * Enhanced GitHub service that uses the optimizer
 */
export class OptimizedGitHubService {
  private optimizer: IGitHubOptimizer;

  constructor(optimizer?: IGitHubOptimizer) {
    this.optimizer = optimizer || createGitHubOptimizer();
  }

  async searchRepositories(
    query: string,
    sort: 'stars' | 'forks' | 'updated' = 'stars',
    limit = 10
  ): Promise<any[]> {
    const result = await this.optimizer.request({
      url: `/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&per_page=${limit}`,
      method: 'GET',
      cacheable: true,
      cacheTtl: 600000, // 10 minutes for search results
    });

    return result.items || [];
  }

  async getRepository(owner: string, repo: string): Promise<any | null> {
    try {
      return await this.optimizer.request({
        url: `/repos/${owner}/${repo}`,
        method: 'GET',
        cacheable: true,
        cacheTtl: 300000, // 5 minutes for repository data
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async getRepositoryLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    try {
      return await this.optimizer.request({
        url: `/repos/${owner}/${repo}/languages`,
        method: 'GET',
        cacheable: true,
        cacheTtl: 3600000, // 1 hour for language data (changes less frequently)
      });
    } catch (error) {
      return {};
    }
  }

  async getRepositoryReadme(owner: string, repo: string): Promise<string | null> {
    try {
      return await this.optimizer.request({
        url: `/repos/${owner}/${repo}/readme`,
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3.raw'
        },
        cacheable: true,
        cacheTtl: 1800000, // 30 minutes for README
      });
    } catch (error) {
      return null;
    }
  }

  async getRepositoryWithDetails(owner: string, repo: string): Promise<{
    repository: any;
    languages: Record<string, number>;
    readme?: string;
  } | null> {
    try {
      // Use batch request for better performance
      const [repository, languages, readme] = await this.optimizer.batchRequest([
        {
          url: `/repos/${owner}/${repo}`,
          method: 'GET',
          cacheable: true,
          priority: 'high',
        },
        {
          url: `/repos/${owner}/${repo}/languages`,
          method: 'GET',
          cacheable: true,
          priority: 'normal',
        },
        {
          url: `/repos/${owner}/${repo}/readme`,
          method: 'GET',
          headers: { 'Accept': 'application/vnd.github.v3.raw' },
          cacheable: true,
          priority: 'low',
        },
      ]);

      if (!repository) {
        return null;
      }

      return {
        repository,
        languages: languages || {},
        readme: readme || undefined,
      };
    } catch (error) {
      console.error('Error fetching repository with details:', error);
      return null;
    }
  }

  getOptimizationStats(): GitHubOptimizationStats {
    return this.optimizer.getStats();
  }

  async clearCache(): Promise<void> {
    await this.optimizer.clearCache();
  }
}