/**
 * Custom error class with error codes and user-friendly messages
 */
export class AppError extends Error {
  code: string;
  userMessage: string;
  recoveryAction?: string;
  details?: Record<string, any>;
  statusCode: number;

  constructor(
    code: string,
    message: string,
    userMessage: string,
    statusCode: number = 500,
    recoveryAction?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    this.statusCode = statusCode;
    this.recoveryAction = recoveryAction;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      recoveryAction: this.recoveryAction,
      statusCode: this.statusCode,
      details: this.details,
    };
  }

  static fromError(error: Error): AppError {
    if (error instanceof AppError) {
      return error;
    }

    return new AppError(
      'UNKNOWN_ERROR',
      error.message,
      'An unexpected error occurred. Please try again.',
      500
    );
  }
}

// Common error codes and their user messages
export const ErrorCodes = {
  // Network errors (4xx)
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429,
    userMessage: 'GitHub API rate limit exceeded. Please try again later.',
    recoveryAction: 'Wait for rate limit to reset or use authentication',
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    statusCode: 404,
    userMessage: 'The requested resource was not found.',
    recoveryAction: 'Verify the repository exists and is accessible',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    statusCode: 401,
    userMessage: 'Authentication required to access this resource.',
    recoveryAction: 'Please sign in and try again',
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    statusCode: 403,
    userMessage: 'You do not have permission to access this resource.',
    recoveryAction: 'Check your permissions or contact an administrator',
  },
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    statusCode: 400,
    userMessage: 'The provided input is invalid.',
    recoveryAction: 'Please check your input and try again',
  },

  // System errors (5xx)
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    statusCode: 500,
    userMessage: 'A database error occurred. Please try again.',
    recoveryAction: 'If the problem persists, contact support',
  },
  EXTERNAL_API_ERROR: {
    code: 'EXTERNAL_API_ERROR',
    statusCode: 502,
    userMessage: 'An external service is temporarily unavailable.',
    recoveryAction: 'Please try again in a few moments',
  },
  TIMEOUT_ERROR: {
    code: 'TIMEOUT_ERROR',
    statusCode: 504,
    userMessage: 'The request took too long to complete.',
    recoveryAction: 'Please try again or try a smaller request',
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    userMessage: 'An internal server error occurred.',
    recoveryAction: 'Please try again or contact support',
  },

  // Network errors
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    statusCode: 0,
    userMessage: 'A network error occurred. Please check your connection.',
    recoveryAction: 'Check your internet connection and retry',
  },
  CONNECTION_TIMEOUT: {
    code: 'CONNECTION_TIMEOUT',
    statusCode: 0,
    userMessage: 'Connection timed out.',
    recoveryAction: 'Check your internet connection and retry',
  },

  // Application errors
  ANALYSIS_FAILED: {
    code: 'ANALYSIS_FAILED',
    statusCode: 500,
    userMessage: 'Repository analysis failed.',
    recoveryAction: 'Try again with a different repository or contact support',
  },
  EXPORT_FAILED: {
    code: 'EXPORT_FAILED',
    statusCode: 500,
    userMessage: 'Data export failed.',
    recoveryAction: 'Try again or try a different export format',
  },

  // Authentication errors
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    statusCode: 401,
    userMessage: 'Invalid email or password.',
    recoveryAction: 'Please check your credentials and try again',
  },
  ACCOUNT_LOCKED: {
    code: 'ACCOUNT_LOCKED',
    statusCode: 403,
    userMessage: 'Your account has been temporarily locked due to multiple failed login attempts.',
    recoveryAction: 'Please try again later or reset your password',
  },
  EMAIL_NOT_VERIFIED: {
    code: 'EMAIL_NOT_VERIFIED',
    statusCode: 403,
    userMessage: 'Please verify your email address before logging in.',
    recoveryAction: 'Check your email for a verification link',
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    statusCode: 400,
    userMessage: 'The reset link is invalid.',
    recoveryAction: 'Please request a new password reset link',
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    statusCode: 400,
    userMessage: 'The reset link has expired.',
    recoveryAction: 'Please request a new password reset link',
  },
  OAUTH_ERROR: {
    code: 'OAUTH_ERROR',
    statusCode: 500,
    userMessage: 'Authentication with the provider failed.',
    recoveryAction: 'Please try again or use a different sign-in method',
  },
  SESSION_EXPIRED: {
    code: 'SESSION_EXPIRED',
    statusCode: 401,
    userMessage: 'Your session has expired.',
    recoveryAction: 'Please sign in again',
  },
  PASSWORD_VALIDATION_ERROR: {
    code: 'PASSWORD_VALIDATION_ERROR',
    statusCode: 400,
    userMessage: 'Password does not meet requirements.',
    recoveryAction: 'Password must be at least 8 characters long',
  },
} as const;
