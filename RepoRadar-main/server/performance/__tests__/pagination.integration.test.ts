import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { createPaginationMiddleware, repositoryPagination, analysisPagination } from '../../middleware/pagination';

describe('Pagination Middleware Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('createPaginationMiddleware', () => {
    it('should add pagination parameters to request', async () => {
      const middleware = createPaginationMiddleware({
        defaultLimit: 10,
        maxLimit: 50,
        minLimit: 1,
      });

      app.get('/test', middleware, (req: Request, res: Response) => {
        const pagination = (req as any).pagination;
        res.json({ pagination });
      });

      const response = await request(app)
        .get('/test?page=2&limit=20')
        .expect(200);

      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 20,
        offset: 20,
      });
    });

    it('should use default values when parameters not provided', async () => {
      const middleware = createPaginationMiddleware({
        defaultLimit: 15,
        maxLimit: 50,
        minLimit: 1,
      });

      app.get('/test', middleware, (req: Request, res: Response) => {
        const pagination = (req as any).pagination;
        res.json({ pagination });
      });

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 15,
        offset: 0,
      });
    });

    it('should enforce maximum limit', async () => {
      const middleware = createPaginationMiddleware({
        defaultLimit: 10,
        maxLimit: 25,
        minLimit: 1,
      });

      app.get('/test', middleware, (req: Request, res: Response) => {
        const pagination = (req as any).pagination;
        res.json({ pagination });
      });

      const response = await request(app)
        .get('/test?limit=100')
        .expect(200);

      expect(response.body.pagination.limit).toBe(25);
    });

    it('should enforce minimum limit', async () => {
      const middleware = createPaginationMiddleware({
        defaultLimit: 10,
        maxLimit: 50,
        minLimit: 5,
      });

      app.get('/test', middleware, (req: Request, res: Response) => {
        const pagination = (req as any).pagination;
        res.json({ pagination });
      });

      const response = await request(app)
        .get('/test?limit=2')
        .expect(200);

      expect(response.body.pagination.limit).toBe(5);
    });

    it('should handle invalid pagination parameters', async () => {
      const middleware = createPaginationMiddleware();

      app.get('/test', middleware, (req: Request, res: Response) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test?page=invalid&limit=invalid')
        .expect(400);

      expect(response.body.error).toBe('Invalid pagination parameters');
    });

    it('should add paginate function to response', async () => {
      const middleware = createPaginationMiddleware({
        defaultLimit: 5,
        maxLimit: 50,
        minLimit: 1,
      });

      app.get('/test', middleware, (req: Request, res: Response) => {
        const mockData = [1, 2, 3, 4, 5];
        const total = 23;
        const paginatedResult = (res as any).paginate(mockData, total);
        res.json(paginatedResult);
      });

      const response = await request(app)
        .get('/test?page=2&limit=5')
        .expect(200);

      expect(response.body).toEqual({
        data: [1, 2, 3, 4, 5],
        pagination: {
          page: 2,
          limit: 5,
          total: 23,
          totalPages: 5,
          hasNext: true,
          hasPrev: true,
          nextPage: 3,
          prevPage: 1,
        },
      });
    });
  });

  describe('Repository Pagination', () => {
    it('should handle repository listing with pagination', async () => {
      app.get('/repositories', repositoryPagination, (req: Request, res: Response) => {
        const pagination = (req as any).pagination;
        
        // Mock repository data
        const mockRepositories = Array.from({ length: pagination.limit }, (_, i) => ({
          id: `repo-${pagination.offset + i + 1}`,
          name: `Repository ${pagination.offset + i + 1}`,
          owner: 'testowner',
          stars: Math.floor(Math.random() * 1000),
        }));

        const total = 127; // Mock total count
        const result = (res as any).paginate(mockRepositories, total);
        res.json(result);
      });

      const response = await request(app)
        .get('/repositories?page=3&limit=10')
        .expect(200);

      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 127,
        totalPages: 13,
        hasNext: true,
        hasPrev: true,
        nextPage: 4,
        prevPage: 2,
      });

      // Check that data corresponds to the correct page
      expect(response.body.data[0].id).toBe('repo-21'); // (3-1) * 10 + 1
    });

    it('should respect repository pagination limits', async () => {
      app.get('/repositories', repositoryPagination, (req: Request, res: Response) => {
        const pagination = (req as any).pagination;
        res.json({ limit: pagination.limit });
      });

      // Test max limit enforcement (should be 50 for repositories)
      const response = await request(app)
        .get('/repositories?limit=100')
        .expect(200);

      expect(response.body.limit).toBe(50);
    });
  });

  describe('Analysis Pagination', () => {
    it('should handle analysis listing with pagination', async () => {
      app.get('/analyses', analysisPagination, (req: Request, res: Response) => {
        const pagination = (req as any).pagination;
        
        // Mock analysis data
        const mockAnalyses = Array.from({ length: pagination.limit }, (_, i) => ({
          id: `analysis-${pagination.offset + i + 1}`,
          repositoryId: `repo-${pagination.offset + i + 1}`,
          overallScore: Math.random() * 10,
          createdAt: new Date().toISOString(),
        }));

        const total = 250; // Mock total count
        const result = (res as any).paginate(mockAnalyses, total);
        res.json(result);
      });

      const response = await request(app)
        .get('/analyses?page=2&limit=25')
        .expect(200);

      expect(response.body.data).toHaveLength(25);
      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 25,
        total: 250,
        totalPages: 10,
        hasNext: true,
        hasPrev: true,
        nextPage: 3,
        prevPage: 1,
      });
    });

    it('should use analysis pagination defaults', async () => {
      app.get('/analyses', analysisPagination, (req: Request, res: Response) => {
        const pagination = (req as any).pagination;
        res.json({ pagination });
      });

      const response = await request(app)
        .get('/analyses')
        .expect(200);

      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20, // Default for analysis pagination
        offset: 0,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty result set', async () => {
      const middleware = createPaginationMiddleware();

      app.get('/empty', middleware, (req: Request, res: Response) => {
        const result = (res as any).paginate([], 0);
        res.json(result);
      });

      const response = await request(app)
        .get('/empty')
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
          nextPage: null,
          prevPage: null,
        },
      });
    });

    it('should handle single page result', async () => {
      const middleware = createPaginationMiddleware();

      app.get('/single', middleware, (req: Request, res: Response) => {
        const data = [1, 2, 3];
        const result = (res as any).paginate(data, 3);
        res.json(result);
      });

      const response = await request(app)
        .get('/single?limit=10')
        .expect(200);

      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
        nextPage: null,
        prevPage: null,
      });
    });

    it('should handle page beyond total pages', async () => {
      const middleware = createPaginationMiddleware();

      app.get('/beyond', middleware, (req: Request, res: Response) => {
        const data: any[] = []; // Empty data for page beyond range
        const result = (res as any).paginate(data, 25);
        res.json(result);
      });

      const response = await request(app)
        .get('/beyond?page=10&limit=10') // Page 10 when only 3 pages exist
        .expect(200);

      expect(response.body.pagination.page).toBe(10);
      expect(response.body.pagination.totalPages).toBe(3);
      expect(response.body.pagination.hasNext).toBe(false);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('Performance', () => {
    it('should handle large page numbers efficiently', async () => {
      const middleware = createPaginationMiddleware();

      app.get('/large', middleware, (req: Request, res: Response) => {
        const pagination = (req as any).pagination;
        res.json({ 
          offset: pagination.offset,
          page: pagination.page,
          limit: pagination.limit 
        });
      });

      const response = await request(app)
        .get('/large?page=1000000&limit=50')
        .expect(200);

      expect(response.body.offset).toBe(49999950); // (1000000-1) * 50
      expect(response.body.page).toBe(1000000);
      expect(response.body.limit).toBe(50);
    });

    it('should handle concurrent requests correctly', async () => {
      const middleware = createPaginationMiddleware();

      app.get('/concurrent', middleware, (req: Request, res: Response) => {
        const pagination = (req as any).pagination;
        // Simulate some async work
        setTimeout(() => {
          res.json({ pagination });
        }, Math.random() * 10);
      });

      // Make multiple concurrent requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app).get(`/concurrent?page=${i + 1}&limit=5`)
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.pagination.page).toBe(index + 1);
        expect(response.body.pagination.limit).toBe(5);
        expect(response.body.pagination.offset).toBe(index * 5);
      });
    });
  });
});