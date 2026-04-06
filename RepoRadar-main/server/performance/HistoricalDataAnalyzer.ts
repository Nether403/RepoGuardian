import { PerformanceMetrics, IMetricsCollector } from './interfaces.js';

/**
 * Historical performance data analysis service
 * Provides trend analysis and performance insights
 */
export class HistoricalDataAnalyzer {
  private collector: IMetricsCollector;

  constructor(collector: IMetricsCollector) {
    this.collector = collector;
  }

  /**
   * Analyze performance trends over time
   */
  async analyzeTrends(
    category: PerformanceMetrics['category'],
    metric: string,
    days: number = 7
  ): Promise<{
    trend: 'improving' | 'stable' | 'degrading';
    changePercent: number;
    confidence: number;
    dataPoints: Array<{ timestamp: string; value: number }>;
  }> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (days * 24 * 60 * 60 * 1000));
    
    const metrics = await this.collector.getMetrics(category, startTime, endTime);
    const filteredMetrics = metrics.filter(m => m.metric === metric);
    
    if (filteredMetrics.length < 2) {
      return {
        trend: 'stable',
        changePercent: 0,
        confidence: 0,
        dataPoints: []
      };
    }

    // Calculate trend using linear regression
    const dataPoints = filteredMetrics.map(m => ({
      timestamp: m.timestamp.toISOString(),
      value: m.value
    }));

    const { slope, confidence } = this.calculateLinearRegression(
      filteredMetrics.map((_, i) => i),
      filteredMetrics.map(m => m.value)
    );

    const changePercent = (slope / filteredMetrics[0].value) * 100;
    
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (Math.abs(changePercent) > 5) {
      trend = changePercent < 0 ? 'improving' : 'degrading';
    }

    return {
      trend,
      changePercent,
      confidence,
      dataPoints
    };
  }

  /**
   * Get performance percentiles for a metric
   */
  async getPercentiles(
    category: PerformanceMetrics['category'],
    metric: string,
    hours: number = 24
  ): Promise<{
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    count: number;
  }> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    
    const metrics = await this.collector.getMetrics(category, startTime, endTime);
    const values = metrics
      .filter(m => m.metric === metric)
      .map(m => m.value)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return {
        p50: 0, p90: 0, p95: 0, p99: 0,
        min: 0, max: 0, count: 0
      };
    }

    return {
      p50: this.getPercentile(values, 50),
      p90: this.getPercentile(values, 90),
      p95: this.getPercentile(values, 95),
      p99: this.getPercentile(values, 99),
      min: values[0],
      max: values[values.length - 1],
      count: values.length
    };
  }

  /**
   * Detect performance anomalies
   */
  async detectAnomalies(
    category: PerformanceMetrics['category'],
    metric: string,
    hours: number = 24
  ): Promise<Array<{
    timestamp: string;
    value: number;
    severity: 'low' | 'medium' | 'high';
    reason: string;
  }>> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    
    const metrics = await this.collector.getMetrics(category, startTime, endTime);
    const filteredMetrics = metrics.filter(m => m.metric === metric);
    
    if (filteredMetrics.length < 10) {
      return [];
    }

    const values = filteredMetrics.map(m => m.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );

    const anomalies = [];
    
    for (const metric of filteredMetrics) {
      const zScore = Math.abs((metric.value - mean) / stdDev);
      
      if (zScore > 3) {
        anomalies.push({
          timestamp: metric.timestamp.toISOString(),
          value: metric.value,
          severity: 'high' as const,
          reason: `Value ${metric.value} is ${zScore.toFixed(2)} standard deviations from mean`
        });
      } else if (zScore > 2) {
        anomalies.push({
          timestamp: metric.timestamp.toISOString(),
          value: metric.value,
          severity: 'medium' as const,
          reason: `Value ${metric.value} is ${zScore.toFixed(2)} standard deviations from mean`
        });
      }
    }

    return anomalies;
  }

  private calculateLinearRegression(x: number[], y: number[]): { slope: number; confidence: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Simple confidence calculation based on data points
    const confidence = Math.min(n / 10, 1);

    return { slope, confidence };
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
}
