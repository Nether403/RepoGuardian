/**
 * Performance monitoring interfaces for RepoRadar
 * Supports database, API, and frontend performance metrics collection
 */

export interface PerformanceMetrics {
  timestamp: Date;
  category: 'database' | 'api' | 'frontend';
  metric: string;
  value: number;
  threshold?: number;
  metadata?: Record<string, any>;
}

export interface DatabaseMetrics extends PerformanceMetrics {
  category: 'database';
  queryId?: string;
  executionTime: number;
  connectionPoolSize: number;
  activeConnections: number;
}

export interface APIMetrics extends PerformanceMetrics {
  category: 'api';
  endpoint: string;
  responseTime: number;
  cacheHit: boolean;
  compressionRatio?: number;
}

export interface FrontendMetrics extends PerformanceMetrics {
  category: 'frontend';
  bundleName: string;
  loadTime: number;
  bundleSize: number;
  cacheStatus: 'hit' | 'miss' | 'stale';
}

export interface IMetricsCollector {
  /**
   * Collect a performance metric
   */
  collect(metric: PerformanceMetrics): Promise<void>;
  
  /**
   * Collect multiple metrics at once
   */
  collectBatch(metrics: PerformanceMetrics[]): Promise<void>;
  
  /**
   * Get metrics by category and time range
   */
  getMetrics(
    category?: PerformanceMetrics['category'],
    startTime?: Date,
    endTime?: Date
  ): Promise<PerformanceMetrics[]>;
  
  /**
   * Get aggregated metrics (avg, min, max, count)
   */
  getAggregatedMetrics(
    category: PerformanceMetrics['category'],
    metric: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<{
    avg: number;
    min: number;
    max: number;
    count: number;
  }>;
  
  /**
   * Clear old metrics based on retention policy
   */
  cleanup(olderThan: Date): Promise<number>;
}

export interface IMetricsStorage {
  /**
   * Store a single metric
   */
  store(metric: PerformanceMetrics): Promise<void>;
  
  /**
   * Store multiple metrics
   */
  storeBatch(metrics: PerformanceMetrics[]): Promise<void>;
  
  /**
   * Retrieve metrics with filtering
   */
  retrieve(filter: MetricsFilter): Promise<PerformanceMetrics[]>;
  
  /**
   * Delete metrics older than specified date
   */
  deleteOlderThan(date: Date): Promise<number>;
  
  /**
   * Get storage statistics
   */
  getStats(): Promise<{
    totalMetrics: number;
    oldestMetric: Date | null;
    newestMetric: Date | null;
    categoryCounts: Record<string, number>;
  }>;
}

export interface MetricsFilter {
  category?: PerformanceMetrics['category'];
  metric?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface IPerformanceMonitor {
  /**
   * Start monitoring performance
   */
  start(): Promise<void>;
  
  /**
   * Stop monitoring performance
   */
  stop(): Promise<void>;
  
  /**
   * Check if monitoring is active
   */
  isActive(): boolean;
  
  /**
   * Get current performance snapshot
   */
  getSnapshot(): Promise<{
    database: Partial<DatabaseMetrics>;
    api: Partial<APIMetrics>;
    frontend: Partial<FrontendMetrics>;
  }>;
  
  /**
   * Register a custom metric collector
   */
  registerCollector(name: string, collector: IMetricsCollector): void;
  
  /**
   * Unregister a metric collector
   */
  unregisterCollector(name: string): void;
  
  /**
   * Get the default metrics collector
   */
  getDefaultCollector(): IMetricsCollector;
  
  /**
   * Get names of all registered collectors
   */
  getCollectorNames(): string[];
}

// Database Performance Interfaces

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  healthCheckIntervalMs: number;
  maxRetries: number;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalCreated: number;
  totalDestroyed: number;
  totalAcquired: number;
  totalReleased: number;
}

export interface IConnectionPool {
  /**
   * Initialize the connection pool
   */
  initialize(): Promise<void>;
  
  /**
   * Acquire a connection from the pool
   */
  acquire(): Promise<any>;
  
  /**
   * Release a connection back to the pool
   */
  release(connection: any): Promise<void>;
  
  /**
   * Destroy a connection (remove from pool)
   */
  destroy(connection: any): Promise<void>;
  
  /**
   * Get current pool statistics
   */
  getStats(): ConnectionPoolStats;
  
  /**
   * Check pool health
   */
  healthCheck(): Promise<boolean>;
  
  /**
   * Drain the pool (close all connections)
   */
  drain(): Promise<void>;
  
  /**
   * Clear the pool (destroy all connections)
   */
  clear(): Promise<void>;
}

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  type: 'btree' | 'hash' | 'gin' | 'gist';
  condition?: string;
}

export interface QueryAnalysis {
  queryId: string;
  query: string;
  executionTime: number;
  planningTime: number;
  indexesUsed: string[];
  suggestedIndexes: IndexInfo[];
  cost: number;
}

export interface IIndexManager {
  /**
   * Ensure required indexes exist
   */
  ensureIndexes(): Promise<void>;
  
  /**
   * Create a specific index
   */
  createIndex(indexInfo: IndexInfo): Promise<void>;
  
  /**
   * Drop an index
   */
  dropIndex(indexName: string): Promise<void>;
  
  /**
   * Analyze query performance and suggest indexes
   */
  analyzeQuery(query: string): Promise<QueryAnalysis>;
  
  /**
   * Get all existing indexes
   */
  getExistingIndexes(): Promise<IndexInfo[]>;
  
  /**
   * Optimize existing indexes based on usage patterns
   */
  optimizeIndexes(): Promise<void>;
}

export interface QueryMetrics {
  queryId: string;
  query: string;
  executionTime: number;
  timestamp: Date;
  success: boolean;
  error?: string;
  connectionId?: string;
}

