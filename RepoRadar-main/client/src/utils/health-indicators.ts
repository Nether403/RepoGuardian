export interface HealthIndicator {
  emoji: string;
  label: string;
  color: string;
  description: string;
}

export function getScoreHealthIndicator(score: number): HealthIndicator {
  if (score >= 90) {
    return {
      emoji: '🚀',
      label: 'Excellent',
      color: 'text-green-500',
      description: 'Outstanding performance'
    };
  } else if (score >= 75) {
    return {
      emoji: '✨',
      label: 'Great',
      color: 'text-emerald-500',
      description: 'Above average performance'
    };
  } else if (score >= 60) {
    return {
      emoji: '👍',
      label: 'Good',
      color: 'text-blue-500',
      description: 'Solid performance'
    };
  } else if (score >= 45) {
    return {
      emoji: '⚡',
      label: 'Fair',
      color: 'text-yellow-500',
      description: 'Room for improvement'
    };
  } else if (score >= 30) {
    return {
      emoji: '⚠️',
      label: 'Needs Work',
      color: 'text-orange-500',
      description: 'Significant improvements needed'
    };
  } else {
    return {
      emoji: '🔧',
      label: 'Critical',
      color: 'text-red-500',
      description: 'Major issues to address'
    };
  }
}

export function getMetricHealthIndicator(metricName: string, score: number): string {
  const indicators: Record<string, Record<string, string>> = {
    originality: {
      high: '💎', // Diamond for unique/innovative
      medium: '🌟', // Star for somewhat unique
      low: '📋' // Clipboard for common/standard
    },
    completeness: {
      high: '✅', // Check mark for complete
      medium: '🔨', // Hammer for work in progress
      low: '🏗️' // Construction for early stage
    },
    marketability: {
      high: '💰', // Money bag for high market potential
      medium: '📈', // Chart for growing potential
      low: '📊' // Basic chart for low potential
    },
    monetization: {
      high: '💸', // Money with wings for high revenue potential
      medium: '💵', // Dollar bill for moderate potential
      low: '🪙' // Coin for low potential
    },
    usefulness: {
      high: '🎯', // Target for highly useful
      medium: '🔧', // Wrench for moderately useful
      low: '📦' // Box for limited use
    }
  };

  const metric = indicators[metricName.toLowerCase()];
  if (!metric) {
    return getScoreHealthIndicator(score).emoji;
  }

  if (score >= 70) {
    return metric.high;
  } else if (score >= 40) {
    return metric.medium;
  } else {
    return metric.low;
  }
}

export function getOverallHealth(scores: Record<string, number>): HealthIndicator {
  const avgScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.values(scores).length;
  return getScoreHealthIndicator(avgScore);
}

export function getTrendIndicator(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return '📈';
    case 'down':
      return '📉';
    case 'stable':
      return '➡️';
    default:
      return '➡️';
  }
}

export function getActivityLevel(commits: number, lastUpdate: Date): string {
  const daysSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceUpdate <= 7 && commits > 20) {
    return '🔥'; // Very active
  } else if (daysSinceUpdate <= 30 && commits > 10) {
    return '⚡'; // Active
  } else if (daysSinceUpdate <= 90) {
    return '🌱'; // Moderate activity
  } else if (daysSinceUpdate <= 180) {
    return '🍂'; // Low activity
  } else {
    return '❄️'; // Inactive/dormant
  }
}