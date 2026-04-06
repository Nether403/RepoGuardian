import { useState, useCallback, useRef, useEffect } from 'react';

export type AsyncOperationStatus = 'idle' | 'loading' | 'success' | 'error';

interface AsyncOperationState<T> {
  data: T | null;
  error: Error | null;
  status: AsyncOperationStatus;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isIdle: boolean;
}

interface UseAsyncOperationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  retryCount?: number;
  retryDelay?: number;
}

interface UseAsyncOperationReturn<T, Args extends any[]> extends AsyncOperationState<T> {
  execute: (...args: Args) => Promise<T | null>;
  reset: () => void;
  retry: () => Promise<T | null>;
}

/**
 * Hook for managing async operations with automatic loading state management
 * 
 * @example
 * const { execute, isLoading, data, error } = useAsyncOperation(
 *   async (repoUrl: string) => {
 *     return await analyzeRepository(repoUrl);
 *   },
 *   {
 *     onSuccess: (data) => console.log('Analysis complete', data),
 *     onError: (error) => console.error('Analysis failed', error),
 *   }
 * );
 * 
 * // Later in your component
 * await execute('https://github.com/user/repo');
 */
export function useAsyncOperation<T, Args extends any[]>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncOperationOptions = {}
): UseAsyncOperationReturn<T, Args> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<AsyncOperationStatus>('idle');
  
  const lastArgsRef = useRef<Args | null>(null);
  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);

  const {
    onSuccess,
    onError,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const executeWithRetry = useCallback(
    async (...args: Args): Promise<T | null> => {
      lastArgsRef.current = args;
      setStatus('loading');
      setError(null);

      const attemptExecution = async (attemptNumber: number): Promise<T | null> => {
        try {
          const result = await asyncFunction(...args);
          
          if (!mountedRef.current) return null;
          
          setData(result);
          setStatus('success');
          retryCountRef.current = 0;
          
          if (onSuccess) {
            onSuccess(result);
          }
          
          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          
          if (!mountedRef.current) return null;

          // Retry logic
          if (attemptNumber < retryCount) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attemptNumber)));
            return attemptExecution(attemptNumber + 1);
          }
          
          setError(error);
          setStatus('error');
          retryCountRef.current = 0;
          
          if (onError) {
            onError(error);
          }
          
          return null;
        }
      };

      return attemptExecution(0);
    },
    [asyncFunction, onSuccess, onError, retryCount, retryDelay]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setStatus('idle');
    lastArgsRef.current = null;
    retryCountRef.current = 0;
  }, []);

  const retry = useCallback(async (): Promise<T | null> => {
    if (lastArgsRef.current === null) {
      console.warn('Cannot retry: no previous arguments stored');
      return null;
    }
    return executeWithRetry(...lastArgsRef.current);
  }, [executeWithRetry]);

  return {
    data,
    error,
    status,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    isIdle: status === 'idle',
    execute: executeWithRetry,
    reset,
    retry,
  };
}