export interface IQueryMonitor {
  /**
   * Start monitoring a query
   */
  startQuery(queryId: string, query: string, connectionId?: string): void;
  
  /**
   * End monitoring a query
   */
  endQuery(queryId: string, success: boolean, error?: string): void;
  
  /**
   * Get query metrics
   */
  getMetrics(startTime?: Date, endTime?: Date): Promise<QueryMetrics[]>;
  
  /**
   * Get slow queries (above threshold)
   */
  getSlowQueries(thresholdMs?: number): Promise<QueryMetrics[]>;
  
  /**
   * Clear old query metrics
   */
  cleanup(olderThan: Date): Promise<number>;
  
  /**
   * Set slow query threshold
   */
  setSlowQueryThreshold(thresholdMs: number): void;
}

// Cache Management Interfaces

export interface CacheConfig {
  key: string;
  ttl: number;
  invalidationStrategy: 'time' | 'event' | 'manual';
  compressionEnabled: boolean;
  maxSize?: number;
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: Date;
  ttl: number;
  hits: number;
  size: number;
  compressed?: boolean;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

export interface ICacheManager {
  /**
   * Store data in cache with TTL
   */
  set(key: string, data: any, ttl?: number): Promise<void>;
  
  /**
   * Retrieve data from cache
   */
  get<T = any>(key: string): Promise<T | null>;
  
  /**
   * Check if key exists in cache
   */
  has(key: string): Promise<boolean>;
  
  /**
   * Delete specific key from cache
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;
  
  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;
  
  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): Promise<number>;
  
  /**
   * Set cache configuration
   */
  configure(config: Partial<CacheConfig>): void;
  
  /**
   * Cleanup expired entries
   */
  cleanup(): Promise<number>;
  
  /**
   * Get cache entry metadata
   */
  getMetadata(key: string): Promise<Omit<CacheEntry, 'data'> | null>;
}

// Compression Middleware Interfaces

export interface CompressionConfig {
  threshold: number; // Minimum response size to compress (bytes)
  algorithms: ('gzip' | 'brotli' | 'deflate')[];
  level: number; // Compression level (1-9 for gzip, 1-11 for brotli)
  chunkSize: number; // Chunk size for streaming compression
  memLevel: number; // Memory level for gzip (1-9)
}

export interface CompressionStats {
  totalRequests: number;
  compressedRequests: number;
  compressionRatio: number; // Average compression ratio
  algorithmUsage: Record<string, number>;
  bytesSaved: number;
  processingTime: number; // Average compression time in ms
}

export interface ICompressionMiddleware {
  /**
   * Compress response data
   */
  compress(data: Buffer | string, acceptedEncodings: string[]): Promise<{
    data: Buffer;
    encoding: string;
    originalSize: number;
    compressedSize: number;
    compressionTime: number;
  }>;
  
  /**
   * Check if response should be compressed
   */
  shouldCompress(size: number, contentType?: string): boolean;
  
  /**
   * Get best compression algorithm for client
   */
  getBestAlgorithm(acceptedEncodings: string[]): string | null;
  
  /**
   * Get compression statistics
   */
  getStats(): CompressionStats;
  
  /**
   * Configure compression settings
   */
  configure(config: Partial<CompressionConfig>): void;
  
  /**
   * Reset compression statistics
   */
  resetStats(): void;
}

// Pagination Interfaces

export interface IPaginationMiddleware {
  /**
   * Apply pagination to a dataset
   */
  paginate<T>(data: T[], total: number, page: number, limit: number): {
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
      nextPage: number | null;
      prevPage: number | null;
    };
  };
  
  /**
   * Extract pagination parameters from request
   */
  extractPaginationParams(query: any): {
    page: number;
    limit: number;
    offset: number;
  };
  
  /**
   * Validate pagination parameters
   */
  validatePaginationParams(params: any): boolean;
  
  /**
   * Get pagination configuration
   */
  getConfig(): {
    defaultLimit: number;
    maxLimit: number;
    minLimit: number;
  };
}

// GitHub API Optimization Interfaces

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
  resource: string;
}

export interface GitHubRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  priority?: 'low' | 'normal' | 'high';
  cacheable?: boolean;
  cacheKey?: string;
  cacheTtl?: number;
}

export interface GitHubBatchRequest {
  id: string;
  config: GitHubRequestConfig;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: Date;
}

export interface GitHubOptimizationStats {
  totalRequests: number;
  batchedRequests: number;
  cachedRequests: number;
  rateLimitHits: number;
  averageResponseTime: number;
  bytesSaved: number;
  requestsSaved: number;
}

export interface IGitHubOptimizer {
  /**
   * Make an optimized GitHub API request
   */
  request<T = any>(config: GitHubRequestConfig): Promise<T>;
  
  /**
   * Batch multiple requests together
   */
  batchRequest<T = any>(configs: GitHubRequestConfig[]): Promise<T[]>;
  
  /**
   * Get current rate limit status
   */
  getRateLimit(): Promise<GitHubRateLimit>;
  
  /**
   * Check if request should be cached
   */
  shouldCache(config: GitHubRequestConfig): boolean;
  
  /**
   * Get optimization statistics
   */
  getStats(): GitHubOptimizationStats;
  
  /**
   * Configure GitHub API settings
   */
  configure(options: {
    token?: string;
    baseUrl?: string;
    batchSize?: number;
    batchDelay?: number;
    rateLimitBuffer?: number;
    defaultCacheTtl?: number;
  }): void;
  
  /**
   * Clear request cache
   */
  clearCache(): Promise<void>;
  
  /**
   * Reset optimization statistics
   */
  resetStats(): void;
}