import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  createErrorHandler,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  RateLimitError,
  ServiceUnavailableError,
} from '../errorHandler';
import { AppError, ErrorCodes } from '@shared/errors';

describe('Error Handler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      url: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-agent'),
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = vi.fn();

    // Suppress console.error during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('createErrorHandler', () => {
    it('should handle AppError correctly', () => {
      const errorHandler = createErrorHandler();
      const error = new AppError(
        ErrorCodes.NOT_FOUND.code,
        'Resource not found',
        'The requested resource was not found',
        404,
        'Check the URL'
      );

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: ErrorCodes.NOT_FOUND.code,
          message: 'The requested resource was not found',
          recoveryAction: 'Check the URL',
          details: undefined,
        },
      });
    });

    it('should convert RateLimitError to AppError', () => {
      const errorHandler = createErrorHandler();
      const resetTime = new Date('2025-01-01T12:00:00Z');
      const error = new RateLimitError('Rate limit exceeded', resetTime);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED.code,
          message: ErrorCodes.RATE_LIMIT_EXCEEDED.userMessage,
          recoveryAction: ErrorCodes.RATE_LIMIT_EXCEEDED.recoveryAction,
          details: { resetTime: resetTime.toISOString() },
        },
      });
    });

    it('should convert NotFoundError to AppError', () => {
      const errorHandler = createErrorHandler();
      const error = new NotFoundError('Resource not found');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: ErrorCodes.NOT_FOUND.code,
          message: ErrorCodes.NOT_FOUND.userMessage,
          recoveryAction: ErrorCodes.NOT_FOUND.recoveryAction,
          details: undefined,
        },
      });
    });

    it('should convert UnauthorizedError to AppError', () => {
      const errorHandler = createErrorHandler();
      const error = new UnauthorizedError('Unauthorized access');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: ErrorCodes.UNAUTHORIZED.code,
          message: ErrorCodes.UNAUTHORIZED.userMessage,
          recoveryAction: ErrorCodes.UNAUTHORIZED.recoveryAction,
          details: undefined,
        },
      });
    });

    it('should convert ValidationError to AppError', () => {
      const errorHandler = createErrorHandler();
      const error = new ValidationError('Invalid input');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: ErrorCodes.INVALID_INPUT.code,
          message: ErrorCodes.INVALID_INPUT.userMessage,
          recoveryAction: ErrorCodes.INVALID_INPUT.recoveryAction,
          details: undefined,
        },
      });
    });

    it('should convert ServiceUnavailableError to AppError', () => {
      const errorHandler = createErrorHandler();
      const error = new ServiceUnavailableError('Service down');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(502);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: ErrorCodes.EXTERNAL_API_ERROR.code,
          message: ErrorCodes.EXTERNAL_API_ERROR.userMessage,
          recoveryAction: ErrorCodes.EXTERNAL_API_ERROR.recoveryAction,
          details: undefined,
        },
      });
    });

    it('should convert unknown errors to AppError', () => {
      const errorHandler = createErrorHandler();
      const error = new Error('Unknown error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred. Please try again.',
          recoveryAction: undefined,
          details: undefined,
        },
      });
    });

    it('should include technical details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const errorHandler = createErrorHandler();
      const error = new AppError(
        'TEST_ERROR',
        'Technical message',
        'User message',
        500
      );

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            technicalMessage: 'Technical message',
            stack: expect.any(String),
          }),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should log error details', () => {
      const errorHandler = createErrorHandler();
      const error = new AppError(
        'TEST_ERROR',
        'Technical message',
        'User message',
        500
      );

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(console.error).toHaveBeenCalledWith(
        'Error occurred:',
        expect.objectContaining({
          code: 'TEST_ERROR',
          message: 'Technical message',
          userMessage: 'User message',
          statusCode: 500,
          url: '/api/test',
          method: 'GET',
        })
      );
    });
  });
});
