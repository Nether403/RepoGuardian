import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsyncOperation } from '../useAsyncOperation';

describe('useAsyncOperation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes with idle status', () => {
    const asyncFn = vi.fn().mockResolvedValue('result');
    const { result } = renderHook(() => useAsyncOperation(asyncFn));
    
    expect(result.current.status).toBe('idle');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('executes async function successfully', async () => {
    const asyncFn = vi.fn().mockResolvedValue('success data');
    const { result } = renderHook(() => useAsyncOperation(asyncFn));
    
    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute('arg1', 'arg2');
    });
    
    expect(result.current.status).toBe('loading');
    expect(result.current.isLoading).toBe(true);
    
    await act(async () => {
      await promise;
    });
    
    expect(result.current.status).toBe('success');
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toBe('success data');
    expect(result.current.error).toBe(null);
    expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('handles async function errors', async () => {
    const testError = new Error('Test error');
    const asyncFn = vi.fn().mockRejectedValue(testError);
    const { result } = renderHook(() => useAsyncOperation(asyncFn));
    
    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute();
    });
    
    await act(async () => {
      await promise;
    });
    
    expect(result.current.status).toBe('error');
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(testError);
    expect(result.current.data).toBe(null);
  });

  it('calls onSuccess callback', async () => {
    const asyncFn = vi.fn().mockResolvedValue('success');
    const onSuccess = vi.fn();
    const { result } = renderHook(() => 
      useAsyncOperation(asyncFn, { onSuccess })
    );
    
    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute();
    });
    
    await act(async () => {
      await promise;
    });
    
    expect(onSuccess).toHaveBeenCalledWith('success');
  });

  it('calls onError callback', async () => {
    const testError = new Error('Test error');
    const asyncFn = vi.fn().mockRejectedValue(testError);
    const onError = vi.fn();
    const { result } = renderHook(() => 
      useAsyncOperation(asyncFn, { onError })
    );
    
    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute();
    });
    
    await act(async () => {
      await promise;
    });
    
    expect(onError).toHaveBeenCalledWith(testError);
  });

  it('resets state correctly', async () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsyncOperation(asyncFn));
    
    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute();
    });
    
    await act(async () => {
      await promise;
    });
    
    expect(result.current.data).toBe('data');
    
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('retries with last arguments', async () => {
    const asyncFn = vi.fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce('success');
    
    const { result } = renderHook(() => useAsyncOperation(asyncFn));
    
    // First execution fails
    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute('arg1', 'arg2');
    });
    
    await act(async () => {
      await promise;
    });
    
    expect(result.current.isError).toBe(true);
    
    // Retry with same arguments
    act(() => {
      promise = result.current.retry();
    });
    
    await act(async () => {
      await promise;
    });
    
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toBe('success');
    expect(asyncFn).toHaveBeenCalledTimes(2);
    expect(asyncFn).toHaveBeenLastCalledWith('arg1', 'arg2');
  });

  it('handles retry without previous execution', async () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsyncOperation(asyncFn));
    
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    let retryResult: unknown;
    await act(async () => {
      retryResult = await result.current.retry();
    });
    
    expect(retryResult).toBe(null);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Cannot retry: no previous arguments stored'
    );
    
    consoleWarnSpy.mockRestore();
  });

  it('retries on failure with exponential backoff', async () => {
    let callCount = 0;
    const asyncFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error('Retry error'));
      }
      return Promise.resolve('success after retries');
    });
    
    const { result } = renderHook(() => 
      useAsyncOperation(asyncFn, { 
        retryCount: 2,
        retryDelay: 1000 
      })
    );
    
    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute();
    });
    
    // Fast-forward through retry delays
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // First retry
      await vi.advanceTimersByTimeAsync(2000); // Second retry (exponential)
      await promise;
    });
    
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toBe('success after retries');
    expect(asyncFn).toHaveBeenCalledTimes(3);
  });

  it('stops retrying after max attempts', async () => {
    const asyncFn = vi.fn().mockRejectedValue(new Error('Persistent error'));
    const { result } = renderHook(() => 
      useAsyncOperation(asyncFn, { 
        retryCount: 2,
        retryDelay: 1000 
      })
    );
    
    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute();
    });
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await promise;
    });
    
    expect(result.current.isError).toBe(true);
    expect(asyncFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('handles unmount during execution', async () => {
    const asyncFn = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('data'), 1000))
    );
    
    const { result, unmount } = renderHook(() => useAsyncOperation(asyncFn));
    
    act(() => {
      result.current.execute();
    });
    
    unmount();
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    
    // Should not throw or update state after unmount
    expect(asyncFn).toHaveBeenCalled();
  });

  it('converts non-Error objects to Error', async () => {
    const asyncFn = vi.fn().mockRejectedValue('string error');
    const { result } = renderHook(() => useAsyncOperation(asyncFn));
    
    let promise: Promise<any>;
    act(() => {
      promise = result.current.execute();
    });
    
    await act(async () => {
      await promise;
    });
    
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });
});
