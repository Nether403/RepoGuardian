import { describe, it, expect } from 'vitest';
import { AppError, ErrorCodes } from '../errors';

describe('AppError', () => {
  it('should create an AppError with all properties', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly message',
      500,
      'Try again',
      { detail: 'test' }
    );

    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Internal message');
    expect(error.userMessage).toBe('User-friendly message');
    expect(error.statusCode).toBe(500);
    expect(error.recoveryAction).toBe('Try again');
    expect(error.details).toEqual({ detail: 'test' });
    expect(error.name).toBe('AppError');
  });

  it('should create an AppError with default statusCode', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly message'
    );

    expect(error.statusCode).toBe(500);
  });

  it('should convert to JSON correctly', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly message',
      404,
      'Check the URL',
      { url: '/test' }
    );

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'AppError',
      code: 'TEST_ERROR',
      message: 'Internal message',
      userMessage: 'User-friendly message',
      recoveryAction: 'Check the URL',
      statusCode: 404,
      details: { url: '/test' },
    });
  });

  it('should create AppError from Error', () => {
    const originalError = new Error('Something went wrong');
    const appError = AppError.fromError(originalError);

    expect(appError).toBeInstanceOf(AppError);
    expect(appError.code).toBe('UNKNOWN_ERROR');
    expect(appError.message).toBe('Something went wrong');
    expect(appError.userMessage).toBe('An unexpected error occurred. Please try again.');
    expect(appError.statusCode).toBe(500);
  });

  it('should return same AppError when converting AppError', () => {
    const originalError = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly message',
      404
    );
    const appError = AppError.fromError(originalError);

    expect(appError).toBe(originalError);
  });

  it('should have proper stack trace', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly message'
    );

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });
});

describe('ErrorCodes', () => {
  it('should have RATE_LIMIT_EXCEEDED error code', () => {
    const errorCode = ErrorCodes.RATE_LIMIT_EXCEEDED;

    expect(errorCode.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(errorCode.statusCode).toBe(429);
    expect(errorCode.userMessage).toContain('rate limit');
    expect(errorCode.recoveryAction).toBeDefined();
  });

  it('should have NOT_FOUND error code', () => {
    const errorCode = ErrorCodes.NOT_FOUND;

    expect(errorCode.code).toBe('NOT_FOUND');
    expect(errorCode.statusCode).toBe(404);
    expect(errorCode.userMessage).toContain('not found');
    expect(errorCode.recoveryAction).toBeDefined();
  });

  it('should have NETWORK_ERROR error code', () => {
    const errorCode = ErrorCodes.NETWORK_ERROR;

    expect(errorCode.code).toBe('NETWORK_ERROR');
    expect(errorCode.statusCode).toBe(0);
    expect(errorCode.userMessage).toContain('network');
    expect(errorCode.recoveryAction).toBeDefined();
  });

  it('should have all required error codes', () => {
    const requiredCodes = [
      'RATE_LIMIT_EXCEEDED',
      'NOT_FOUND',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'INVALID_INPUT',
      'DATABASE_ERROR',
      'EXTERNAL_API_ERROR',
      'TIMEOUT_ERROR',
      'INTERNAL_ERROR',
      'NETWORK_ERROR',
      'CONNECTION_TIMEOUT',
      'ANALYSIS_FAILED',
      'EXPORT_FAILED',
    ];

    requiredCodes.forEach((code) => {
      expect(ErrorCodes).toHaveProperty(code);
      const errorCode = ErrorCodes[code as keyof typeof ErrorCodes];
      expect(errorCode.code).toBe(code);
      expect(errorCode.statusCode).toBeGreaterThanOrEqual(0);
      expect(errorCode.userMessage).toBeTruthy();
      expect(errorCode.recoveryAction).toBeTruthy();
    });
  });
});
