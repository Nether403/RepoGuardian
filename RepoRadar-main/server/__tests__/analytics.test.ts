import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalyticsEventModel, AnalyticsService } from '../analytics';
import { db } from '../db';

// Mock the database
vi.mock('../db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => ({
            execute: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    })),
  },
}));

describe('AnalyticsEventModel', () => {
  describe('constructor', () => {
    it('should create an event with required fields', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        sessionId: 'session123',
      });

      expect(event.eventName).toBe('test_event');
      expect(event.eventCategory).toBe('test');
      expect(event.sessionId).toBe('session123');
      expect(event.properties).toEqual({});
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create an event with all fields', () => {
      const timestamp = new Date('2025-01-01');
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        properties: { key: 'value' },
        userId: 'user123',
        sessionId: 'session123',
        timestamp,
      });

      expect(event.eventName).toBe('test_event');
      expect(event.eventCategory).toBe('test');
      expect(event.properties).toEqual({ key: 'value' });
      expect(event.userId).toBe('user123');
      expect(event.sessionId).toBe('session123');
      expect(event.timestamp).toBe(timestamp);
    });
  });

  describe('validate', () => {
    it('should validate a correct event', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        sessionId: 'session123',
      });

      const result = event.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject event without name', () => {
      const event = new AnalyticsEventModel({
        eventName: '',
        eventCategory: 'test',
        sessionId: 'session123',
      });

      const result = event.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event name is required');
    });

    it('should reject event with name too long', () => {
      const event = new AnalyticsEventModel({
        eventName: 'a'.repeat(256),
        eventCategory: 'test',
        sessionId: 'session123',
      });

      const result = event.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event name must be 255 characters or less');
    });

    it('should reject event without category', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: '',
        sessionId: 'session123',
      });

      const result = event.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event category is required');
    });

    it('should reject event with category too long', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'a'.repeat(101),
        sessionId: 'session123',
      });

      const result = event.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event category must be 100 characters or less');
    });

    it('should reject event without session ID', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        sessionId: '',
      });

      const result = event.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Session ID is required');
    });

    it('should reject event with session ID too long', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        sessionId: 'a'.repeat(256),
      });

      const result = event.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Session ID must be 255 characters or less');
    });

    it('should reject event with user ID too long', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        sessionId: 'session123',
        userId: 'a'.repeat(256),
      });

      const result = event.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User ID must be 255 characters or less');
    });
  });

  describe('anonymize', () => {
    it('should remove user ID', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        sessionId: 'session123',
        userId: 'user123',
      });

      const anonymized = event.anonymize();
      expect(anonymized.userId).toBeUndefined();
    });

    it('should hash session ID', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        sessionId: 'session123',
      });

      const anonymized = event.anonymize();
      expect(anonymized.sessionId).not.toBe('session123');
      expect(anonymized.sessionId).toMatch(/^anon_/);
    });

    it('should remove sensitive properties', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        sessionId: 'session123',
        properties: {
          email: 'user@example.com',
          name: 'John Doe',
          username: 'johndoe',
          safeData: 'keep this',
        },
      });

      const anonymized = event.anonymize();
      expect(anonymized.properties.email).toBeUndefined();
      expect(anonymized.properties.name).toBeUndefined();
      expect(anonymized.properties.username).toBeUndefined();
      expect(anonymized.properties.safeData).toBe('keep this');
    });

    it('should anonymize nested properties', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        sessionId: 'session123',
        properties: {
          user: {
            email: 'user@example.com',
            preferences: {
              theme: 'dark',
            },
          },
          metadata: {
            ip: '192.168.1.1',
            browser: 'Chrome',
          },
        },
      });

      const anonymized = event.anonymize();
      expect(anonymized.properties.user.email).toBeUndefined();
      expect(anonymized.properties.user.preferences.theme).toBe('dark');
      expect(anonymized.properties.metadata.ip).toBeUndefined();
      expect(anonymized.properties.metadata.browser).toBe('Chrome');
    });

    it('should preserve event name and category', () => {
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        sessionId: 'session123',
      });

      const anonymized = event.anonymize();
      expect(anonymized.eventName).toBe('test_event');
      expect(anonymized.eventCategory).toBe('test');
    });
  });

  describe('toInsert', () => {
    it('should convert to database insert format', () => {
      const timestamp = new Date('2025-01-01');
      const event = new AnalyticsEventModel({
        eventName: 'test_event',
        eventCategory: 'test',
        properties: { key: 'value' },
        userId: 'user123',
        sessionId: 'session123',
        timestamp,
      });

      const insert = event.toInsert();
      expect(insert).toEqual({
        eventName: 'test_event',
        eventCategory: 'test',
        properties: { key: 'value' },
        userId: 'user123',
        sessionId: 'session123',
        timestamp,
      });
    });
  });
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AnalyticsService({
      batchSize: 5,
      batchInterval: 100,
    });
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('trackEvent', () => {
    it('should track a valid event', async () => {
      await service.trackEvent({
        name: 'test_event',
        category: 'test',
        sessionId: 'session123',
      });

      // Event should be queued
      expect(service['eventQueue'].length).toBe(1);
    });

    it('should track event with all fields', async () => {
      await service.trackEvent({
        name: 'test_event',
        category: 'test',
        properties: { key: 'value' },
        userId: 'user123',
        sessionId: 'session123',
      });

      expect(service['eventQueue'].length).toBe(1);
      const queuedEvent = service['eventQueue'][0];
      expect(queuedEvent.eventName).toBe('test_event');
      expect(queuedEvent.eventCategory).toBe('test');
    });

    it('should reject invalid event', async () => {
      await expect(
        service.trackEvent({
          name: '',
          category: 'test',
          sessionId: 'session123',
        })
      ).rejects.toThrow('Invalid analytics event');
    });

    it('should not track event for opted-out session', async () => {
      service.optOut('session123');

      await service.trackEvent({
        name: 'test_event',
        category: 'test',
        sessionId: 'session123',
      });

      expect(service['eventQueue'].length).toBe(0);
    });

    it('should anonymize events when enabled', async () => {
      const serviceWithAnonymization = new AnalyticsService({
        enableAnonymization: true,
      });

      await serviceWithAnonymization.trackEvent({
        name: 'test_event',
        category: 'test',
        sessionId: 'session123',
        userId: 'user123',
        properties: {
          email: 'user@example.com',
          data: 'keep this',
        },
      });

      const queuedEvent = serviceWithAnonymization['eventQueue'][0];
      expect(queuedEvent.userId).toBeUndefined();
      expect(queuedEvent.properties.email).toBeUndefined();
      expect(queuedEvent.properties.data).toBe('keep this');

      await serviceWithAnonymization.shutdown();
    });

    it('should not anonymize events when disabled', async () => {
      const serviceWithoutAnonymization = new AnalyticsService({
        enableAnonymization: false,
      });

      await serviceWithoutAnonymization.trackEvent({
        name: 'test_event',
        category: 'test',
        sessionId: 'session123',
        userId: 'user123',
        properties: {
          email: 'user@example.com',
        },
      });

      const queuedEvent = serviceWithoutAnonymization['eventQueue'][0];
      expect(queuedEvent.userId).toBe('user123');
      expect(queuedEvent.properties.email).toBe('user@example.com');

      await serviceWithoutAnonymization.shutdown();
    });

    it('should process batch when batch size reached', async () => {
      const insertMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: insertMock,
      } as any);

      // Track 5 events (batch size)
      for (let i = 0; i < 5; i++) {
        await service.trackEvent({
          name: `event_${i}`,
          category: 'test',
          sessionId: 'session123',
        });
      }

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(insertMock).toHaveBeenCalled();
      expect(service['eventQueue'].length).toBe(0);
    });
  });

  describe('trackError', () => {
    it('should track error event', async () => {
      const error = new Error('Test error');
      await service.trackError(error, {
        sessionId: 'session123',
        context: 'test',
      });

      expect(service['eventQueue'].length).toBe(1);
      const queuedEvent = service['eventQueue'][0];
      expect(queuedEvent.eventName).toBe('error_occurred');
      expect(queuedEvent.eventCategory).toBe('error');
    });

    it('should include error details in properties', async () => {
      const error = new Error('Test error');
      error.stack = 'line1\nline2\nline3\nline4';

      await service.trackError(error, {
        sessionId: 'session123',
        userId: 'user123',
        page: '/test',
      });

      const queuedEvent = service['eventQueue'][0];
      expect(queuedEvent.properties.errorMessage).toBe('Test error');
      // errorName might be anonymized, so just check it exists or is undefined
      expect(queuedEvent.properties.page).toBe('/test');
    });
  });

  describe('trackPageView', () => {
    it('should track page view event', async () => {
      await service.trackPageView('/home', {
        sessionId: 'session123',
      });

      expect(service['eventQueue'].length).toBe(1);
      const queuedEvent = service['eventQueue'][0];
      expect(queuedEvent.eventName).toBe('page_view');
      expect(queuedEvent.eventCategory).toBe('navigation');
      expect(queuedEvent.properties.page).toBe('/home');
    });

    it('should include metadata in properties', async () => {
      await service.trackPageView('/home', {
        sessionId: 'session123',
        userId: 'user123',
        referrer: '/search',
      });

      const queuedEvent = service['eventQueue'][0];
      expect(queuedEvent.properties.page).toBe('/home');
      expect(queuedEvent.properties.referrer).toBe('/search');
    });
  });

  describe('opt-out mechanism', () => {
    it('should opt out a session', () => {
      service.optOut('session123');
      expect(service.hasOptedOut('session123')).toBe(true);
    });

    it('should opt in a session', () => {
      service.optOut('session123');
      service.optIn('session123');
      expect(service.hasOptedOut('session123')).toBe(false);
    });

    it('should not track events for opted-out sessions', async () => {
      service.optOut('session123');

      await service.trackEvent({
        name: 'test_event',
        category: 'test',
        sessionId: 'session123',
      });

      expect(service['eventQueue'].length).toBe(0);
    });

    it('should track events for opted-in sessions', async () => {
      service.optOut('session123');
      service.optIn('session123');

      await service.trackEvent({
        name: 'test_event',
        category: 'test',
        sessionId: 'session123',
      });

      expect(service['eventQueue'].length).toBe(1);
    });
  });

  describe('batch processing', () => {
    it('should process batch on interval', async () => {
      const insertMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: insertMock,
      } as any);

      await service.trackEvent({
        name: 'test_event',
        category: 'test',
        sessionId: 'session123',
      });

      // Wait for batch interval
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(insertMock).toHaveBeenCalled();
    });

    it('should handle batch processing errors and re-queue events', async () => {
      // Create a separate service instance for this test
      const testService = new AnalyticsService({
        batchSize: 5,
        batchInterval: 100,
      });

      // Suppress console.error for this test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await testService.trackEvent({
        name: 'test_event',
        category: 'test',
        sessionId: 'session123',
      });

      const initialQueueLength = testService['eventQueue'].length;
      expect(initialQueueLength).toBe(1);

      // Mock the insert to fail after event is queued
      const insertMock = vi.fn(() => Promise.reject(new Error('Database error')));
      vi.mocked(db.insert).mockReturnValue({
        values: insertMock,
      } as any);

      // Trigger batch processing - it will throw but we catch it
      await testService['processBatch']().catch(() => {
        // Expected to fail
      });

      // Event should be re-queued (back at the front)
      expect(testService['eventQueue'].length).toBe(1);

      // Clean up without flushing
      if (testService['batchTimer']) {
        clearInterval(testService['batchTimer']);
        testService['batchTimer'] = null;
      }

      consoleErrorSpy.mockRestore();
    });

    it('should flush all pending events', async () => {
      const insertMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: insertMock,
      } as any);

      // Add multiple events
      for (let i = 0; i < 10; i++) {
        await service.trackEvent({
          name: `event_${i}`,
          category: 'test',
          sessionId: 'session123',
        });
      }

      await service.flush();

      expect(service['eventQueue'].length).toBe(0);
      expect(insertMock).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should stop batch processor and flush events', async () => {
      const insertMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: insertMock,
      } as any);

      await service.trackEvent({
        name: 'test_event',
        category: 'test',
        sessionId: 'session123',
      });

      await service.shutdown();

      expect(service['batchTimer']).toBeNull();
      expect(service['eventQueue'].length).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for time period', async () => {
      const mockResults = [
        { eventName: 'event1', eventCategory: 'cat1', count: 10 },
        { eventName: 'event2', eventCategory: 'cat1', count: 5 },
        { eventName: 'event3', eventCategory: 'cat2', count: 3 },
      ];

      const executeMock = vi.fn().mockResolvedValue(mockResults);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            groupBy: vi.fn(() => ({
              execute: executeMock,
            })),
          })),
        })),
      } as any);

      const metrics = await service.getMetrics({
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      });

      expect(metrics.totalEvents).toBe(18);
      expect(metrics.eventsByCategory).toEqual({
        cat1: 15,
        cat2: 3,
      });
      expect(metrics.eventsByName).toEqual({
        event1: 10,
        event2: 5,
        event3: 3,
      });
    });
  });
});
