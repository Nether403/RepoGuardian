import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { IndexManager } from '../IndexManager';
import { Pool, PoolClient } from '@neondatabase/serverless';
import { IndexInfo } from '../interfaces';

// Mock the @neondatabase/serverless module
vi.mock('@neondatabase/serverless', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  const mockPool = {
    connect: vi.fn(),
  };

  return {
    Pool: vi.fn(() => mockPool),
    PoolClient: vi.fn(() => mockClient),
  };
});

describe('IndexManager', () => {
  let indexManager: IndexManager;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    (Pool as Mock).mockImplementation(() => mockPool);

    indexManager = new IndexManager(mockPool);
  });

  describe('ensureIndexes', () => {
    it('should create missing critical indexes', async () => {
      // Mock existing indexes query to return empty result
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // getExistingIndexes call
        .mockResolvedValue({ rows: [] }); // createIndex calls

      await indexManager.ensureIndexes();

      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should skip existing indexes', async () => {
      // Mock existing indexes query to return all critical indexes
      const allCriticalIndexNames = [
        'idx_users_email', 'idx_users_subscription_status', 'idx_users_api_key',
        'idx_repositories_full_name', 'idx_repositories_owner', 'idx_repositories_language',
        'idx_repositories_stars', 'idx_repositories_last_analyzed',
        'idx_repository_analyses_repository_id', 'idx_repository_analyses_user_id',
        'idx_repository_analyses_overall_score', 'idx_repository_analyses_created_at',
        'idx_saved_repositories_user_id', 'idx_saved_repositories_repository_id',
        'idx_saved_repositories_user_repo', 'idx_similar_repositories_repository_id',
        'idx_similar_repositories_similarity', 'idx_user_activities_user_created',
        'idx_notifications_user_read', 'idx_api_usage_timestamp', 'idx_api_usage_key_timestamp'
      ];
      
      const existingIndexes = allCriticalIndexNames.map(name => ({
        index_name: name,
        table_name: 'test_table',
        columns: ['test_column'],
        is_unique: false,
        index_type: 'btree',
        condition: null
      }));
      
      mockClient.query.mockResolvedValueOnce({ rows: existingIndexes });

      await indexManager.ensureIndexes();

      expect(mockClient.query).toHaveBeenCalledTimes(1); // Only the getExistingIndexes call
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('createIndex', () => {
    it('should create a basic index successfully', async () => {
      const indexInfo: IndexInfo = {
        name: 'test_index',
        table: 'test_table',
        columns: ['test_column'],
        unique: false,
        type: 'btree'
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await indexManager.createIndex(indexInfo);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/CREATE\s+INDEX CONCURRENTLY IF NOT EXISTS test_index/)
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should create a unique index successfully', async () => {
      const indexInfo: IndexInfo = {
        name: 'test_unique_index',
        table: 'test_table',
        columns: ['test_column'],
        unique: true,
        type: 'btree'
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await indexManager.createIndex(indexInfo);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS test_unique_index/)
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should create an index with condition', async () => {
      const indexInfo: IndexInfo = {
        name: 'test_conditional_index',
        table: 'test_table',
        columns: ['test_column'],
        unique: false,
        type: 'btree',
        condition: 'test_column IS NOT NULL'
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await indexManager.createIndex(indexInfo);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE test_column IS NOT NULL/)
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle index creation errors', async () => {
      const indexInfo: IndexInfo = {
        name: 'test_index',
        table: 'test_table',
        columns: ['test_column'],
        unique: false,
        type: 'btree'
      };

      mockClient.query.mockRejectedValueOnce(new Error('Index creation failed'));

      await expect(indexManager.createIndex(indexInfo)).rejects.toThrow('Index creation failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('dropIndex', () => {
    it('should drop an index successfully', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await indexManager.dropIndex('test_index');

      expect(mockClient.query).toHaveBeenCalledWith(
        'DROP INDEX CONCURRENTLY IF EXISTS test_index'
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle index drop errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Index drop failed'));

      await expect(indexManager.dropIndex('test_index')).rejects.toThrow('Index drop failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('analyzeQuery', () => {
    it('should analyze a query and return metrics', async () => {
      const testQuery = 'SELECT * FROM users WHERE email = $1';
      const mockExplainResult = {
        rows: [{
          'QUERY PLAN': [{
            'Execution Time': 15.5,
            'Planning Time': 2.3,
            'Plan': {
              'Total Cost': 100.5,
              'Node Type': 'Index Scan',
              'Index Name': 'idx_users_email'
            }
          }]
        }]
      };

      mockClient.query.mockResolvedValueOnce(mockExplainResult);

      const result = await indexManager.analyzeQuery(testQuery);

      expect(result).toEqual({
        queryId: expect.any(String),
        query: testQuery,
        executionTime: 15.5,
        planningTime: 2.3,
        indexesUsed: ['idx_users_email'],
        suggestedIndexes: [],
        cost: 100.5
      });
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle query analysis errors', async () => {
      const testQuery = 'INVALID SQL';
      mockClient.query.mockRejectedValueOnce(new Error('Query analysis failed'));

      await expect(indexManager.analyzeQuery(testQuery)).rejects.toThrow('Query analysis failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getExistingIndexes', () => {
    it('should return existing indexes', async () => {
      const mockIndexes = [
        {
          index_name: 'idx_users_email',
          table_name: 'users',
          columns: ['email'],
          is_unique: true,
          index_type: 'btree',
          condition: null
        },
        {
          index_name: 'idx_repositories_stars',
          table_name: 'repositories',
          columns: ['stars'],
          is_unique: false,
          index_type: 'btree',
          condition: 'stars > 0'
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockIndexes });

      const result = await indexManager.getExistingIndexes();

      expect(result).toEqual([
        {
          name: 'idx_users_email',
          table: 'users',
          columns: ['email'],
          unique: true,
          type: 'btree',
          condition: undefined
        },
        {
          name: 'idx_repositories_stars',
          table: 'repositories',
          columns: ['stars'],
          unique: false,
          type: 'btree',
          condition: 'stars > 0'
        }
      ]);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle errors when getting existing indexes', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(indexManager.getExistingIndexes()).rejects.toThrow('Database error');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('optimizeIndexes', () => {
    it('should optimize indexes based on usage statistics', async () => {
      const mockUsageStats = [
        {
          schemaname: 'public',
          tablename: 'users',
          indexname: 'idx_users_email',
          idx_tup_read: 1000,
          idx_tup_fetch: 950,
          idx_scan: 15000
        },
        {
          schemaname: 'public',
          tablename: 'repositories',
          indexname: 'idx_repositories_unused',
          idx_tup_read: 5,
          idx_tup_fetch: 2,
          idx_scan: 3
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: mockUsageStats }) // Usage stats query
        .mockResolvedValueOnce({ rows: [] }); // REINDEX query

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await indexManager.optimizeIndexes();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('idx_repositories_unused has low usage')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reindexed heavily used index: idx_users_email')
      );
      expect(mockClient.release).toHaveBeenCalled();

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle optimization errors gracefully', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Optimization failed'));

      await expect(indexManager.optimizeIndexes()).rejects.toThrow('Optimization failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('index type mapping', () => {
    it('should map PostgreSQL index types correctly', async () => {
      const testCases = [
        { pgType: 'btree', expected: 'btree' },
        { pgType: 'hash', expected: 'hash' },
        { pgType: 'gin', expected: 'gin' },
        { pgType: 'gist', expected: 'gist' },
        { pgType: 'unknown', expected: 'btree' }
      ];

      for (const testCase of testCases) {
        const mockIndexes = [{
          index_name: 'test_index',
          table_name: 'test_table',
          columns: ['test_column'],
          is_unique: false,
          index_type: testCase.pgType,
          condition: null
        }];

        mockClient.query.mockResolvedValueOnce({ rows: mockIndexes });

        const result = await indexManager.getExistingIndexes();
        expect(result[0].type).toBe(testCase.expected);
      }
    });
  });
});