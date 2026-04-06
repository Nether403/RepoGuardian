/**
 * Error handling utilities for the intelligent profile feature
 */

export interface ApiError {
  error: string;
  message: string;
  field?: string;
  currentTier?: string;
  requiredTier?: string;
  upgradeUrl?: string;
  retryable?: boolean;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly field?: string;

  constructor(
    message: string,
    code: string = "UNKNOWN_ERROR",
    statusCode?: number,
    retryable: boolean = false,
    field?: string
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.field = field;
  }
}

export class TierRestrictionError extends AppError {
  public readonly currentTier: string;
  public readonly requiredTier: string;
  public readonly upgradeUrl: string;

  constructor(
    message: string,
    currentTier: string,
    requiredTier: string,
    upgradeUrl: string = "/pricing"
  ) {
    super(message, "TIER_RESTRICTION", 403, false);
    this.name = "TierRestrictionError";
    this.currentTier = currentTier;
    this.requiredTier = requiredTier;
    this.upgradeUrl = upgradeUrl;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR", 400, false, field);
    this.name = "ValidationError";
  }
}

export class NetworkError extends AppError {
  constructor(message: string = "Network request failed") {
    super(message, "NETWORK_ERROR", undefined, true);
    this.name = "NetworkError";
  }
}

/**
 * Parse API error response
 */
export function parseApiError(error: any): AppError {
  // Handle Response objects
  if (error instanceof Response) {
    const statusCode = error.status;
    
    if (statusCode === 403) {
      return new TierRestrictionError(
        "This feature is not available on your current plan",
        "free",
        "pro"
      );
    }
    
    if (statusCode === 400) {
      return new ValidationError("Invalid request data");
    }
    
    if (statusCode >= 500) {
      return new AppError(
        "Server error occurred",
        "SERVER_ERROR",
        statusCode,
        true
      );
    }
    
    return new AppError(
      error.statusText || "Request failed",
      "API_ERROR",
      statusCode,
      statusCode >= 500
    );
  }
  
  // Handle Error objects with message
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Check for tier restriction
    if (message.includes("403") || message.includes("feature_not_available")) {
      return new TierRestrictionError(
        error.message,
        "free",
        "pro"
      );
    }
    
    // Check for validation errors
    if (message.includes("validation") || message.includes("invalid")) {
      return new ValidationError(error.message);
    }
    
    // Check for network errors
    if (message.includes("network") || message.includes("fetch")) {
      return new NetworkError(error.message);
    }
    
    return new AppError(error.message, "UNKNOWN_ERROR", undefined, false);
  }
  
  // Handle plain objects
  if (typeof error === "object" && error !== null) {
    const apiError = error as ApiError;
    
    if (apiError.error === "FEATURE_NOT_AVAILABLE") {
      return new TierRestrictionError(
        apiError.message,
        apiError.currentTier || "free",
        apiError.requiredTier || "pro",
        apiError.upgradeUrl
      );
    }
    
    if (apiError.field) {
      return new ValidationError(apiError.message, apiError.field);
    }
    
    return new AppError(
      apiError.message || "An error occurred",
      apiError.error || "UNKNOWN_ERROR",
      undefined,
      apiError.retryable || false
    );
  }
  
  // Fallback
  return new AppError(
    String(error) || "An unexpected error occurred",
    "UNKNOWN_ERROR"
  );
}

/**
 * Exponential backoff retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Calculate delay for exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  shouldRetry?: (error: any) => boolean
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const parsedError = parseApiError(error);
      const canRetry = shouldRetry ? shouldRetry(error) : parsedError.retryable;
      
      // Don't retry if not retryable or if we've exhausted retries
      if (!canRetry || attempt === config.maxRetries) {
        throw parsedError;
      }
      
      // Wait before retrying
      const delay = calculateBackoffDelay(attempt, config);
      await sleep(delay);
    }
  }
  
  throw parseApiError(lastError);
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: any): string {
  const parsedError = parseApiError(error);
  
  if (parsedError instanceof TierRestrictionError) {
    return `This feature requires a ${parsedError.requiredTier} plan. Upgrade to unlock it.`;
  }
  
  if (parsedError instanceof ValidationError) {
    return parsedError.message;
  }
  
  if (parsedError instanceof NetworkError) {
    return "Network connection failed. Please check your internet connection and try again.";
  }
  
  if (parsedError.statusCode && parsedError.statusCode >= 500) {
    return "Server error occurred. Please try again later.";
  }
  
  return parsedError.message || "An unexpected error occurred. Please try again.";
}

/**
 * Check if error is a tier restriction
 */
export function isTierRestrictionError(error: any): boolean {
  const parsedError = parseApiError(error);
  return parsedError instanceof TierRestrictionError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  const parsedError = parseApiError(error);
  return parsedError.retryable;
}
