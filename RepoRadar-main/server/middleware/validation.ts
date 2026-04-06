import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../utils/errorHandler';

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new ValidationError(`Validation failed: ${message}`));
      } else {
        next(error);
      }
    }
  };
}

export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new ValidationError(`Query validation failed: ${message}`));
      } else {
        next(error);
      }
    }
  };
}

export function validateParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new ValidationError(`Parameter validation failed: ${message}`));
      } else {
        next(error);
      }
    }
  };
}

// Common validation schemas
export const analyzeRepositorySchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

export const searchRepositoriesSchema = z.object({
  q: z.string().min(1, 'Query cannot be empty').max(100, 'Query too long'),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
});

export const repositoryIdSchema = z.object({
  id: z.string().min(1, 'Repository ID is required'),
});

export const createSubscriptionSchema = z.object({
  plan: z.enum(['pro', 'enterprise'], {
    errorMap: () => ({ message: 'Plan must be either "pro" or "enterprise"' })
  }),
});

export const findSimilarSchema = z.object({
  repositoryId: z.string().optional(),
  functionality: z.string().optional(),
  useCase: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  minStars: z.number().min(0).optional(),
  maxAge: z.string().optional(),
  maxResults: z.number().min(1).max(50).optional().default(20),
}).refine(
  data => data.repositoryId || data.functionality || data.useCase || (data.technologies && data.technologies.length > 0),
  {
    message: "At least one search criteria must be provided (repositoryId, functionality, useCase, or technologies)"
  }
);