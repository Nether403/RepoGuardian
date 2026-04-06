/**
 * Gemini API Request Queue
 * 
 * Implements a queue system to respect Google's Gemini API rate limits
 * by spacing out requests automatically.
 * 
 * This is especially useful for free tier API keys which have strict limits:
 * - 2 requests per minute
 * - 50 requests per day
 */

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timestamp: number;
}

class GeminiRequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private dailyResetTime = Date.now() + 24 * 60 * 60 * 1000;

  // Configuration based on Google's free tier limits
  private readonly MIN_REQUEST_INTERVAL = 30000; // 30 seconds between requests (safe for 2 RPM)
  private readonly MAX_DAILY_REQUESTS = 45; // Conservative limit (Google allows 50)

  constructor() {
    // Reset daily counter at midnight
    setInterval(() => {
      const now = Date.now();
      if (now >= this.dailyResetTime) {
        this.requestCount = 0;
        this.dailyResetTime = now + 24 * 60 * 60 * 1000;
        console.log('[Gemini Queue] Daily request counter reset');
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  /**
   * Add a request to the queue
   */
  async enqueue<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Check daily limit
      if (this.requestCount >= this.MAX_DAILY_REQUESTS) {
        const resetIn = Math.ceil((this.dailyResetTime - Date.now()) / 1000 / 60);
        console.error(`[Gemini Queue] Daily limit reached (${this.MAX_DAILY_REQUESTS}). Resets in ${resetIn} minutes.`);
        
        // Reject all pending requests
        while (this.queue.length > 0) {
          const request = this.queue.shift()!;
          request.reject(new Error(`Daily Gemini API limit reached. Please try again in ${resetIn} minutes.`));
        }
        break;
      }

      // Wait if needed to respect rate limit
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        console.log(`[Gemini Queue] Waiting ${Math.ceil(waitTime / 1000)}s before next request (${this.queue.length} in queue)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Process next request
      const request = this.queue.shift()!;
      
      try {
        console.log(`[Gemini Queue] Processing request (${this.requestCount + 1}/${this.MAX_DAILY_REQUESTS} today, ${this.queue.length} remaining in queue)`);
        const result = await request.execute();
        this.lastRequestTime = Date.now();
        this.requestCount++;
        request.resolve(result);
      } catch (error) {
        console.error('[Gemini Queue] Request failed:', error);
        request.reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      requestsToday: this.requestCount,
      dailyLimit: this.MAX_DAILY_REQUESTS,
      remainingToday: Math.max(0, this.MAX_DAILY_REQUESTS - this.requestCount),
      dailyResetIn: Math.ceil((this.dailyResetTime - Date.now()) / 1000 / 60), // minutes
    };
  }

  /**
   * Clear the queue (useful for testing)
   */
  clear() {
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      request.reject(new Error('Queue cleared'));
    }
    this.processing = false;
  }
}

// Singleton instance
export const geminiQueue = new GeminiRequestQueue();

/**
 * Wrap a Gemini API call with automatic queuing
 */
export async function queueGeminiRequest<T>(execute: () => Promise<T>): Promise<T> {
  // Check if queuing is enabled
  const useQueue = process.env.GEMINI_USE_QUEUE !== 'false';
  
  if (!useQueue) {
    // Direct execution without queuing
    return execute();
  }

  // Queue the request
  return geminiQueue.enqueue(execute);
}
