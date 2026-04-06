/**
 * Reusable repository statistics component
 * Displays common repository metrics (stars, forks, watchers, etc.)
 */

import { Star, GitFork, Eye, Calendar } from 'lucide-react';
import { formatNumber, formatDate } from '@/lib/format-utils';

export interface RepositoryStatsProps {
  stars?: number | null;
  forks?: number | null;
  watchers?: number | null;
  updatedAt?: Date | string | null;
  size?: number | null;
  className?: string;
  showSize?: boolean;
  showWatchers?: boolean;
  testId?: string;
}

export function RepositoryStats({
  stars,
  forks,
  watchers,
  updatedAt,
  size,
  className = '',
  showSize = false,
  showWatchers = true,
  testId,
}: RepositoryStatsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500 ${className}`} data-testid={testId}>
      {stars !== undefined && stars !== null && (
        <span className="flex items-center gap-1 touch-target" data-testid={`${testId}-stars`}>
          <Star className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
          {formatNumber(stars)}
        </span>
      )}
      
      {forks !== undefined && forks !== null && (
        <span className="flex items-center gap-1 touch-target" data-testid={`${testId}-forks`}>
          <GitFork className="w-3 h-3 md:w-4 md:h-4" />
          {formatNumber(forks)}
        </span>
      )}
      
      {showWatchers && watchers !== undefined && watchers !== null && (
        <span className="flex items-center gap-1 touch-target hidden sm:flex" data-testid={`${testId}-watchers`}>
          <Eye className="w-3 h-3 md:w-4 md:h-4" />
          {formatNumber(watchers)}
        </span>
      )}
      
      {updatedAt && (
        <span className="flex items-center gap-1 touch-target hidden md:flex" data-testid={`${testId}-updated`}>
          <Calendar className="w-3 h-3 md:w-4 md:h-4" />
          Updated {formatDate(updatedAt)}
        </span>
      )}
      
      {showSize && size && (
        <span className="text-xs hidden lg:inline" data-testid={`${testId}-size`}>
          {(size / 1024).toFixed(1)} MB
        </span>
      )}
    </div>
  );
}
