import { Pool, PoolClient } from '@neondatabase/serverless';
import { IIndexManager, IndexInfo, QueryAnalysis } from './interfaces';

export class IndexManager implements IIndexManager {
  private pool: Pool;
  private criticalIndexes: IndexInfo[] = [
    // User-related indexes
    {
      name: 'idx_users_email',
      table: 'users',
      columns: ['email'],
      unique: true,
      type: 'btree'
    },
    {
      name: 'idx_users_subscription_status',
      table: 'users',
      columns: ['subscription_status'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_users_api_key',
      table: 'users',
      columns: ['api_key'],
      unique: true,
      type: 'btree'
    },
    
    // Repository-related indexes
    {
      name: 'idx_repositories_full_name',
      table: 'repositories',
      columns: ['full_name'],
      unique: true,
      type: 'btree'
    },
    {
      name: 'idx_repositories_owner',
      table: 'repositories',
      columns: ['owner'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_repositories_language',
      table: 'repositories',
      columns: ['language'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_repositories_stars',
      table: 'repositories',
      columns: ['stars'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_repositories_last_analyzed',
      table: 'repositories',
      columns: ['last_analyzed'],
      unique: false,
      type: 'btree'
    },
    
    // Repository analyses indexes
    {
      name: 'idx_repository_analyses_repository_id',
      table: 'repository_analyses',
      columns: ['repository_id'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_repository_analyses_user_id',
      table: 'repository_analyses',
      columns: ['user_id'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_repository_analyses_overall_score',
      table: 'repository_analyses',
      columns: ['overall_score'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_repository_analyses_created_at',
      table: 'repository_analyses',
      columns: ['created_at'],
      unique: false,
      type: 'btree'
    },
    
    // Saved repositories indexes
    {
      name: 'idx_saved_repositories_user_id',
      table: 'saved_repositories',
      columns: ['user_id'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_saved_repositories_repository_id',
      table: 'saved_repositories',
      columns: ['repository_id'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_saved_repositories_user_repo',
      table: 'saved_repositories',
      columns: ['user_id', 'repository_id'],
      unique: true,
      type: 'btree'
    },
    
    // Similar repositories indexes
    {
      name: 'idx_similar_repositories_repository_id',
      table: 'similar_repositories',
      columns: ['repository_id'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_similar_repositories_similarity',
      table: 'similar_repositories',
      columns: ['similarity'],
      unique: false,
      type: 'btree'
    },
    
    // User activities indexes for performance monitoring
    {
      name: 'idx_user_activities_user_created',
      table: 'user_activities',
      columns: ['user_id', 'created_at'],
      unique: false,
      type: 'btree'
    },
    
    // Notifications indexes
    {
      name: 'idx_notifications_user_read',
      table: 'notifications',
      columns: ['user_id', 'is_read'],
      unique: false,
      type: 'btree'
    },
    
    // API usage indexes for performance monitoring
    {
      name: 'idx_api_usage_timestamp',
      table: 'api_usage',
      columns: ['timestamp'],
      unique: false,
      type: 'btree'
    },
    {
      name: 'idx_api_usage_key_timestamp',
      table: 'api_usage',
      columns: ['api_key_id', 'timestamp'],
      unique: false,
      type: 'btree'
    }
  ];

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async ensureIndexes(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const existingIndexes = await this.getExistingIndexes();
      const existingIndexNames = new Set(existingIndexes.map(idx => idx.name));

      for (const indexInfo of this.criticalIndexes) {
        if (!existingIndexNames.has(indexInfo.name)) {
          console.log(`Creating missing index: ${indexInfo.name}`);
          await this.createIndex(indexInfo, client);
        }
      }
    } finally {
      client.release();
    }
  }

  async createIndex(indexInfo: IndexInfo, client?: PoolClient): Promise<void> {
    const shouldReleaseClient = !client;
    if (!client) {
      client = await this.pool.connect();
    }

    try {
      const columnsStr = indexInfo.columns.join(', ');
      const uniqueStr = indexInfo.unique ? 'UNIQUE' : '';
      const conditionStr = indexInfo.condition ? `WHERE ${indexInfo.condition}` : '';
      
      const sql = `
        CREATE ${uniqueStr} INDEX CONCURRENTLY IF NOT EXISTS ${indexInfo.name}
        ON ${indexInfo.table} USING ${indexInfo.type} (${columnsStr})
        ${conditionStr}
      `.trim();

      await client.query(sql);
      console.log(`Successfully created index: ${indexInfo.name}`);
    } catch (error) {
      console.error(`Failed to create index ${indexInfo.name}:`, error);
      throw error;
    } finally {
      if (shouldReleaseClient) {
        client.release();
      }
    }
  }

  async dropIndex(indexName: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`);
      console.log(`Successfully dropped index: ${indexName}`);
    } catch (error) {
      console.error(`Failed to drop index ${indexName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const client = await this.pool.connect();
    try {
      const queryId = this.generateQueryId(query);
      
      // Get query execution plan
      const explainResult = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
      const plan = explainResult.rows[0]['QUERY PLAN'][0];
      
      const executionTime = plan['Execution Time'] || 0;
      const planningTime = plan['Planning Time'] || 0;
      const totalCost = plan.Plan?.['Total Cost'] || 0;
      
      // Extract indexes used from the plan
      const indexesUsed = this.extractIndexesFromPlan(plan.Plan);
      
      // Generate suggested indexes based on query analysis
      const suggestedIndexes = await this.generateIndexSuggestions(query, plan.Plan);
      
      return {
        queryId,
        query,
        executionTime,
        planningTime,
        indexesUsed,
        suggestedIndexes,
        cost: totalCost
      };
    } catch (error) {
      console.error('Failed to analyze query:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getExistingIndexes(): Promise<IndexInfo[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          i.relname as index_name,
          t.relname as table_name,
          array_agg(a.attname ORDER BY c.ordinality) as columns,
          ix.indisunique as is_unique,
          am.amname as index_type,
          pg_get_expr(ix.indpred, ix.indrelid) as condition
        FROM pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_am am ON i.relam = am.oid
        JOIN unnest(ix.indkey) WITH ORDINALITY AS c(attnum, ordinality) ON true
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
        WHERE t.relkind = 'r'
          AND i.relname NOT LIKE 'pg_%'
          AND t.relname IN (
            'users', 'repositories', 'repository_analyses', 'saved_repositories',
            'similar_repositories', 'user_activities', 'notifications', 'api_usage',
            'bookmarks', 'tags', 'repository_tags', 'collections', 'collection_items',
            'user_preferences', 'tracked_repositories', 'comments', 'comment_likes',
            'ratings', 'rating_helpful', 'teams', 'team_members', 'team_invitations',
            'shared_analyses', 'api_keys', 'webhooks'
          )
        GROUP BY i.relname, t.relname, ix.indisunique, am.amname, ix.indpred, ix.indrelid
        ORDER BY t.relname, i.relname
      `);

      return result.rows.map(row => ({
        name: row.index_name,
        table: row.table_name,
        columns: row.columns,
        unique: row.is_unique,
        type: this.mapIndexType(row.index_type),
        condition: row.condition || undefined
      }));
    } catch (error) {
      console.error('Failed to get existing indexes:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async optimizeIndexes(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Get index usage statistics
      const usageStats = await client.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan ASC
      `);

      // Identify unused indexes (very low scan count)
      const unusedIndexes = usageStats.rows.filter(row => 
        row.idx_scan < 10 && 
        !row.indexname.includes('_pkey') && // Don't drop primary keys
        !row.indexname.includes('_unique') // Don't drop unique constraints
      );

      for (const unusedIndex of unusedIndexes) {
        console.warn(`Index ${unusedIndex.indexname} has low usage (${unusedIndex.idx_scan} scans). Consider dropping it.`);
      }

      // Reindex heavily used indexes
      const heavilyUsedIndexes = usageStats.rows.filter(row => row.idx_scan > 10000);
      
      for (const index of heavilyUsedIndexes) {
        try {
          await client.query(`REINDEX INDEX CONCURRENTLY ${index.indexname}`);
          console.log(`Reindexed heavily used index: ${index.indexname}`);
        } catch (error) {
          console.error(`Failed to reindex ${index.indexname}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to optimize indexes:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private generateQueryId(query: string): string {
    // Simple hash function for query ID
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private extractIndexesFromPlan(plan: any): string[] {
    const indexes: string[] = [];
    
    if (plan['Index Name']) {
      indexes.push(plan['Index Name']);
    }
    
    if (plan.Plans) {
      for (const subPlan of plan.Plans) {
        indexes.push(...this.extractIndexesFromPlan(subPlan));
      }
    }
    
    return [...new Set(indexes)]; // Remove duplicates
  }

  private async generateIndexSuggestions(query: string, plan: any): Promise<IndexInfo[]> {
    const suggestions: IndexInfo[] = [];
    
    // Simple heuristics for index suggestions
    // This is a basic implementation - in production, you'd want more sophisticated analysis
    
    // Look for sequential scans that could benefit from indexes
    if (this.hasSequentialScan(plan)) {
      const tableScans = this.extractTableScans(plan);
      
      for (const tableScan of tableScans) {
        // Suggest index on commonly filtered columns
        if (query.toLowerCase().includes('where')) {
          const whereClause = this.extractWhereClause(query);
          const columns = this.extractColumnsFromWhere(whereClause, tableScan.table);
          
          if (columns.length > 0) {
            suggestions.push({
              name: `idx_${tableScan.table}_${columns.join('_')}`,
              table: tableScan.table,
              columns,
              unique: false,
              type: 'btree'
            });
          }
        }
      }
    }
    
    return suggestions;
  }

  private hasSequentialScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') {
      return true;
    }
    
    if (plan.Plans) {
      return plan.Plans.some((subPlan: any) => this.hasSequentialScan(subPlan));
    }
    
    return false;
  }

  private extractTableScans(plan: any): Array<{ table: string }> {
    const scans: Array<{ table: string }> = [];
    
    if (plan['Node Type'] === 'Seq Scan' && plan['Relation Name']) {
      scans.push({ table: plan['Relation Name'] });
    }
    
    if (plan.Plans) {
      for (const subPlan of plan.Plans) {
        scans.push(...this.extractTableScans(subPlan));
      }
    }
    
    return scans;
  }

  private extractWhereClause(query: string): string {
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|\s*$)/i);
    return whereMatch ? whereMatch[1] : '';
  }

  private extractColumnsFromWhere(whereClause: string, tableName: string): string[] {
    // Simple column extraction - in production, you'd want a proper SQL parser
    const columns: string[] = [];
    const columnPattern = /(\w+)\s*[=<>!]/g;
    let match;
    
    while ((match = columnPattern.exec(whereClause)) !== null) {
      const column = match[1];
      if (column && column !== 'AND' && column !== 'OR') {
        columns.push(column);
      }
    }
    
    return [...new Set(columns)]; // Remove duplicates
  }

  private mapIndexType(pgIndexType: string): 'btree' | 'hash' | 'gin' | 'gist' {
    switch (pgIndexType.toLowerCase()) {
      case 'hash':
        return 'hash';
      case 'gin':
        return 'gin';
      case 'gist':
        return 'gist';
      default:
        return 'btree';
    }
  }
}