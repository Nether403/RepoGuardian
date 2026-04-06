import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatDate,
  formatFileSize,
  formatPercentage,
  truncateText,
  getScoreColorClass,
  getProgressWidth,
  getMetricGradient,
} from '../format-utils';

describe('format-utils', () => {
  describe('formatNumber', () => {
    it('should format large numbers with suffixes', () => {
      expect(formatNumber(1500)).toBe('1.5K');
      expect(formatNumber(1500000)).toBe('1.5M');
      expect(formatNumber(1500000000)).toBe('1.5B');
    });

    it('should handle small numbers', () => {
      expect(formatNumber(500)).toBe('500');
      expect(formatNumber(0)).toBe('0');
    });

    it('should handle null and undefined', () => {
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
    });
  });

  describe('formatDate', () => {
    it('should format date objects', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('should format date strings', () => {
      const result = formatDate('2024-01-15');
      expect(result).toContain('Jan');
    });

    it('should handle invalid dates', () => {
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate(undefined)).toBe('N/A');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes to human-readable sizes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(1073741824)).toBe('1.0 GB');
    });

    it('should handle zero and null', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(null)).toBe('0 B');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages', () => {
      expect(formatPercentage(85.5)).toBe('86%');
      expect(formatPercentage(85.5, 1)).toBe('85.5%');
      expect(formatPercentage(85.5, 2)).toBe('85.50%');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const text = 'This is a very long text that needs to be truncated';
      expect(truncateText(text, 20)).toBe('This is a very long ...');
    });

    it('should not truncate short text', () => {
      const text = 'Short text';
      expect(truncateText(text, 20)).toBe('Short text');
    });

    it('should handle null and undefined', () => {
      expect(truncateText(null, 20)).toBe('');
      expect(truncateText(undefined, 20)).toBe('');
    });
  });

  describe('getScoreColorClass', () => {
    it('should return correct color classes', () => {
      expect(getScoreColorClass(9.5)).toBe('text-green-400');
      expect(getScoreColorClass(7.5)).toBe('text-primary');
      expect(getScoreColorClass(5.5)).toBe('text-accent');
      expect(getScoreColorClass(3.0)).toBe('text-gray-400');
    });
  });

  describe('getProgressWidth', () => {
    it('should calculate progress width', () => {
      expect(getProgressWidth(5, 10)).toBe('50%');
      expect(getProgressWidth(7.5, 10)).toBe('75%');
      expect(getProgressWidth(10, 10)).toBe('100%');
    });
  });

  describe('getMetricGradient', () => {
    it('should return correct gradients for metrics', () => {
      expect(getMetricGradient('originality')).toBe('from-primary to-secondary');
      expect(getMetricGradient('completeness')).toBe('from-green-400 to-blue-500');
      expect(getMetricGradient('marketability')).toBe('from-accent to-primary');
    });

    it('should return default gradient for unknown metrics', () => {
      expect(getMetricGradient('unknown')).toBe('from-primary to-secondary');
    });
  });
});
