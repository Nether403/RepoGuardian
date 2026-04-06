import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchAnalysisProcessor } from '../processors/BatchAnalysisProcessor';
import { Job } from '../Job';
import type { BatchAnalysisJobData } from '../processors/BatchAnalysisProcessor';
import * as githubService from '../../github';
import * as geminiService from '../../gemini';

// Mock the services
vi.mock('../../github', () => ({
  githubService: {
    getRepositoryWithDetails: vi.fn(),
  },
}));

vi.mock('../../gemini', () => ({
  analyzeRepository: vi.fn(),
}));

describe('BatchAnalysisProcessor', () => {
  let processor: BatchAnalysisProcessor;

  beforeEach(() => {
    processor = new BatchAnalysisProcessor();
    vi.clearAllMocks();
  });

  it('should process batch analysis successfully', async () => {
    const jobData: BatchAnalysisJobData = {
      repositories: [
        { url: 'https://github.com/owner1/repo1', owner: 'owner1', repo: 'repo1' },
        { url: 'https://github.com/owner2/repo2', owner: 'owner2', repo: 'repo2' },
      ],
    };

    const job = new Job('batch-analysis', jobData);

    // Mock GitHub service responses
    vi.mocked(githubService.githubService.getRepositoryWithDetails)
      .mockResolvedValueOnce({
        repository: {
          id: 1,
          name: 'repo1',
          full_name: 'owner1/repo1',
          owner: { login: 'owner1' },
          description: 'Test repo 1',
          language: 'TypeScript',
          stargazers_count: 100,
          forks_count: 10,
          watchers_count: 50,
          size: 1000,
          private: false,
          html_url: 'https://github.com/owner1/repo1',
          clone_url: 'https://github.com/owner1/repo1.git',
          topics: ['test'],
        },
        languages: { TypeScript: 1000 },
        readme: 'Test README',
      })
      .mockResolvedValueOnce({
        repository: {
          id: 2,
          name: 'repo2',
          full_name: 'owner2/repo2',
          owner: { login: 'owner2' },
          description: 'Test repo 2',
          language: 'JavaScript',
          stargazers_count: 200,
          forks_count: 20,
          watchers_count: 100,
          size: 2000,
          private: false,
          html_url: 'https://github.com/owner2/repo2',
          clone_url: 'https://github.com/owner2/repo2.git',
          topics: ['test'],
        },
        languages: { JavaScript: 2000 },
        readme: 'Test README 2',
      });

    // Mock Gemini analysis responses
    vi.mocked(geminiService.analyzeRepository)
      .mockResolvedValueOnce({
        originality: 8,
        completeness: 7,
        marketability: 6,
        monetization: 5,
        usefulness: 9,
        overallScore: 7,
        summary: 'Good project',
        strengths: [],
        weaknesses: [],
        recommendations: [],
        scoreExplanations: {
          originality: 'Unique approach',
          completeness: 'Well documented',
          marketability: 'Good market fit',
          monetization: 'Some potential',
          usefulness: 'Very useful',
        },
      })
      .mockResolvedValueOnce({
        originality: 7,
        completeness: 8,
        marketability: 7,
        monetization: 6,
        usefulness: 8,
        overallScore: 7.2,
        summary: 'Solid project',
        strengths: [],
        weaknesses: [],
        recommendations: [],
        scoreExplanations: {
          originality: 'Good ideas',
          completeness: 'Complete implementation',
          marketability: 'Market ready',
          monetization: 'Revenue potential',
          usefulness: 'Highly useful',
        },
      });

    const result = await processor.process(job);

    expect(result.totalRepositories).toBe(2);
    expect(result.successfulAnalyses).toBe(2);
    expect(result.failedAnalyses).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe('success');
    expect(result.results[1].status).toBe('success');
    expect(job.status).toBe('completed');
    expect(job.progress).toBe(100);
  });

  it('should handle partial failures in batch analysis', async () => {
    const jobData: BatchAnalysisJobData = {
      repositories: [
        { url: 'https://github.com/owner1/repo1', owner: 'owner1', repo: 'repo1' },
        { url: 'https://github.com/owner2/repo2', owner: 'owner2', repo: 'repo2' },
      ],
    };

    const job = new Job('batch-analysis', jobData);

    // First repo succeeds
    vi.mocked(githubService.githubService.getRepositoryWithDetails)
      .mockResolvedValueOnce({
        repository: {
          id: 1,
          name: 'repo1',
          full_name: 'owner1/repo1',
          owner: { login: 'owner1' },
          description: 'Test repo 1',
          language: 'TypeScript',
          stargazers_count: 100,
          forks_count: 10,
          watchers_count: 50,
          size: 1000,
          private: false,
          html_url: 'https://github.com/owner1/repo1',
          clone_url: 'https://github.com/owner1/repo1.git',
          topics: ['test'],
        },
        languages: { TypeScript: 1000 },
        readme: 'Test README',
      })
      // Second repo fails (not found)
      .mockResolvedValueOnce(null);

    vi.mocked(geminiService.analyzeRepository).mockResolvedValueOnce({
      originality: 8,
      completeness: 7,
      marketability: 6,
      monetization: 5,
      usefulness: 9,
      overallScore: 7,
      summary: 'Good project',
      strengths: [],
      weaknesses: [],
      recommendations: [],
      scoreExplanations: {
        originality: 'Unique',
        completeness: 'Complete',
        marketability: 'Marketable',
        monetization: 'Monetizable',
        usefulness: 'Useful',
      },
    });

    const result = await processor.process(job);

    expect(result.totalRepositories).toBe(2);
    expect(result.successfulAnalyses).toBe(1);
    expect(result.failedAnalyses).toBe(1);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe('success');
    expect(result.results[1].status).toBe('failed');
    expect(result.results[1].error).toBeDefined();
  });

  it('should update progress during batch analysis', async () => {
    const jobData: BatchAnalysisJobData = {
      repositories: [
        { url: 'https://github.com/owner1/repo1', owner: 'owner1', repo: 'repo1' },
      ],
    };

    const job = new Job('batch-analysis', jobData);
    const progressUpdates: number[] = [];

    processor.onProgress = (progress: number) => {
      progressUpdates.push(progress);
    };

    vi.mocked(githubService.githubService.getRepositoryWithDetails).mockResolvedValueOnce({
      repository: {
        id: 1,
        name: 'repo1',
        full_name: 'owner1/repo1',
        owner: { login: 'owner1' },
        description: 'Test repo',
        language: 'TypeScript',
        stargazers_count: 100,
        forks_count: 10,
        watchers_count: 50,
        size: 1000,
        private: false,
        html_url: 'https://github.com/owner1/repo1',
        clone_url: 'https://github.com/owner1/repo1.git',
        topics: ['test'],
      },
      languages: { TypeScript: 1000 },
      readme: 'Test README',
    });

    vi.mocked(geminiService.analyzeRepository).mockResolvedValueOnce({
      originality: 8,
      completeness: 7,
      marketability: 6,
      monetization: 5,
      usefulness: 9,
      overallScore: 7,
      summary: 'Good project',
      strengths: [],
      weaknesses: [],
      recommendations: [],
      scoreExplanations: {
        originality: 'Unique',
        completeness: 'Complete',
        marketability: 'Marketable',
        monetization: 'Monetizable',
        usefulness: 'Useful',
      },
    });

    await processor.process(job);

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  });

  it('should handle empty repository list', async () => {
    const jobData: BatchAnalysisJobData = {
      repositories: [],
    };

    const job = new Job('batch-analysis', jobData);
    const result = await processor.process(job);

    expect(result.totalRepositories).toBe(0);
    expect(result.successfulAnalyses).toBe(0);
    expect(result.failedAnalyses).toBe(0);
    expect(result.results).toHaveLength(0);
  });
});
