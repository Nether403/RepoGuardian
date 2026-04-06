import { describe, it, expect, vi } from "vitest";
import {
  AppError,
  TierRestrictionError,
  ValidationError,
  NetworkError,
  parseApiError,
  calculateBackoffDelay,
  retryWithBackoff,
  getUserFriendlyErrorMessage,
  isTierRestrictionError,
  isRetryableError,
} from "../error-handling";

describe("Error Classes", () => {
  it("should create AppError with correct properties", () => {
    const error = new AppError("Test error", "TEST_CODE", 500, true);
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.statusCode).toBe(500);
    expect(error.retryable).toBe(true);
  });

  it("should create TierRestrictionError", () => {
    const error = new TierRestrictionError("Upgrade required", "free", "pro");
    expect(error.code).toBe("TIER_RESTRICTION");
    expect(error.statusCode).toBe(403);
    expect(error.currentTier).toBe("free");
    expect(error.requiredTier).toBe("pro");
  });

  it("should create ValidationError", () => {
    const error = new ValidationError("Invalid input", "email");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.field).toBe("email");
  });

  it("should create NetworkError", () => {
    const error = new NetworkError();
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.retryable).toBe(true);
  });
});

describe("parseApiError", () => {
  it("should parse 403 Response as TierRestrictionError", () => {
    const response = new Response(null, { status: 403, statusText: "Forbidden" });
    const error = parseApiError(response);
    expect(error).toBeInstanceOf(TierRestrictionError);
  });

  it("should parse 400 Response as ValidationError", () => {
    const response = new Response(null, { status: 400, statusText: "Bad Request" });
    const error = parseApiError(response);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it("should parse 500 Response as retryable AppError", () => {
    const response = new Response(null, { status: 500, statusText: "Server Error" });
    const error = parseApiError(response);
    expect(error.retryable).toBe(true);
    expect(error.statusCode).toBe(500);
  });

  it("should parse Error with 403 message as TierRestrictionError", () => {
    const error = parseApiError(new Error("403: Feature not available"));
    expect(error).toBeInstanceOf(TierRestrictionError);
  });

  it("should parse Error with validation message as ValidationError", () => {
    const error = parseApiError(new Error("Validation failed"));
    expect(error).toBeInstanceOf(ValidationError);
  });

  it("should parse Error with network message as NetworkError", () => {
    const error = parseApiError(new Error("Network request failed"));
    expect(error).toBeInstanceOf(NetworkError);
  });

  it("should parse API error object with FEATURE_NOT_AVAILABLE", () => {
    const apiError = {
      error: "FEATURE_NOT_AVAILABLE",
      message: "Upgrade required",
      currentTier: "free",
      requiredTier: "pro",
    };
    const error = parseApiError(apiError);
    expect(error).toBeInstanceOf(TierRestrictionError);
  });

  it("should parse API error object with field", () => {
    const apiError = {
      error: "VALIDATION_ERROR",
      message: "Invalid email",
      field: "email",
    };
    const error = parseApiError(apiError);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.field).toBe("email");
  });
});

describe("calculateBackoffDelay", () => {
  it("should calculate exponential backoff", () => {
    expect(calculateBackoffDelay(0)).toBe(1000);
    expect(calculateBackoffDelay(1)).toBe(2000);
    expect(calculateBackoffDelay(2)).toBe(4000);
  });

  it("should respect max delay", () => {
    expect(calculateBackoffDelay(10)).toBe(10000); // Should cap at maxDelay
  });

  it("should use custom config", () => {
    const config = {
      maxRetries: 5,
      initialDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 3,
    };
    expect(calculateBackoffDelay(0, config)).toBe(500);
    expect(calculateBackoffDelay(1, config)).toBe(1500);
    expect(calculateBackoffDelay(2, config)).toBe(4500);
  });
});

describe("retryWithBackoff", () => {
  it("should succeed on first try", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValue("success");
    
    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 2,
    });
    
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should not retry on non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(new ValidationError("Invalid"));
    
    await expect(
      retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
      })
    ).rejects.toThrow();
    
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should respect maxRetries", async () => {
    const fn = vi.fn().mockRejectedValue(new NetworkError());
    
    await expect(
      retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
      })
    ).rejects.toThrow();
    
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

describe("getUserFriendlyErrorMessage", () => {
  it("should return friendly message for TierRestrictionError", () => {
    const error = new TierRestrictionError("Upgrade", "free", "pro");
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain("pro plan");
  });

  it("should return friendly message for NetworkError", () => {
    const error = new NetworkError();
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain("Network connection");
  });

  it("should return friendly message for server error", () => {
    const error = new AppError("Server error", "SERVER_ERROR", 500, true);
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain("Server error");
  });

  it("should return original message for ValidationError", () => {
    const error = new ValidationError("Invalid email");
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toBe("Invalid email");
  });
});

describe("isTierRestrictionError", () => {
  it("should return true for TierRestrictionError", () => {
    const error = new TierRestrictionError("Upgrade", "free", "pro");
    expect(isTierRestrictionError(error)).toBe(true);
  });

  it("should return true for 403 error", () => {
    const error = new Error("403: Forbidden");
    expect(isTierRestrictionError(error)).toBe(true);
  });

  it("should return false for other errors", () => {
    const error = new ValidationError("Invalid");
    expect(isTierRestrictionError(error)).toBe(false);
  });
});

describe("isRetryableError", () => {
  it("should return true for NetworkError", () => {
    const error = new NetworkError();
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return true for 500 error", () => {
    const error = new AppError("Server error", "SERVER_ERROR", 500, true);
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return false for ValidationError", () => {
    const error = new ValidationError("Invalid");
    expect(isRetryableError(error)).toBe(false);
  });

  it("should return false for TierRestrictionError", () => {
    const error = new TierRestrictionError("Upgrade", "free", "pro");
    expect(isRetryableError(error)).toBe(false);
  });
});
