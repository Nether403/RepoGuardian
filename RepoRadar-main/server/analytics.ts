import { db } from './db';
import { analyticsEvents, type InsertAnalyticsEvent } from '../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Analytics Event Model with validation and anonymization
 */
export class AnalyticsEventModel {
  id?: string;
  eventName: string;
  eventCategory: string;
  properties: Record<string, any>;
  userId?: string;
  sessionId: string;
  timestamp: Date;

  constructor(data: {
    eventName: string;
    eventCategory: string;
    properties?: Record<string, any>;
    userId?: string;
    sessionId: string;
    timestamp?: Date;
  }) {
    this.eventName = data.eventName;
    this.eventCategory = data.eventCategory;
    this.properties = data.properties || {};
    this.userId = data.userId;
    this.sessionId = data.sessionId;
    this.timestamp = data.timestamp || new Date();
  }

  /**
   * Validate the analytics event
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.eventName || this.eventName.trim().length === 0) {
      errors.push('Event name is required');
    }

    if (this.eventName && this.eventName.length > 255) {
      errors.push('Event name must be 255 characters or less');
    }

    if (!this.eventCategory || this.eventCategory.trim().length === 0) {
      errors.push('Event category is required');
    }

    if (this.eventCategory && this.eventCategory.length > 100) {
      errors.push('Event category must be 100 characters or less');
    }

    if (!this.sessionId || this.sessionId.trim().length === 0) {
      errors.push('Session ID is required');
    }

    if (this.sessionId && this.sessionId.length > 255) {
      errors.push('Session ID must be 255 characters or less');
    }

    if (this.userId && this.userId.length > 255) {
      errors.push('User ID must be 255 characters or less');
    }

    if (!(this.timestamp instanceof Date) || isNaN(this.timestamp.getTime())) {
      errors.push('Timestamp must be a valid date');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Anonymize the event by removing personally identifiable information
   */
  anonymize(): AnalyticsEventModel {
    const anonymized = new AnalyticsEventModel({
      eventName: this.eventName,
      eventCategory: this.eventCategory,
      properties: this.anonymizeProperties(this.properties),
      sessionId: this.hashValue(this.sessionId),
      timestamp: this.timestamp,
    });

    // Don't include userId in anonymized version
    return anonymized;
  }

  /**
   * Anonymize properties by removing or hashing sensitive data
   */
  private anonymizeProperties(properties: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['email', 'name', 'username', 'ip', 'address', 'phone'];
    const anonymized: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      const lowerKey = key.toLowerCase();
      
      // Remove sensitive keys
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        continue;
      }

