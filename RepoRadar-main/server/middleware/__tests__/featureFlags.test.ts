/**
 * Feature Flags Middleware Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  featureFlagsMiddleware,
  requireFeatureFlag,
  getFeatureFlagsHandler,
  updateFeatureFlagHandler,
} from '../featureFlags';
import { initializeFeatureFlags, resetFeatureFlags, defaultFeatureFlags } from '../../../shared/featureFlags';

describe('Feature Flags Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      session: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    
    // Initialize with default config
    initializeFeatureFlags();
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  describe('featureFlagsMiddleware', () => {
    it('should attach featureFlags to request', () => {
      featureFlagsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.featureFlags).toBeDefined();
      expect(typeof mockReq.featureFlags?.isEnabled).toBe('function');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should check flags correctly', () => {
      featureFlagsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.featureFlags?.isEnabled('loadingStates')).toBe(true);
      expect(mockReq.featureFlags?.isEnabled('errorHandling')).toBe(true);
    });

    it('should use user ID from session', () => {
      mockReq.session = { userId: 'user123' };
      
      featureFlagsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.featureFlags?.isEnabled('loadingStates')).toBe(true);
    });
  });

  describe('requireFeatureFlag', () => {
    it('should allow request when flag is enabled', () => {
      const middleware = requireFeatureFlag('loadingStates');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block request when flag is disabled', () => {
      const featureFlags = initializeFeatureFlags();
      featureFlags.disable('loadingStates');

      const middleware = requireFeatureFlag('loadingStates');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Feature not available',
        message: 'The loadingStates feature is currently disabled',
        code: 'FEATURE_DISABLED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should respect user-specific overrides', () => {
      const featureFlags = initializeFeatureFlags();
      const flag = featureFlags.getFlag('loadingStates');
      if (flag) {
        flag.disabledForUsers = ['user123'];
      }

      mockReq.session = { userId: 'user123' };

      const middleware = requireFeatureFlag('loadingStates');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('getFeatureFlagsHandler', () => {
    it('should return all feature flags', () => {
      getFeatureFlagsHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalled();
      const call = (mockRes.json as any).mock.calls[0][0];
      expect(call.flags).toBeDefined();
      expect(Array.isArray(call.flags)).toBe(true);
      expect(call.flags.length).toBe(10);
    });

    it('should include flag details', () => {
      getFeatureFlagsHandler(mockReq as Request, mockRes as Response);

      const call = (mockRes.json as any).mock.calls[0][0];
      const flag = call.flags[0];
      
      expect(flag.name).toBeDefined();
      expect(flag.enabled).toBeDefined();
      expect(flag.description).toBeDefined();
      expect(flag.rolloutPercentage).toBeDefined();
    });
  });

  describe('updateFeatureFlagHandler', () => {
    beforeEach(() => {
      mockReq.params = {};
      mockReq.body = {};
    });

    it('should update flag enabled status', () => {
      mockReq.params = { flagName: 'loadingStates' };
      mockReq.body = { enabled: false };

      updateFeatureFlagHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalled();
      const call = (mockRes.json as any).mock.calls[0][0];
      expect(call.success).toBe(true);
      expect(call.flag.enabled).toBe(false);
    });

    it('should update rollout percentage', () => {
      mockReq.params = { flagName: 'loadingStates' };
      mockReq.body = { rolloutPercentage: 50 };

      updateFeatureFlagHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalled();
      const call = (mockRes.json as any).mock.calls[0][0];
      expect(call.success).toBe(true);
      expect(call.flag.rolloutPercentage).toBe(50);
    });

    it('should return 404 for non-existent flag', () => {
      mockReq.params = { flagName: 'nonExistent' };
      mockReq.body = { enabled: false };

      updateFeatureFlagHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Feature flag not found',
        message: "Feature flag 'nonExistent' does not exist",
      });
    });

    it('should return 400 for invalid rollout percentage', () => {
      mockReq.params = { flagName: 'loadingStates' };
      mockReq.body = { rolloutPercentage: 150 };

      updateFeatureFlagHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const call = (mockRes.json as any).mock.calls[0][0];
      expect(call.error).toBe('Invalid request');
    });

    it('should update both enabled and rollout percentage', () => {
      mockReq.params = { flagName: 'loadingStates' };
      mockReq.body = { enabled: false, rolloutPercentage: 25 };

      updateFeatureFlagHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalled();
      const call = (mockRes.json as any).mock.calls[0][0];
      expect(call.success).toBe(true);
      expect(call.flag.enabled).toBe(false);
      expect(call.flag.rolloutPercentage).toBe(25);
    });
  });
});
