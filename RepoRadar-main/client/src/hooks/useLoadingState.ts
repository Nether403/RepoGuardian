import { useState, useCallback } from 'react';

export type LoadingStatus = 'idle' | 'loading' | 'success' | 'error';

interface LoadingState {
  status: LoadingStatus;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
}

interface UseLoadingStateReturn extends LoadingState {
  setLoading: () => void;
  setSuccess: () => void;
  setError: (error: Error) => void;
  setIdle: () => void;
  reset: () => void;
}

/**
 * Hook for managing loading states with status tracking
 * 
 * @example
 * const { isLoading, setLoading, setSuccess, setError } = useLoadingState();
 * 
 * const fetchData = async () => {
 *   setLoading();
 *   try {
 *     const data = await api.fetch();
 *     setSuccess();
 *   } catch (error) {
 *     setError(error);
 *   }
 * };
 */
export function useLoadingState(initialStatus: LoadingStatus = 'idle'): UseLoadingStateReturn {
  const [status, setStatus] = useState<LoadingStatus>(initialStatus);
  const [error, setErrorState] = useState<Error | null>(null);

  const setLoading = useCallback(() => {
    setStatus('loading');
    setErrorState(null);
  }, []);

  const setSuccess = useCallback(() => {
    setStatus('success');
    setErrorState(null);
  }, []);

  const setError = useCallback((error: Error) => {
    setStatus('error');
    setErrorState(error);
  }, []);

  const setIdle = useCallback(() => {
    setStatus('idle');
    setErrorState(null);
  }, []);

  const reset = useCallback(() => {
    setStatus(initialStatus);
    setErrorState(null);
  }, [initialStatus]);

  return {
    status,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    isIdle: status === 'idle',
    setLoading,
    setSuccess,
    setError,
    setIdle,
    reset,
  };
}
