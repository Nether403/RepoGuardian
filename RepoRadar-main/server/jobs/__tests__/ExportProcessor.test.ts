import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportProcessor } from '../processors/ExportProcessor';
import { Job } from '../Job';
import type { ExportJobData } from '../processors/ExportProcessor';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
            })),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

vi.mock('@shared/schema', () => ({
  repositories: {},
  analyses: {},
  savedRepositories: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  desc: vi.fn(),
}));

describe('ExportProcessor', () => {
  let processor: ExportProcessor;

  beforeEach(() => {
    processor = new ExportProcessor();
    vi.clearAllMocks();
  });

  it('should generate CSV export', async () => {
    const jobData: ExportJobData = {
      format: 'csv',
      exportType: 'analyses',
    };

    const job = new Job('export', jobData);

    // Mock the fetchAnalyses method to return test data
    const testData = [
      {
        id: 1,
        repositoryName: 'owner/repo1',
        language: 'TypeScript',
        stars: 100,
        overallScore: 7.5,
      },
      {
        id: 2,
        repositoryName: 'owner/repo2',
        language: 'JavaScript',
        stars: 200,
        overallScore: 8.0,
      },
    ];

    vi.spyOn(processor as any, 'fetchAnalyses').mockResolvedValue(testData);

    const result = await processor.process(job);

    expect(result.format).toBe('csv');
    expect(result.recordCount).toBe(2);
    expect(result.data).toContain('id,repositoryName,language,stars,overallScore');
    expect(result.data).toContain('owner/repo1');
    expect(result.data).toContain('owner/repo2');
    expect(result.fileName).toMatch(/analyses_export_\d+\.csv/);
    expect(job.status).toBe('completed');
  });

  it('should generate JSON export', async () => {
    const jobData: ExportJobData = {
      format: 'json',
      exportType: 'repositories',
    };

    const job = new Job('export', jobData);

    const testData = [
      {
        id: 1,
        fullName: 'owner/repo1',
        language: 'TypeScript',
        stars: 100,
      },
    ];

    vi.spyOn(processor as any, 'fetchRepositories').mockResolvedValue(testData);

    const result = await processor.process(job);

    expect(result.format).toBe('json');
    expect(result.recordCount).toBe(1);
    
    const parsedData = JSON.parse(result.data);
    expect(parsedData.recordCount).toBe(1);
    expect(parsedData.data).toHaveLength(1);
    expect(parsedData.data[0].fullName).toBe('owner/repo1');
    expect(result.fileName).toMatch(/repositories_export_\d+\.json/);
  });

  it('should handle CSV with special characters', async () => {
    const jobData: ExportJobData = {
      format: 'csv',
      exportType: 'analyses',
    };

    const job = new Job('export', jobData);

    const testData = [
      {
        id: 1,
        repositoryName: 'owner/repo-with-"quotes"',
        description: 'Description with, comma',
        language: 'TypeScript',
      },
    ];

    vi.spyOn(processor as any, 'fetchAnalyses').mockResolvedValue(testData);

    const result = await processor.process(job);

    expect(result.data).toContain('"owner/repo-with-""quotes"""');
    expect(result.data).toContain('"Description with, comma"');
  });

  it('should handle empty data export', async () => {
    const jobData: ExportJobData = {
      format: 'csv',
      exportType: 'analyses',
    };

    const job = new Job('export', jobData);

    vi.spyOn(processor as any, 'fetchAnalyses').mockResolvedValue([]);

    const result = await processor.process(job);

    expect(result.recordCount).toBe(0);
    expect(result.data).toBe('');
  });

  it('should update progress during export', async () => {
    const jobData: ExportJobData = {
      format: 'json',
      exportType: 'analyses',
    };

    const job = new Job('export', jobData);
    const progressUpdates: number[] = [];

    processor.onProgress = (progress: number) => {
      progressUpdates.push(progress);
    };

    vi.spyOn(processor as any, 'fetchAnalyses').mockResolvedValue([
      { id: 1, name: 'test' },
    ]);

    await processor.process(job);

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates).toContain(10); // Initial progress
    expect(progressUpdates).toContain(50); // After fetch
    expect(progressUpdates).toContain(90); // After generation
  });

  it('should handle invalid export type', async () => {
    const jobData: ExportJobData = {
      format: 'csv',
      exportType: 'invalid' as any,
    };

    const job = new Job('export', jobData);

    await expect(processor.process(job)).rejects.toThrow('Invalid export type');
  });

  it('should format dates correctly in CSV', async () => {
    const jobData: ExportJobData = {
      format: 'csv',
      exportType: 'analyses',
    };

    const job = new Job('export', jobData);

    const testDate = new Date('2024-01-01T12:00:00Z');
    const testData = [
      {
        id: 1,
        repositoryName: 'owner/repo1',
        analyzedAt: testDate,
      },
    ];

    vi.spyOn(processor as any, 'fetchAnalyses').mockResolvedValue(testData);

    const result = await processor.process(job);

    expect(result.data).toContain(testDate.toISOString());
  });

  it('should handle arrays in CSV export', async () => {
    const jobData: ExportJobData = {
      format: 'csv',
      exportType: 'repositories',
    };

    const job = new Job('export', jobData);

    const testData = [
      {
        id: 1,
        fullName: 'owner/repo1',
        topics: ['javascript', 'typescript', 'react'],
      },
    ];

    vi.spyOn(processor as any, 'fetchRepositories').mockResolvedValue(testData);

    const result = await processor.process(job);

    expect(result.data).toContain('"javascript; typescript; react"');
  });
});
