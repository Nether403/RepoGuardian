/**
 * useFeatureFlags Hook Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlag, useFeatureFlags, useFeatureFlagsMap, clearFeatureFlagsCache } from '../useFeatureFlags';

// Mock fetch
global.fetch = vi.fn();

describe('useFeatureFlag', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearFeatureFlagsCache();
  });

  it('should default to enabled', () => {
    const { result } = renderHook(() => useFeatureFlag('loadingStates'));
    expect(result.current).toBe(true);
  });

  it('should fetch flag from API', async () => {
    const mockFlags = {
      flags: [
        { name: 'loadingStates', enabled: false, description: 'Test', rolloutPercentage: 100 },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFlags,
    });

    const { result } = renderHook(() => useFeatureFlag('loadingStates'));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('should use cached flags', async () => {
    const cachedFlags = {
      loadingStates: { name: 'loadingStates', enabled: false, description: 'Test', rolloutPercentage: 100 },
    };
    localStorage.setItem('featureFlags', JSON.stringify(cachedFlags));

    const { result } = renderHook(() => useFeatureFlag('loadingStates'));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    // Should not fetch from API if cached
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useFeatureFlag('loadingStates'));

    await waitFor(() => {
      // Should default to enabled on error
      expect(result.current).toBe(true);
    });
  });
});

describe('useFeatureFlags', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearFeatureFlagsCache();
  });

  it('should start in loading state', () => {
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current.loading).toBe(true);
    expect(result.current.flags).toEqual({});
    expect(result.current.error).toBeNull();
  });

  it('should fetch all flags', async () => {
    const mockFlags = {
      flags: [
        { name: 'loadingStates', enabled: true, description: 'Test 1', rolloutPercentage: 100 },
        { name: 'errorHandling', enabled: false, description: 'Test 2', rolloutPercentage: 50 },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFlags,
    });

    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.flags.loadingStates).toBeDefined();
    expect(result.current.flags.loadingStates.enabled).toBe(true);
    expect(result.current.flags.errorHandling).toBeDefined();
    expect(result.current.flags.errorHandling.enabled).toBe(false);
  });

  it('should use cached flags initially', async () => {
    const cachedFlags = {
      loadingStates: { name: 'loadingStates', enabled: false, description: 'Cached', rolloutPercentage: 100 },
    };
    localStorage.setItem('featureFlags', JSON.stringify(cachedFlags));

    const mockFlags = {
      flags: [
        { name: 'loadingStates', enabled: true, description: 'Fresh', rolloutPercentage: 100 },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFlags,
    });

    const { result } = renderHook(() => useFeatureFlags());

    // Should show cached data immediately
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.flags.loadingStates.enabled).toBe(false);

    // Then update with fresh data
    await waitFor(() => {
      expect(result.current.flags.loadingStates.enabled).toBe(true);
    });
  });

  it('should handle fetch errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useFeatureFlags());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('Network error');
  });

  it('should cache fetched flags', async () => {
    const mockFlags = {
      flags: [
        { name: 'loadingStates', enabled: true, description: 'Test', rolloutPercentage: 100 },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFlags,
    });

    renderHook(() => useFeatureFlags());

    await waitFor(() => {
      const cached = localStorage.getItem('featureFlags');
      expect(cached).toBeTruthy();
    });

    const cached = JSON.parse(localStorage.getItem('featureFlags') || '{}');
    expect(cached.loadingStates).toBeDefined();
  });
});

describe('useFeatureFlagsMap', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearFeatureFlagsCache();
  });

  it('should initialize all flags as enabled', () => {
    const { result } = renderHook(() => 
      useFeatureFlagsMap(['loadingStates', 'errorHandling'])
    );

    expect(result.current.loadingStates).toBe(true);
    expect(result.current.errorHandling).toBe(true);
  });

  it('should load flags from cache', async () => {
    const cachedFlags = {
      loadingStates: { name: 'loadingStates', enabled: false, description: 'Test', rolloutPercentage: 100 },
      errorHandling: { name: 'errorHandling', enabled: true, description: 'Test', rolloutPercentage: 100 },
    };
    localStorage.setItem('featureFlags', JSON.stringify(cachedFlags));

    const { result } = renderHook(() => 
      useFeatureFlagsMap(['loadingStates', 'errorHandling'])
    );

    await waitFor(() => {
      expect(result.current.loadingStates).toBe(false);
      expect(result.current.errorHandling).toBe(true);
    });
  });

  it('should handle missing flags gracefully', async () => {
    const cachedFlags = {
      loadingStates: { name: 'loadingStates', enabled: false, description: 'Test', rolloutPercentage: 100 },
    };
    localStorage.setItem('featureFlags', JSON.stringify(cachedFlags));

    const { result } = renderHook(() => 
      useFeatureFlagsMap(['loadingStates', 'errorHandling'])
    );

    await waitFor(() => {
      expect(result.current.loadingStates).toBe(false);
      expect(result.current.errorHandling).toBe(true); // Default to true
    });
  });
});

describe('clearFeatureFlagsCache', () => {
  it('should clear localStorage cache', () => {
    localStorage.setItem('featureFlags', JSON.stringify({ test: 'data' }));
    expect(localStorage.getItem('featureFlags')).toBeTruthy();

    clearFeatureFlagsCache();
    expect(localStorage.getItem('featureFlags')).toBeNull();
  });
});
