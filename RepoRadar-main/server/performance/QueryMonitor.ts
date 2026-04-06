import { IQueryMonitor, QueryMetrics } from './interfaces';

export class QueryMonitor implements IQueryMonitor {
  private activeQueries: Map<string, { query: string; startTime: number; connectionId?: string }> = new Map();
  private queryHistory: QueryMetrics[] = [];
  private slowQueryThreshold: number = 1000; // Default 1000ms threshold
  private maxHistorySize: number = 10000; // Keep last 10k queries

  startQuery(queryId: string, query: string, connectionId?: string): void {
    this.activeQueries.set(queryId, {
      query,
      startTime: Date.now(),
      connectionId
    });
  }

  endQuery(queryId: string, success: boolean, error?: string): void {
    const activeQuery = this.activeQueries.get(queryId);
    if (!activeQuery) {
      console.warn(`Query ${queryId} not found in active queries`);
      return;
    }

    const endTime = Date.now();
    const executionTime = endTime - activeQuery.startTime;

    const queryMetric: QueryMetrics = {
      queryId,
      query: activeQuery.query,
      executionTime,
      timestamp: new Date(activeQuery.startTime),
      success,
      error,
      connectionId: activeQuery.connectionId
    };

    // Add to history
    this.queryHistory.push(queryMetric);

    // Maintain history size limit
    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory = this.queryHistory.slice(-this.maxHistorySize);
    }

    // Log slow queries
    if (executionTime > this.slowQueryThreshold) {
      console.warn(`Slow query detected (${executionTime}ms): ${queryId}`, {
        query: activeQuery.query,
        executionTime,
        success,
        error
      });
    }

    // Remove from active queries
    this.activeQueries.delete(queryId);
  }

  async getMetrics(startTime?: Date, endTime?: Date): Promise<QueryMetrics[]> {
    let filteredMetrics = this.queryHistory;

    if (startTime || endTime) {
      filteredMetrics = this.queryHistory.filter(metric => {
        const metricTime = metric.timestamp.getTime();
        
        if (startTime && metricTime < startTime.getTime()) {
          return false;
        }
        
        if (endTime && metricTime > endTime.getTime()) {
          return false;
        }
        
        return true;
      });
    }

    return [...filteredMetrics]; // Return a copy to prevent external modification
  }

  async getSlowQueries(thresholdMs?: number): Promise<QueryMetrics[]> {
    const threshold = thresholdMs ?? this.slowQueryThreshold;
    
    return this.queryHistory.filter(metric => 
      metric.executionTime > threshold
    );
  }

  async cleanup(olderThan: Date): Promise<number> {
    const initialLength = this.queryHistory.length;
    
    this.queryHistory = this.queryHistory.filter(metric => 
      metric.timestamp.getTime() > olderThan.getTime()
    );
    
    const removedCount = initialLength - this.queryHistory.length;
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old query metrics`);
    }
    
    return removedCount;
  }

  setSlowQueryThreshold(thresholdMs: number): void {
    if (thresholdMs < 0) {
      throw new Error('Slow query threshold must be non-negative');
    }
    
    this.slowQueryThreshold = thresholdMs;
    console.log(`Slow query threshold set to ${thresholdMs}ms`);
  }

  // Additional utility methods

  /**
   * Get current active queries count
   */
  getActiveQueriesCount(): number {
    return this.activeQueries.size;
  }

  /**
   * Get active queries that have been running longer than threshold
   */
  getLongRunningQueries(thresholdMs?: number): Array<{ queryId: string; query: string; runningTime: number }> {
    const threshold = thresholdMs ?? this.slowQueryThreshold;
    const now = Date.now();
    const longRunning: Array<{ queryId: string; query: string; runningTime: number }> = [];

    for (const [queryId, activeQuery] of this.activeQueries) {
      const runningTime = now - activeQuery.startTime;
      if (runningTime > threshold) {
        longRunning.push({
          queryId,
          query: activeQuery.query,
          runningTime
        });
      }
    }

    return longRunning;
  }

  /**
   * Get query statistics
   */
  getQueryStats(): {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    activeQueries: number;
  } {
    const totalQueries = this.queryHistory.length;
    const successfulQueries = this.queryHistory.filter(q => q.success).length;
    const failedQueries = totalQueries - successfulQueries;
    
    const totalExecutionTime = this.queryHistory.reduce((sum, q) => sum + q.executionTime, 0);
    const averageExecutionTime = totalQueries > 0 ? totalExecutionTime / totalQueries : 0;
    
    const slowQueries = this.queryHistory.filter(q => q.executionTime > this.slowQueryThreshold).length;
    const activeQueries = this.activeQueries.size;

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      averageExecutionTime,
      slowQueries,
      activeQueries
    };
  }

  /**
   * Get most frequent queries
   */
  getMostFrequentQueries(limit: number = 10): Array<{ query: string; count: number; averageTime: number }> {
    const queryMap = new Map<string, { count: number; totalTime: number }>();

    // Normalize queries by removing parameters for grouping
    for (const metric of this.queryHistory) {
      const normalizedQuery = this.normalizeQuery(metric.query);
      const existing = queryMap.get(normalizedQuery) || { count: 0, totalTime: 0 };
      
      queryMap.set(normalizedQuery, {
        count: existing.count + 1,
        totalTime: existing.totalTime + metric.executionTime
      });
    }

    // Convert to array and sort by frequency
    const frequentQueries = Array.from(queryMap.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        averageTime: stats.totalTime / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return frequentQueries;
  }

  /**
   * Force cleanup of active queries that have been running too long
   */
  forceCleanupStaleQueries(maxRunningTimeMs: number = 300000): number { // 5 minutes default
    const now = Date.now();
    const staleQueries: string[] = [];

    for (const [queryId, activeQuery] of this.activeQueries) {
      const runningTime = now - activeQuery.startTime;
      if (runningTime > maxRunningTimeMs) {
        staleQueries.push(queryId);
      }
    }

    // Remove stale queries and log them as failed
    for (const queryId of staleQueries) {
      console.warn(`Force cleaning up stale query: ${queryId}`);
      this.endQuery(queryId, false, 'Query timed out - force cleanup');
    }

    return staleQueries.length;
  }

  /**
   * Normalize query for grouping similar queries
   */
  private normalizeQuery(query: string): string {
    // Simple normalization - replace parameters with placeholders
    return query
      .replace(/\$\d+/g, '$?') // Replace $1, $2, etc. with $?
      .replace(/'[^']*'/g, "'?'") // Replace string literals with '?'
      .replace(/\b\d+\b/g, '?') // Replace numbers with ?
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  /**
   * Clear all metrics and active queries (for testing)
   */
  clear(): void {
    this.queryHistory = [];
    this.activeQueries.clear();
  }
}