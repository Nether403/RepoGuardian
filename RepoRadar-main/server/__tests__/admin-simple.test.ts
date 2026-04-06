import { describe, it, expect, beforeAll, vi } from 'vitest';
import { requireAdmin, getHealthMetrics, getSystemMetrics } from '../admin';
import type { Request, Response, NextFunction } from 'express';

// Mock the database module
vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              execute: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      })),
    })),
  },
  checkDatabaseHealth: vi.fn().mockResolvedValue({
    status: 'healthy',
    responseTime: 10,
  }),
}));

describe('Admin Dashboard API - Unit Tests', () => {
  const ADMIN_TOKEN = 'test-admin-token';
  
  beforeAll(() => {
    process.env.ADMIN_TOKEN = ADMIN_TOKEN;
  });
  
  describe('requireAdmin middleware', () => {
    it('should reject requests without admin token', () => {
      const req = {
        headers: {},
      } as Request;
      
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      
      const next = vi.fn() as NextFunction;
      
      requireAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should reject requests with invalid admin token', () => {
      const req = {
        headers: {
          'x-admin-token': 'invalid-token',
        },
      } as Request;
      
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      
      const next = vi.fn() as NextFunction;
      
      requireAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should accept requests with valid admin token', () => {
      const req = {
        headers: {
          'x-admin-token': ADMIN_TOKEN,
        },
      } as Request;
      
      const res = {} as Response;
      const next = vi.fn() as NextFunction;
      
      requireAdmin(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('getHealthMetrics', () => {
    it('should return health metrics', async () => {
      const req = {} as Request;
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;
      
      await getHealthMetrics(req, res);
      
      expect(res.json).toHaveBeenCalled();
      const response = (res.json as any).mock.calls[0][0];
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('checks');
      expect(response.checks).toHaveProperty('database');
      expect(response.checks).toHaveProperty('cache');
      expect(response.checks).toHaveProperty('api');
    });
  });
  
  describe('getSystemMetrics', () => {
    it('should return system metrics', async () => {
      const req = {
        query: {},
      } as unknown as Request;
      
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;
      
      await getSystemMetrics(req, res);
      
      expect(res.json).toHaveBeenCalled();
      const response = (res.json as any).mock.calls[0][0];
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('period');
      expect(response).toHaveProperty('metrics');
      expect(response).toHaveProperty('resources');
    });
    
    it('should accept custom date range', async () => {
      const startDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();
      
      const req = {
        query: { startDate, endDate },
      } as unknown as Request;
      
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;
      
      await getSystemMetrics(req, res);
      
      expect(res.json).toHaveBeenCalled();
      const response = (res.json as any).mock.calls[0][0];
      expect(response.period.start).toBe(startDate);
      expect(response.period.end).toBe(endDate);
    });
  });
});
