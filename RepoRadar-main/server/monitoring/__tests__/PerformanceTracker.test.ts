import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackPerformance,
  trackPerformanceSync,
  PerformanceTimer,
  PerformanceCheckpoint,
} from '../PerformanceTracker';
import { metricsService } from '../MetricsService';

describe('PerformanceTracker', () => {
  beforeEach(() => {
    metricsService.clear();
    vi.clearAllMocks();
  });

  describe('trackPerformance', () => {
    it('should track async function performance', async () => {
      const result = await trackPerformance(
        { name: 'test-operation' },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'success';
        }
      );

      expect(result).toBe('success');
      
      const metric = metricsService.getCustomMetric('test-operation');
      expect(metric).not.toBeNull();
      expect(metric!.count).toBe(1);
      expect(metric!.avg).toBeGreaterThan(0);
    });

    it('should log warning for slow operations', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      await trackPerformance(
        { name: 'slow-operation', threshold: 5 },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      );

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle errors and still track duration', async () => {
      const error = new Error('Test error');

      await expect(
        trackPerformance(
          { name: 'failing-operation' },
          async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            throw error;
          }
        )
      ).rejects.toThrow('Test error');
    });

    it('should not record metric when recordMetric is false', async () => {
      await trackPerformance(
        { name: 'no-metric-operation', recordMetric: false },
        async () => {
          return 'success';
        }
      );

      const metric = metricsService.getCustomMetric('no-metric-operation');
      expect(metric).toBeNull();
    });
  });

  describe('trackPerformanceSync', () => {
    it('should track sync function performance', () => {
      const result = trackPerformanceSync(
        { name: 'sync-operation' },
        () => {
          return 'success';
        }
      );

      expect(result).toBe('success');
      
      const metric = metricsService.getCustomMetric('sync-operation');
      expect(metric).not.toBeNull();
      expect(metric!.count).toBe(1);
    });

    it('should handle errors in sync functions', () => {
      expect(() => {
        trackPerformanceSync(
          { name: 'failing-sync-operation' },
          () => {
            throw new Error('Sync error');
          }
        );
      }).toThrow('Sync error');
    });
  });

  describe('PerformanceTimer', () => {
    it('should measure elapsed time', async () => {
      const timer = new PerformanceTimer({ name: 'timer-test' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const duration = timer.stop();
      
      expect(duration).toBeGreaterThan(0);
      
      const metric = metricsService.getCustomMetric('timer-test');
      expect(metric).not.toBeNull();
      expect(metric!.avg).toBe(duration);
    });

    it('should get elapsed time without stopping', async () => {
      const timer = new PerformanceTimer({ name: 'elapsed-test' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const elapsed = timer.elapsed();
      expect(elapsed).toBeGreaterThan(0);
      
      // Should still be able to stop
      const duration = timer.stop();
      expect(duration).toBeGreaterThanOrEqual(elapsed);
    });

    it('should log warning for slow operations', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      
      const timer = new PerformanceTimer({
        name: 'slow-timer',
        threshold: 5,
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      timer.stop();
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not record metric when recordMetric is false', () => {
      const timer = new PerformanceTimer({
        name: 'no-metric-timer',
        recordMetric: false,
      });
      
      timer.stop();
      
      const metric = metricsService.getCustomMetric('no-metric-timer');
      expect(metric).toBeNull();
    });
  });

  describe('PerformanceCheckpoint', () => {
    it('should track multiple checkpoints', async () => {
      const checkpoint = new PerformanceCheckpoint('multi-step-operation');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      checkpoint.mark('step1');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      checkpoint.mark('step2');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      checkpoint.mark('step3');
      
      const summary = checkpoint.getSummary();
      
      expect(summary['start->step1']).toBeGreaterThan(0);
      expect(summary['step1->step2']).toBeGreaterThan(0);
      expect(summary['step2->step3']).toBeGreaterThan(0);
      expect(summary['total']).toBeGreaterThan(0);
    });

    it('should get duration between checkpoints', async () => {
      const checkpoint = new PerformanceCheckpoint('duration-test');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      checkpoint.mark('checkpoint1');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      checkpoint.mark('checkpoint2');
      
      const duration = checkpoint.getDuration('checkpoint1', 'checkpoint2');
      expect(duration).toBeGreaterThan(0);
    });

    it('should return null for non-existent checkpoints', () => {
      const checkpoint = new PerformanceCheckpoint('missing-test');
      
      const duration = checkpoint.getDuration('missing1', 'missing2');
      expect(duration).toBeNull();
    });

    it('should record metric on complete', () => {
      const checkpoint = new PerformanceCheckpoint('complete-test');
      checkpoint.mark('step1');
      checkpoint.complete();
      
      const metric = metricsService.getCustomMetric('complete-test');
      expect(metric).not.toBeNull();
      expect(metric!.count).toBe(1);
    });
  });

  describe('Integration', () => {
    it('should track multiple operations concurrently', async () => {
      const operations = Array.from({ length: 5 }, (_, i) =>
        trackPerformance(
          { name: 'concurrent-operation' },
          async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return i;
          }
        )
      );

      const results = await Promise.all(operations);
      
      expect(results).toEqual([0, 1, 2, 3, 4]);
      
      const metric = metricsService.getCustomMetric('concurrent-operation');
      expect(metric).not.toBeNull();
      expect(metric!.count).toBe(5);
    });

    it('should track nested operations', async () => {
      await trackPerformance(
        { name: 'outer-operation' },
        async () => {
          await trackPerformance(
            { name: 'inner-operation' },
            async () => {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          );
        }
      );

      const outerMetric = metricsService.getCustomMetric('outer-operation');
      const innerMetric = metricsService.getCustomMetric('inner-operation');
      
      expect(outerMetric).not.toBeNull();
      expect(innerMetric).not.toBeNull();
      expect(outerMetric!.avg).toBeGreaterThanOrEqual(innerMetric!.avg);
    });
  });
});