      // Recursively anonymize nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        anonymized[key] = this.anonymizeProperties(value);
      } else {
        anonymized[key] = value;
      }
    }

    return anonymized;
  }

  /**
   * Simple hash function for anonymization
   */
  private hashValue(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `anon_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Convert to database insert format
   */
  toInsert(): InsertAnalyticsEvent {
    return {
      eventName: this.eventName,
      eventCategory: this.eventCategory,
      properties: this.properties,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Analytics Service Options
 */
interface AnalyticsServiceOptions {
  batchSize?: number;
  batchInterval?: number;
  enableAnonymization?: boolean;
}

/**
 * Analytics Service for tracking user behavior and events
 */
export class AnalyticsService {
  private eventQueue: AnalyticsEventModel[] = [];
  private batchSize: number;
  private batchInterval: number;
  private batchTimer: NodeJS.Timeout | null = null;
  private enableAnonymization: boolean;

  constructor(options: AnalyticsServiceOptions = {}) {
    this.batchSize = options.batchSize || 50;
    this.batchInterval = options.batchInterval || 5000; // 5 seconds
    this.enableAnonymization = options.enableAnonymization ?? true;
    this.startBatchProcessor();
  }

  /**
   * Track an analytics event
   */
  async trackEvent(event: {
    name: string;
    category: string;
    properties?: Record<string, any>;
    userId?: string;
    sessionId: string;
  }): Promise<void> {
    // Check if session has opted out
    if (await this.hasOptedOut(event.sessionId)) {
      return;
    }

    const analyticsEvent = new AnalyticsEventModel({
      eventName: event.name,
      eventCategory: event.category,
      properties: event.properties,
      userId: event.userId,
      sessionId: event.sessionId,
    });

    // Validate event
    const validation = analyticsEvent.validate();
    if (!validation.valid) {
      console.error('Invalid analytics event:', validation.errors);
      throw new Error(`Invalid analytics event: ${validation.errors.join(', ')}`);
    }

    // Anonymize if enabled
    const eventToQueue = this.enableAnonymization 
      ? analyticsEvent.anonymize() 
      : analyticsEvent;

    // Add to queue
    this.eventQueue.push(eventToQueue);

    // Process immediately if batch size reached
    if (this.eventQueue.length >= this.batchSize) {
      await this.processBatch();
    }
  }

  /**
   * Track an error event
   */
  async trackError(error: Error, context: Record<string, any>): Promise<void> {
    await this.trackEvent({
      name: 'error_occurred',
      category: 'error',
      properties: {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines only
        ...context,
      },
      sessionId: context.sessionId || 'unknown',
      userId: context.userId,
    });
  }

  /**
   * Track a page view event
   */
  async trackPageView(page: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      name: 'page_view',
      category: 'navigation',
      properties: {
        page,
        ...metadata,
      },
      sessionId: metadata?.sessionId || 'unknown',
      userId: metadata?.userId,
    });
  }

  /**
   * Opt out a session from analytics tracking
   */
  async optOut(sessionId: string): Promise<void> {
    try {
      const { redisManager } = await import('./redis');
      if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
        const client = await redisManager.getClient();
        await client.set(`analytics:optout:${sessionId}`, '1', {
          EX: 60 * 60 * 24 * 365, // 1 year
        });
      }
    } catch (error) {
      console.error('Error setting opt-out preference:', error);
    }
  }

  /**
   * Opt in a session to analytics tracking
   */
  async optIn(sessionId: string): Promise<void> {
    try {
      const { redisManager } = await import('./redis');
      if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
        const client = await redisManager.getClient();
        await client.del(`analytics:optout:${sessionId}`);
      }
    } catch (error) {
      console.error('Error removing opt-out preference:', error);
    }
  }

  /**
   * Check if a session has opted out
   */
  async hasOptedOut(sessionId: string): Promise<boolean> {
    try {
      const { redisManager } = await import('./redis');
      if (redisManager.isRedisEnabled() && redisManager.isConnected()) {
        const client = await redisManager.getClient();
        const result = await client.get(`analytics:optout:${sessionId}`);
        return result === '1';
      }
      return false;
    } catch (error) {
      console.error('Error checking opt-out preference:', error);
      return false;
    }
  }

  /**
   * Start the batch processor
   */
  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.processBatch().catch(error => {
          console.error('Error processing analytics batch:', error);
        });
      }
    }, this.batchInterval);
  }

  /**
   * Process the current batch of events
   */
  private async processBatch(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    // Get events to process
    const eventsToProcess = this.eventQueue.splice(0, this.batchSize);

    try {
      // Insert events in batch
      const insertData = eventsToProcess.map(event => event.toInsert());
      await db.insert(analyticsEvents).values(insertData);
      
      console.log(`Processed ${eventsToProcess.length} analytics events`);
    } catch (error) {
      console.error('Error inserting analytics events:', error);
      // Re-queue failed events (at the front)
      this.eventQueue.unshift(...eventsToProcess);
      throw error;
    }
  }

  /**
   * Flush all pending events immediately
   */
  async flush(): Promise<void> {
    while (this.eventQueue.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Stop the batch processor and flush remaining events
   */
  async shutdown(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    await this.flush();
  }

  /**
   * Get analytics metrics for a time period
   */
  async getMetrics(options: {
    startDate: Date;
    endDate: Date;
    category?: string;
  }): Promise<{
    totalEvents: number;
    eventsByCategory: Record<string, number>;
    eventsByName: Record<string, number>;
  }> {
    const { startDate, endDate, category } = options;

    // Build query
    let query = db
      .select({
        eventName: analyticsEvents.eventName,
        eventCategory: analyticsEvents.eventCategory,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        sql`${analyticsEvents.timestamp} >= ${startDate} AND ${analyticsEvents.timestamp} <= ${endDate}`
      );

    if (category) {
      query = query.where(sql`${analyticsEvents.eventCategory} = ${category}`);
    }

    const results = await query
      .groupBy(analyticsEvents.eventName, analyticsEvents.eventCategory)
      .execute();

    // Aggregate results
    const eventsByCategory: Record<string, number> = {};
    const eventsByName: Record<string, number> = {};
    let totalEvents = 0;

    for (const row of results) {
      const count = Number(row.count);
      totalEvents += count;
      eventsByCategory[row.eventCategory] = (eventsByCategory[row.eventCategory] || 0) + count;
      eventsByName[row.eventName] = (eventsByName[row.eventName] || 0) + count;
    }

    return {
      totalEvents,
      eventsByCategory,
      eventsByName,
    };
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
