import { BaseJobProcessor } from '../JobProcessor';
import type { Job } from '../Job';
import { githubService } from '../../github';
import { analyzeRepository } from '../../gemini';
import { AppError, ErrorCodes } from '@shared/errors';

/**
 * Batch Analysis Job Data
 */
export interface BatchAnalysisJobData {
  repositories: Array<{
    url: string;
    owner: string;
    repo: string;
  }>;
  userId?: string;
  notificationEmail?: string;
}

/**
 * Batch Analysis Result
 */
export interface BatchAnalysisResult {
  totalRepositories: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  results: Array<{
    repository: string;
    status: 'success' | 'failed';
    analysis?: any;
    error?: string;
  }>;
  completedAt: Date;
}

/**
 * Batch Analysis Job Processor
 * Processes multiple repository analyses in a single job
 */
export class BatchAnalysisProcessor extends BaseJobProcessor<BatchAnalysisJobData> {
  async process(job: Job<BatchAnalysisJobData>): Promise<BatchAnalysisResult> {
    const { repositories } = job.data;
    const totalRepos = repositories.length;

    console.log(`Starting batch analysis for ${totalRepos} repositories`);

    const results: BatchAnalysisResult['results'] = [];
    let successCount = 0;
    let failedCount = 0;

    // Process each repository
    for (let i = 0; i < repositories.length; i++) {
      const repo = repositories[i];
      const progress = Math.round(((i + 1) / totalRepos) * 100);

      try {
        console.log(`Analyzing repository ${i + 1}/${totalRepos}: ${repo.owner}/${repo.repo}`);

        // Fetch repository details from GitHub
        const repoDetails = await githubService.getRepositoryWithDetails(
          repo.owner,
          repo.repo
        );

        if (!repoDetails) {
          throw new AppError(
            ErrorCodes.NOT_FOUND.code,
            `Repository ${repo.owner}/${repo.repo} not found`,
            'Repository not found or is private',
            ErrorCodes.NOT_FOUND.statusCode,
            'Verify the repository exists and is publicly accessible'
          );
        }

        // Analyze with AI
        const analysis = await analyzeRepository({
          name: repoDetails.repository.full_name,
          description: repoDetails.repository.description || '',
          language: repoDetails.repository.language || 'Unknown',
          stars: repoDetails.repository.stargazers_count,
          forks: repoDetails.repository.forks_count,
          size: repoDetails.repository.size,
          languages: repoDetails.languages,
          topics: repoDetails.repository.topics || [],
          readme: repoDetails.readme,
        });

        results.push({
          repository: `${repo.owner}/${repo.repo}`,
          status: 'success',
          analysis,
        });

        successCount++;
        console.log(`Successfully analyzed ${repo.owner}/${repo.repo}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`Failed to analyze ${repo.owner}/${repo.repo}:`, err.message);

        results.push({
          repository: `${repo.owner}/${repo.repo}`,
          status: 'failed',
          error: err.message,
        });

        failedCount++;
      }

      // Update progress
      this.updateProgress(job, progress);

      // Add small delay between analyses to avoid rate limiting
      if (i < repositories.length - 1) {
        await this.sleep(1000);
      }
    }

    const result: BatchAnalysisResult = {
      totalRepositories: totalRepos,
      successfulAnalyses: successCount,
      failedAnalyses: failedCount,
      results,
      completedAt: new Date(),
    };

    console.log(`Batch analysis completed: ${successCount} successful, ${failedCount} failed`);

    this.handleComplete(job, result);
    return result;
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
