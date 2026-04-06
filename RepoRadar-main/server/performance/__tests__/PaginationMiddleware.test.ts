import { describe, it, expect, beforeEach } from 'vitest';
import { PaginationMiddleware } from '../PaginationMiddleware';

describe('PaginationMiddleware', () => {
  let paginationMiddleware: PaginationMiddleware;

  beforeEach(() => {
    paginationMiddleware = new PaginationMiddleware({
      defaultLimit: 10,
      maxLimit: 100,
      minLimit: 1,
    });
  });

  describe('extractPaginationParams', () => {
    it('should extract default pagination parameters when none provided', () => {
      const params = paginationMiddleware.extractPaginationParams({});
      
      expect(params).toEqual({
        page: 1,
        limit: 10,
        offset: 0,
      });
    });

    it('should extract valid pagination parameters', () => {
      const query = { page: '2', limit: '20' };
      const params = paginationMiddleware.extractPaginationParams(query);
      
      expect(params).toEqual({
        page: 2,
        limit: 20,
        offset: 20,
      });
    });

    it('should enforce maximum limit constraint', () => {
      const query = { page: '1', limit: '150' };
      const params = paginationMiddleware.extractPaginationParams(query);
      
      expect(params.limit).toBe(100); // Should be capped at maxLimit
    });

    it('should enforce minimum limit constraint', () => {
      const query = { page: '1', limit: '0' };
      const params = paginationMiddleware.extractPaginationParams(query);
      
      expect(params.limit).toBe(1); // Should be raised to minLimit
    });

    it('should handle invalid page parameter', () => {
      const query = { page: 'invalid', limit: '10' };
      const params = paginationMiddleware.extractPaginationParams(query);
      
      expect(params.page).toBe(1); // Should default to 1
    });

    it('should handle negative page parameter', () => {
      const query = { page: '-1', limit: '10' };
      const params = paginationMiddleware.extractPaginationParams(query);
      
      expect(params.page).toBe(1); // Should default to 1
    });

    it('should calculate correct offset', () => {
      const query = { page: '3', limit: '15' };
      const params = paginationMiddleware.extractPaginationParams(query);
      
      expect(params.offset).toBe(30); // (3-1) * 15
    });
  });

  describe('paginate', () => {
    it('should create correct pagination metadata for first page', () => {
      const data = [1, 2, 3, 4, 5];
      const total = 25;
      const page = 1;
      const limit = 5;

      const result = paginationMiddleware.paginate(data, total, page, limit);

      expect(result).toEqual({
        data: [1, 2, 3, 4, 5],
        pagination: {
          page: 1,
          limit: 5,
          total: 25,
          totalPages: 5,
          hasNext: true,
          hasPrev: false,
          nextPage: 2,
          prevPage: null,
        },
      });
    });

    it('should create correct pagination metadata for middle page', () => {
      const data = [11, 12, 13, 14, 15];
      const total = 25;
      const page = 3;
      const limit = 5;

      const result = paginationMiddleware.paginate(data, total, page, limit);

      expect(result).toEqual({
        data: [11, 12, 13, 14, 15],
        pagination: {
          page: 3,
          limit: 5,
          total: 25,
          totalPages: 5,
          hasNext: true,
          hasPrev: true,
          nextPage: 4,
          prevPage: 2,
        },
      });
    });

    it('should create correct pagination metadata for last page', () => {
      const data = [21, 22, 23, 24, 25];
      const total = 25;
      const page = 5;
      const limit = 5;

      const result = paginationMiddleware.paginate(data, total, page, limit);

      expect(result).toEqual({
        data: [21, 22, 23, 24, 25],
        pagination: {
          page: 5,
          limit: 5,
          total: 25,
          totalPages: 5,
          hasNext: false,
          hasPrev: true,
          nextPage: null,
          prevPage: 4,
        },
      });
    });

    it('should handle single page result', () => {
      const data = [1, 2, 3];
      const total = 3;
      const page = 1;
      const limit = 10;

      const result = paginationMiddleware.paginate(data, total, page, limit);

      expect(result).toEqual({
        data: [1, 2, 3],
        pagination: {
          page: 1,
          limit: 10,
          total: 3,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
          nextPage: null,
          prevPage: null,
        },
      });
    });

    it('should handle empty result set', () => {
      const data: any[] = [];
      const total = 0;
      const page = 1;
      const limit = 10;

      const result = paginationMiddleware.paginate(data, total, page, limit);

      expect(result).toEqual({
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
  });

  describe('validatePaginationParams', () => {
    it('should validate correct pagination parameters', () => {
      const params = { page: 1, limit: 10 };
      const isValid = paginationMiddleware.validatePaginationParams(params);
      
      expect(isValid).toBe(true);
    });

    it('should reject negative page number', () => {
      const params = { page: -1, limit: 10 };
      const isValid = paginationMiddleware.validatePaginationParams(params);
      
      expect(isValid).toBe(false);
    });

    it('should reject zero page number', () => {
      const params = { page: 0, limit: 10 };
      const isValid = paginationMiddleware.validatePaginationParams(params);
      
      expect(isValid).toBe(false);
    });

    it('should reject non-integer page number', () => {
      const params = { page: 1.5, limit: 10 };
      const isValid = paginationMiddleware.validatePaginationParams(params);
      
      expect(isValid).toBe(false);
    });

    it('should reject limit below minimum', () => {
      const params = { page: 1, limit: 0 };
      const isValid = paginationMiddleware.validatePaginationParams(params);
      
      expect(isValid).toBe(false);
    });

    it('should reject limit above maximum', () => {
      const params = { page: 1, limit: 150 };
      const isValid = paginationMiddleware.validatePaginationParams(params);
      
      expect(isValid).toBe(false);
    });

    it('should reject non-integer limit', () => {
      const params = { page: 1, limit: 10.5 };
      const isValid = paginationMiddleware.validatePaginationParams(params);
      
      expect(isValid).toBe(false);
    });

    it('should accept undefined parameters', () => {
      const params = {};
      const isValid = paginationMiddleware.validatePaginationParams(params);
      
      expect(isValid).toBe(true);
    });
  });

  describe('calculateTotalPages', () => {
    it('should calculate correct total pages', () => {
      expect(paginationMiddleware.calculateTotalPages(25, 10)).toBe(3);
      expect(paginationMiddleware.calculateTotalPages(30, 10)).toBe(3);
      expect(paginationMiddleware.calculateTotalPages(31, 10)).toBe(4);
      expect(paginationMiddleware.calculateTotalPages(0, 10)).toBe(0);
    });
  });

  describe('isValidPage', () => {
    it('should validate page numbers correctly', () => {
      expect(paginationMiddleware.isValidPage(1, 25, 10)).toBe(true);
      expect(paginationMiddleware.isValidPage(3, 25, 10)).toBe(true);
      expect(paginationMiddleware.isValidPage(4, 25, 10)).toBe(false);
      expect(paginationMiddleware.isValidPage(0, 25, 10)).toBe(false);
    });
  });

  describe('getPaginationInfo', () => {
    it('should return pagination info without data', () => {
      const info = paginationMiddleware.getPaginationInfo(2, 10, 25);
      
      expect(info).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
        nextPage: 3,
        prevPage: 1,
      });
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      paginationMiddleware.configure({
        defaultLimit: 20,
        maxLimit: 200,
      });

      const config = paginationMiddleware.getConfig();
      expect(config.defaultLimit).toBe(20);
      expect(config.maxLimit).toBe(200);
      expect(config.minLimit).toBe(1); // Should remain unchanged
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = paginationMiddleware.getConfig();
      
      expect(config).toEqual({
        defaultLimit: 10,
        maxLimit: 100,
        minLimit: 1,
      });
    });

    it('should return a copy of configuration', () => {
      const config1 = paginationMiddleware.getConfig();
      const config2 = paginationMiddleware.getConfig();
      
      expect(config1).not.toBe(config2); // Should be different objects
      expect(config1).toEqual(config2); // But with same values
    });
  });
});