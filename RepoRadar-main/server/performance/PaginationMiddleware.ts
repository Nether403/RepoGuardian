import { IPaginationMiddleware } from './interfaces';

export interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
  minLimit: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextPage: number | null;
    prevPage: number | null;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export class PaginationMiddleware implements IPaginationMiddleware {
  private config: PaginationConfig;

  constructor(config: Partial<PaginationConfig> = {}) {
    this.config = {
      defaultLimit: config.defaultLimit || 10,
      maxLimit: config.maxLimit || 100,
      minLimit: config.minLimit || 1,
    };
  }

  /**
   * Apply pagination to a dataset
   */
  paginate<T>(data: T[], total: number, page: number, limit: number): PaginationResult<T> {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
        nextPage: hasNext ? page + 1 : null,
        prevPage: hasPrev ? page - 1 : null,
      },
    };
  }

  /**
   * Extract pagination parameters from request query
   */
  extractPaginationParams(query: any): PaginationParams {
    let page = 1;
    let limit = this.config.defaultLimit;

    // Parse page parameter
    if (query.page) {
      const parsedPage = parseInt(query.page, 10);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        page = parsedPage;
      }
    }

    // Parse limit parameter
    if (query.limit) {
      const parsedLimit = parseInt(query.limit, 10);
      if (!isNaN(parsedLimit)) {
        limit = Math.max(
          this.config.minLimit,
          Math.min(this.config.maxLimit, parsedLimit)
        );
      }
    }

    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Validate pagination parameters
   */
  validatePaginationParams(params: any): boolean {
    const { page, limit } = params;

    // Validate page
    if (page !== undefined) {
      if (typeof page !== 'number' || page < 1 || !Number.isInteger(page)) {
        return false;
      }
    }

    // Validate limit
    if (limit !== undefined) {
      if (
        typeof limit !== 'number' ||
        limit < this.config.minLimit ||
        limit > this.config.maxLimit ||
        !Number.isInteger(limit)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get pagination configuration
   */
  getConfig(): PaginationConfig {
    return { ...this.config };
  }

  /**
   * Update pagination configuration
   */
  configure(newConfig: Partial<PaginationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Calculate total pages for a given total count and limit
   */
  calculateTotalPages(total: number, limit: number): number {
    return Math.ceil(total / limit);
  }

  /**
   * Check if a page number is valid for given total and limit
   */
  isValidPage(page: number, total: number, limit: number): boolean {
    const totalPages = this.calculateTotalPages(total, limit);
    return page >= 1 && page <= totalPages;
  }

  /**
   * Get pagination info without data
   */
  getPaginationInfo(page: number, limit: number, total: number) {
    const totalPages = this.calculateTotalPages(total, limit);
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
}

// Create default pagination middleware instances
export const defaultPagination = new PaginationMiddleware();

export const repositoryPagination = new PaginationMiddleware({
  defaultLimit: 10,
  maxLimit: 50,
  minLimit: 1,
});

export const analysisPagination = new PaginationMiddleware({
  defaultLimit: 20,
  maxLimit: 100,
  minLimit: 1,
});

export const searchPagination = new PaginationMiddleware({
  defaultLimit: 10,
  maxLimit: 25,
  minLimit: 1,
});