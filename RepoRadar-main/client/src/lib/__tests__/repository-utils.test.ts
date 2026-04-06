import { describe, it, expect } from 'vitest';
import {
  parseGitHubUrl,
  isValidGitHubUrl,
  buildGitHubSearchQuery,
  getSimilarityBadgeColor,
  normalizeRepository,
} from '../repository-utils';

describe('repository-utils', () => {
  describe('parseGitHubUrl', () => {
    it('should parse valid GitHub URLs', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should handle .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should return null for invalid URLs', () => {
      expect(parseGitHubUrl('not-a-url')).toBeNull();
      expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull();
    });
  });

  describe('isValidGitHubUrl', () => {
    it('should validate GitHub URLs', () => {
      expect(isValidGitHubUrl('https://github.com/owner/repo')).toBe(true);
      expect(isValidGitHubUrl('http://github.com/owner/repo')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidGitHubUrl('not-a-url')).toBe(false);
      expect(isValidGitHubUrl('https://gitlab.com/owner/repo')).toBe(false);
    });
  });

  describe('buildGitHubSearchQuery', () => {
    it('should build basic search query', () => {
      const result = buildGitHubSearchQuery('react');
      expect(result).toBe('react');
    });

    it('should add language filter', () => {
      const result = buildGitHubSearchQuery('react', { language: 'typescript' });
      expect(result).toContain('language:typescript');
    });

    it('should add star range filters', () => {
      const result = buildGitHubSearchQuery('react', { minStars: 100, maxStars: 1000 });
      expect(result).toContain('stars:>=100');
      expect(result).toContain('stars:<=1000');
    });

    it('should add archived filter', () => {
      const result = buildGitHubSearchQuery('react', { includeArchived: false });
      expect(result).toContain('archived:false');
    });

    it('should add topics', () => {
      const result = buildGitHubSearchQuery('react', { topics: ['ui', 'components'] });
      expect(result).toContain('topic:ui');
      expect(result).toContain('topic:components');
    });

    it('should combine multiple filters', () => {
      const result = buildGitHubSearchQuery('react', {
        language: 'typescript',
        minStars: 100,
        includeForked: false,
      });
      expect(result).toContain('language:typescript');
      expect(result).toContain('stars:>=100');
      expect(result).toContain('fork:false');
    });
  });

  describe('getSimilarityBadgeColor', () => {
    it('should return correct colors for similarity scores', () => {
      expect(getSimilarityBadgeColor(85)).toBe('bg-green-600');
      expect(getSimilarityBadgeColor(70)).toBe('bg-yellow-600');
      expect(getSimilarityBadgeColor(50)).toBe('bg-orange-600');
    });
  });

  describe('normalizeRepository', () => {
    it('should normalize repository with snake_case fields', () => {
      const repo = {
        id: 123,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        description: 'Test description',
        language: 'TypeScript',
        stargazers_count: 100,
        forks_count: 20,
        watchers_count: 50,
        html_url: 'https://github.com/owner/test-repo',
        topics: ['react', 'typescript'],
        updated_at: '2024-01-01',
      };

      const result = normalizeRepository(repo);
      expect(result.id).toBe('123');
      expect(result.name).toBe('test-repo');
      expect(result.fullName).toBe('owner/test-repo');
      expect(result.stars).toBe(100);
      expect(result.forks).toBe(20);
      expect(result.watchers).toBe(50);
    });

    it('should normalize repository with camelCase fields', () => {
      const repo = {
        id: 123,
        name: 'test-repo',
        fullName: 'owner/test-repo',
        stars: 100,
        forks: 20,
        watchers: 50,
        htmlUrl: 'https://github.com/owner/test-repo',
        topics: ['react'],
        updatedAt: '2024-01-01',
      };

      const result = normalizeRepository(repo);
      expect(result.fullName).toBe('owner/test-repo');
      expect(result.stars).toBe(100);
    });

    it('should handle missing fields', () => {
      const repo = { id: 123, name: 'test-repo' };
      const result = normalizeRepository(repo);
      expect(result.id).toBe('123');
      expect(result.name).toBe('test-repo');
      expect(result.description).toBeNull();
      expect(result.stars).toBe(0);
    });
  });
});
