import { BaseJobProcessor } from '../JobProcessor';
import type { Job } from '../Job';
import { db } from '../../db';
import { repositories, repositoryAnalyses, savedRepositories } from '@shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { AppError, ErrorCodes } from '@shared/errors';

/**
 * Export Job Data
 */
export interface ExportJobData {
  userId?: string;
  format: 'csv' | 'json';
  exportType: 'analyses' | 'repositories' | 'saved';
  filters?: {
    startDate?: string;
    endDate?: string;
    minScore?: number;
    maxScore?: number;
    language?: string;
  };
  notificationEmail?: string;
}

/**
 * Export Result
 */
export interface ExportResult {
  format: 'csv' | 'json';
  recordCount: number;
  data: string;
  fileName: string;
  completedAt: Date;
}

/**
 * Large Export Job Processor
 * Processes large data exports in the background
 */
export class ExportProcessor extends BaseJobProcessor<ExportJobData> {
  async process(job: Job<ExportJobData>): Promise<ExportResult> {
    const { format, exportType, filters, userId } = job.data;

    console.log(`Starting ${format.toUpperCase()} export for ${exportType}`);

    this.updateProgress(job, 10);

    // Fetch data based on export type
    let data: any[];
    switch (exportType) {
      case 'analyses':
        data = await this.fetchAnalyses(userId, filters);
        break;
      case 'repositories':
        data = await this.fetchRepositories(userId, filters);
        break;
      case 'saved':
        data = await this.fetchSavedRepositories(userId);
        break;
      default:
        throw new AppError(
          ErrorCodes.INVALID_INPUT.code,
          `Invalid export type: ${exportType}`,
          'Invalid export type specified',
          ErrorCodes.INVALID_INPUT.statusCode,
          'Please specify a valid export type'
        );
    }

    this.updateProgress(job, 50);

    console.log(`Fetched ${data.length} records for export`);

    // Generate export based on format
    let exportData: string;
    let fileName: string;

    if (format === 'csv') {
      exportData = this.generateCSV(data, exportType);
      fileName = `${exportType}_export_${Date.now()}.csv`;
    } else {
      exportData = this.generateJSON(data);
      fileName = `${exportType}_export_${Date.now()}.json`;
    }

    this.updateProgress(job, 90);

    const result: ExportResult = {
      format,
      recordCount: data.length,
      data: exportData,
      fileName,
      completedAt: new Date(),
    };

    console.log(`Export completed: ${data.length} records in ${format.toUpperCase()} format`);

    this.handleComplete(job, result);
    return result;
  }

  /**
   * Fetch analyses with filters
   */
  private async fetchAnalyses(userId?: string, filters?: ExportJobData['filters']): Promise<any[]> {
    const conditions = [];

    if (userId) {
      conditions.push(eq(repositoryAnalyses.userId, userId));
    }

    if (filters?.startDate) {
      conditions.push(gte(repositoryAnalyses.createdAt, new Date(filters.startDate)));
    }

    if (filters?.endDate) {
      conditions.push(lte(repositoryAnalyses.createdAt, new Date(filters.endDate)));
    }

    const query = db
      .select({
        id: repositoryAnalyses.id,
        repositoryId: repositoryAnalyses.repositoryId,
        repositoryName: repositories.fullName,
        language: repositories.language,
        stars: repositories.stars,
        overallScore: repositoryAnalyses.overallScore,
        originality: repositoryAnalyses.originality,
        completeness: repositoryAnalyses.completeness,
        marketability: repositoryAnalyses.marketability,
        monetization: repositoryAnalyses.monetization,
        usefulness: repositoryAnalyses.usefulness,
        summary: repositoryAnalyses.summary,
        analyzedAt: repositoryAnalyses.createdAt,
      })
      .from(repositoryAnalyses)
      .leftJoin(repositories, eq(repositoryAnalyses.repositoryId, repositories.id))
      .orderBy(desc(repositoryAnalyses.createdAt))
      .limit(10000); // Limit to prevent excessive memory usage

    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }

    return await query;
  }

  /**
   * Fetch repositories with filters
   */
  private async fetchRepositories(userId?: string, filters?: ExportJobData['filters']): Promise<any[]> {
    const conditions = [];

    if (filters?.language) {
      conditions.push(eq(repositories.language, filters.language));
    }

    const query = db
      .select({
        id: repositories.id,
        fullName: repositories.fullName,
        description: repositories.description,
        language: repositories.language,
        stars: repositories.stars,
        forks: repositories.forks,
        topics: repositories.topics,
        createdAt: repositories.createdAt,
      })
      .from(repositories)
      .orderBy(desc(repositories.stars))
      .limit(10000);

    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }

    return await query;
  }

  /**
   * Fetch saved repositories for a user
   */
  private async fetchSavedRepositories(userId?: string): Promise<any[]> {
    if (!userId) {
      throw new AppError(
        ErrorCodes.UNAUTHORIZED.code,
        'User ID required for saved repositories export',
        'Authentication required',
        ErrorCodes.UNAUTHORIZED.statusCode,
        'Please log in to export saved repositories'
      );
    }

    return await db
      .select({
        id: savedRepositories.id,
        repositoryName: repositories.fullName,
        description: repositories.description,
        language: repositories.language,
        stars: repositories.stars,
        createdAt: savedRepositories.createdAt,
      })
      .from(savedRepositories)
      .leftJoin(repositories, eq(savedRepositories.repositoryId, repositories.id))
      .where(eq(savedRepositories.userId, userId))
      .orderBy(desc(savedRepositories.createdAt))
      .limit(10000);
  }

  /**
   * Generate CSV format
   */
  private generateCSV(data: any[], exportType: string): string {
    if (data.length === 0) {
      return '';
    }

    // Get headers from first record
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    // Generate rows
    const csvRows = data.map(record => {
      return headers.map(header => {
        const value = record[header];
        
        // Handle null/undefined
        if (value === null || value === undefined) {
          return '';
        }

        // Handle dates
        if (value instanceof Date) {
          return value.toISOString();
        }

        // Handle arrays
        if (Array.isArray(value)) {
          return `"${value.join('; ')}"`;
        }

        // Handle objects
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }

        // Handle strings with commas or quotes
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Generate JSON format
   */
  private generateJSON(data: any[]): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      recordCount: data.length,
      data,
    }, null, 2);
  }
}
