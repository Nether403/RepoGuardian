/**
 * Reusable score display component
 * Provides consistent score visualization across the application
 */

import { getScoreHealthIndicator, getMetricHealthIndicator } from '@/utils/health-indicators';
import { getScoreColorClass, getProgressWidth, getMetricGradient } from '@/lib/format-utils';

export interface ScoreDisplayProps {
  label: string;
  score: number;
  metricKey: string;
  explanation?: string;
  maxScore?: number;
  showEmoji?: boolean;
  showLabel?: boolean;
  testId?: string;
}

export function ScoreDisplay({
  label,
  score,
  metricKey,
  explanation,
  maxScore = 10,
  showEmoji = true,
  showLabel = true,
  testId,
}: ScoreDisplayProps) {
  const healthIndicator = getScoreHealthIndicator(score * 10);
  const emoji = getMetricHealthIndicator(metricKey, score * 10);
  
  return (
    <div className="bg-dark rounded-lg p-3 md:p-4" data-testid={testId}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {showEmoji && (
            <span className="text-xl md:text-2xl">{emoji}</span>
          )}
          <span className="text-sm md:text-base font-medium">{label}</span>
        </div>
        <div className="flex items-center space-x-1 md:space-x-2">
          <span 
            className={`text-xl md:text-2xl font-bold ${getScoreColorClass(score)}`}
            data-testid={`${testId}-value`}
          >
            {score.toFixed(1)}
          </span>
          {showLabel && (
            <span className={`text-xs md:text-sm ${healthIndicator.color} hidden sm:inline`}>
              {healthIndicator.label}
            </span>
          )}
        </div>
      </div>
      <div className="w-full h-2 md:h-3 bg-gray-700 rounded-full overflow-hidden mb-2">
        <div 
          className={`h-full bg-gradient-to-r ${getMetricGradient(metricKey)} rounded-full transition-all duration-1000`}
          style={{ width: getProgressWidth(score, maxScore) }}
        ></div>
      </div>
      {explanation && (
        <p className="text-xs text-gray-400 mt-2 italic">
          {explanation}
        </p>
      )}
    </div>
  );
}

export interface OverallScoreDisplayProps {
  score: number;
  description?: string;
  testId?: string;
}

export function OverallScoreDisplay({ score, description, testId }: OverallScoreDisplayProps) {
  const healthIndicator = getScoreHealthIndicator(score * 10);
  
  const defaultDescription = 
    score >= 9 ? 'Exceptional repository with outstanding potential' :
    score >= 7 ? 'High-quality repository with strong potential' :
    score >= 5 ? 'Good repository with moderate potential' :
    'Repository needs improvement in key areas';
  
  return (
    <div className="bg-dark rounded-lg p-4 border border-primary/20" data-testid={testId}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-3xl">{healthIndicator.emoji}</span>
          <span className="font-medium">Overall Score</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-3xl font-bold gradient-text" data-testid={`${testId}-value`}>
            {score.toFixed(1)}
          </span>
          <span className={`text-sm ${healthIndicator.color}`}>
            {healthIndicator.label}
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-400">
        {description || defaultDescription}
      </p>
    </div>
  );
}
