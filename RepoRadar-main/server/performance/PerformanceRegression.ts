export interface PerformanceBaseline {
  name: string;
  responseTime: number;
  throughput: number;
  memoryUsage: number;
  timestamp: Date;
}

export interface RegressionResult {
  metric: string;
  baseline: number;
  current: number;
  change: number;
  changePercentage: number;
  isRegression: boolean;
  severity: 'low' | 'medium' | 'high';
}

export class PerformanceRegressionDetector {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private thresholds = {
    responseTime: 1.5, // 50% slower is regression
    throughput: 0.7,   // 30% decrease is regression
    memoryUsage: 1.3   // 30% increase is regression
  };

  setBaseline(name: string, baseline: PerformanceBaseline): void {
    this.baselines.set(name, baseline);
  }

  getBaseline(name: string): PerformanceBaseline | undefined {
    return this.baselines.get(name);
  }

  detectRegression(
    name: string,
    current: Omit<PerformanceBaseline, 'name' | 'timestamp'>
  ): RegressionResult[] {
    const baseline = this.baselines.get(name);
    if (!baseline) {
      throw new Error(`No baseline found for ${name}`);
    }

    const results: RegressionResult[] = [];

    // Check response time regression
    const responseTimeChange = current.responseTime / baseline.responseTime;
    results.push({
      metric: 'responseTime',
      baseline: baseline.responseTime,
      current: current.responseTime,
      change: current.responseTime - baseline.responseTime,
      changePercentage: (responseTimeChange - 1) * 100,
      isRegression: responseTimeChange > this.thresholds.responseTime,
      severity: this.getSeverity(responseTimeChange, this.thresholds.responseTime, 'higher')
    });

    // Check throughput regression
    const throughputChange = current.throughput / baseline.throughput;
    results.push({
      metric: 'throughput',
      baseline: baseline.throughput,
      current: current.throughput,
      change: current.throughput - baseline.throughput,
      changePercentage: (throughputChange - 1) * 100,
      isRegression: throughputChange < this.thresholds.throughput,
      severity: this.getSeverity(throughputChange, this.thresholds.throughput, 'lower')
    });

    // Check memory usage regression
    const memoryChange = current.memoryUsage / baseline.memoryUsage;
    results.push({
      metric: 'memoryUsage',
      baseline: baseline.memoryUsage,
      current: current.memoryUsage,
      change: current.memoryUsage - baseline.memoryUsage,
      changePercentage: (memoryChange - 1) * 100,
      isRegression: memoryChange > this.thresholds.memoryUsage,
      severity: this.getSeverity(memoryChange, this.thresholds.memoryUsage, 'higher')
    });

    return results;
  }

  private getSeverity(
    ratio: number,
    threshold: number,
    direction: 'higher' | 'lower'
  ): 'low' | 'medium' | 'high' {
    if (direction === 'higher') {
      if (ratio > threshold * 2) return 'high';
      if (ratio > threshold * 1.5) return 'medium';
      return 'low';
    } else {
      if (ratio < threshold * 0.5) return 'high';
      if (ratio < threshold * 0.75) return 'medium';
      return 'low';
    }
  }

  generateReport(results: RegressionResult[]): string {
    const regressions = results.filter(r => r.isRegression);
    
    if (regressions.length === 0) {
      return 'No performance regressions detected.';
    }

    let report = `Performance Regression Report (${new Date().toISOString()})\n`;
    report += '='.repeat(60) + '\n\n';

    regressions.forEach(regression => {
      report += `${regression.metric.toUpperCase()} REGRESSION (${regression.severity.toUpperCase()})\n`;
      report += `  Baseline: ${regression.baseline.toFixed(2)}\n`;
      report += `  Current:  ${regression.current.toFixed(2)}\n`;
      report += `  Change:   ${regression.changePercentage > 0 ? '+' : ''}${regression.changePercentage.toFixed(1)}%\n\n`;
    });

    return report;
  }

  setThresholds(thresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  exportBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values());
  }

  importBaselines(baselines: PerformanceBaseline[]): void {
    baselines.forEach(baseline => {
      this.baselines.set(baseline.name, baseline);
    });
  }

  clearBaselines(): void {
    this.baselines.clear();
  }
}