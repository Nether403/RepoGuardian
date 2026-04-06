import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: PaginationMetadata;
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
  minLimit?: number;
}

// Validation schema for pagination query parameters
export const paginationQuerySchema = z.object({
  page: z.string().optional().transform((val, ctx) => {
    if (!val) return 1;
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Page must be a positive integer",
      });
      return z.NEVER;
    }
    return parsed;
  }),
  limit: z.string().optional().transform((val, ctx) => {
    if (!val) return undefined;
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Limit must be a positive integer",
      });
      return z.NEVER;
    }
    return parsed;
  }),
});

/**
 * Middleware to handle pagination parameters and add pagination utilities to request
 */
export function createPaginationMiddleware(options: PaginationOptions = {}) {
  const {
    defaultLimit = 10,
    maxLimit = 100,
    minLimit = 1,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and validate pagination parameters
      const parsed = paginationQuerySchema.parse(req.query);
      let { page, limit } = parsed;

      // Apply default limit if not provided
      if (limit === undefined) {
        limit = defaultLimit;
      }

      // Enforce limit constraints
      limit = Math.max(minLimit, Math.min(maxLimit, limit));
      
      // Calculate offset
      const offset = (page - 1) * limit;

      // Add pagination parameters to request
      (req as any).pagination = {
        page,
        limit,
        offset,
      } as PaginationParams;

      // Add pagination helper function to response
      (res as any).paginate = function<T>(data: T[], total: number): PaginatedResponse<T> {
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        const metadata: PaginationMetadata = {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
          nextPage: hasNext ? page + 1 : null,
          prevPage: hasPrev ? page - 1 : null,
        };

        return {
          data,
          pagination: metadata,
        };
      };

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ 
          error: 'Invalid pagination parameters',
          details: message 
        });
      }
      next(error);
    }
  };
}

/**
 * Helper function to create pagination metadata
 */
export function createPaginationMetadata(
  page: number,
  limit: number,
  total: number
): PaginationMetadata {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    nextPage: hasNext ? page + 1 : null,
    prevPage: hasPrev ? page - 1 : null,
  };
}

/**
 * Helper function to apply pagination to database queries
 */
export function applyPagination<T>(
  query: any,
  pagination: PaginationParams
): any {
  return query
    .limit(pagination.limit)
    .offset(pagination.offset);
}

/**
 * Predefined pagination middleware for different endpoints
 */
export const repositoryPagination = createPaginationMiddleware({
  defaultLimit: 10,
  maxLimit: 50,
  minLimit: 1,
});

export const analysisPagination = createPaginationMiddleware({
  defaultLimit: 20,
  maxLimit: 100,
  minLimit: 1,
});

export const searchPagination = createPaginationMiddleware({
  defaultLimit: 10,
  maxLimit: 25,
  minLimit: 1,
});

// Type extensions for Express Request and Response
declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationParams;
    }
    
    interface Response {
      paginate?<T>(data: T[], total: number): PaginatedResponse<T>;
    }
  }
}