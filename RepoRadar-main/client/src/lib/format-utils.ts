/**
 * Common formatting utilities
 * Provides consistent formatting across the application
 */

import { format, formatDistanceToNow } from 'date-fns';

/**
 * Format a number with appropriate suffix (K, M, B)
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format a date to a readable string
 */
export function formatDate(date: Date | string | null | undefined, formatStr: string = 'MMM dd, yyyy'): string {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, formatStr);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a date as relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Format a percentage with optional decimal places
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Format a score with color class based on value
 */
export function getScoreColorClass(score: number): string {
  if (score >= 9) return 'text-green-400';
  if (score >= 7) return 'text-primary';
  if (score >= 5) return 'text-accent';
  return 'text-gray-400';
}

/**
 * Get progress bar width percentage
 */
export function getProgressWidth(score: number, maxScore: number = 10): string {
  return `${(score / maxScore) * 100}%`;
}

/**
 * Get gradient class for a metric
 */
export function getMetricGradient(metric: string): string {
  const gradients: Record<string, string> = {
    originality: 'from-primary to-secondary',
    completeness: 'from-green-400 to-blue-500',
    marketability: 'from-accent to-primary',
    monetization: 'from-purple-400 to-pink-500',
    usefulness: 'from-yellow-400 to-orange-500',
  };
  
  return gradients[metric.toLowerCase()] || 'from-primary to-secondary';
}
