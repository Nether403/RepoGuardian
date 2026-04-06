/**
 * React Hook for Feature Flags
 * 
 * Provides client-side access to feature flags
 */

import { useState, useEffect, useCallback } from 'react';
import type { FeatureFlagName, FeatureFlag } from '../../../shared/featureFlags';

interface FeatureFlagsState {
  flags: Record<string, FeatureFlag>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to check if a feature is enabled
 */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  const [enabled, setEnabled] = useState(true); // Default to enabled

  useEffect(() => {
    // Check feature flag from API or local storage
    const checkFlag = async () => {
      try {
        // First check localStorage for cached flags
        const cachedFlags = localStorage.getItem('featureFlags');
        if (cachedFlags) {
          const flags = JSON.parse(cachedFlags);
          if (flags[flagName] !== undefined) {
            setEnabled(flags[flagName].enabled);
            return;
          }
        }

        // Fetch from API if not cached
        const response = await fetch('/api/feature-flags');
        if (response.ok) {
          const data = await response.json();
          const flagsMap = data.flags.reduce((acc: Record<string, FeatureFlag>, flag: FeatureFlag) => {
            acc[flag.name] = flag;
            return acc;
          }, {});
          
          // Cache in localStorage
          localStorage.setItem('featureFlags', JSON.stringify(flagsMap));
          
          if (flagsMap[flagName]) {
            setEnabled(flagsMap[flagName].enabled);
          }
        }
      } catch (error) {
        console.error('Failed to fetch feature flags:', error);
        // Default to enabled on error
        setEnabled(true);
      }
    };

    checkFlag();
  }, [flagName]);

  return enabled;
}

/**
 * Hook to get all feature flags
 */
export function useFeatureFlags(): FeatureFlagsState {
  const [state, setState] = useState<FeatureFlagsState>({
    flags: {},
    loading: true,
    error: null,
  });

  const fetchFlags = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Check cache first
      const cachedFlags = localStorage.getItem('featureFlags');
      if (cachedFlags) {
        const flags = JSON.parse(cachedFlags);
        setState({ flags, loading: false, error: null });
      }

      // Fetch fresh data
      const response = await fetch('/api/feature-flags');
      if (!response.ok) {
        throw new Error('Failed to fetch feature flags');
      }

      const data = await response.json();
      const flagsMap = data.flags.reduce((acc: Record<string, FeatureFlag>, flag: FeatureFlag) => {
        acc[flag.name] = flag;
        return acc;
      }, {});

      // Update cache
      localStorage.setItem('featureFlags', JSON.stringify(flagsMap));

      setState({ flags: flagsMap, loading: false, error: null });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  return state;
}

/**
 * Hook to check multiple feature flags at once
 */
export function useFeatureFlagsMap(flagNames: FeatureFlagName[]): Record<FeatureFlagName, boolean> {
  const [flagsMap, setFlagsMap] = useState<Record<FeatureFlagName, boolean>>(() => {
    // Initialize with all flags enabled
    return flagNames.reduce((acc, name) => {
      acc[name] = true;
      return acc;
    }, {} as Record<FeatureFlagName, boolean>);
  });

  useEffect(() => {
    const checkFlags = async () => {
      try {
        const cachedFlags = localStorage.getItem('featureFlags');
        if (cachedFlags) {
          const flags = JSON.parse(cachedFlags);
          const newMap = flagNames.reduce((acc, name) => {
            acc[name] = flags[name]?.enabled ?? true;
            return acc;
          }, {} as Record<FeatureFlagName, boolean>);
          setFlagsMap(newMap);
        }
      } catch (error) {
        console.error('Failed to check feature flags:', error);
      }
    };

    checkFlags();
  }, [flagNames]);

  return flagsMap;
}

/**
 * Clear feature flags cache
 */
export function clearFeatureFlagsCache(): void {
  localStorage.removeItem('featureFlags');
}
