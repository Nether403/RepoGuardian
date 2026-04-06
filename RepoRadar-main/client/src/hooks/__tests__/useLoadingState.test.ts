import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoadingState } from '../useLoadingState';

describe('useLoadingState', () => {
  it('initializes with idle status by default', () => {
    const { result } = renderHook(() => useLoadingState());
    
    expect(result.current.status).toBe('idle');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('initializes with custom status', () => {
    const { result } = renderHook(() => useLoadingState('loading'));
    
    expect(result.current.status).toBe('loading');
    expect(result.current.isLoading).toBe(true);
  });

  it('sets loading status correctly', () => {
    const { result } = renderHook(() => useLoadingState());
    
    act(() => {
      result.current.setLoading();
    });
    
    expect(result.current.status).toBe('loading');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('sets success status correctly', () => {
    const { result } = renderHook(() => useLoadingState());
    
    act(() => {
      result.current.setSuccess();
    });
    
    expect(result.current.status).toBe('success');
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('sets error status correctly', () => {
    const { result } = renderHook(() => useLoadingState());
    const testError = new Error('Test error');
    
    act(() => {
      result.current.setError(testError);
    });
    
    expect(result.current.status).toBe('error');
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(testError);
  });

  it('sets idle status correctly', () => {
    const { result } = renderHook(() => useLoadingState('loading'));
    
    act(() => {
      result.current.setIdle();
    });
    
    expect(result.current.status).toBe('idle');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('resets to initial status', () => {
    const { result } = renderHook(() => useLoadingState('idle'));
    
    act(() => {
      result.current.setLoading();
    });
    
    expect(result.current.status).toBe('loading');
    
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBe(null);
  });

  it('clears error when setting loading', () => {
    const { result } = renderHook(() => useLoadingState());
    const testError = new Error('Test error');
    
    act(() => {
      result.current.setError(testError);
    });
    
    expect(result.current.error).toBe(testError);
    
    act(() => {
      result.current.setLoading();
    });
    
    expect(result.current.error).toBe(null);
  });

  it('clears error when setting success', () => {
    const { result } = renderHook(() => useLoadingState());
    const testError = new Error('Test error');
    
    act(() => {
      result.current.setError(testError);
    });
    
    expect(result.current.error).toBe(testError);
    
    act(() => {
      result.current.setSuccess();
    });
    
    expect(result.current.error).toBe(null);
  });

  it('maintains stable function references', () => {
    const { result, rerender } = renderHook(() => useLoadingState());
    
    const initialSetLoading = result.current.setLoading;
    const initialSetSuccess = result.current.setSuccess;
    const initialSetError = result.current.setError;
    const initialReset = result.current.reset;
    
    rerender();
    
    expect(result.current.setLoading).toBe(initialSetLoading);
    expect(result.current.setSuccess).toBe(initialSetSuccess);
    expect(result.current.setError).toBe(initialSetError);
    expect(result.current.reset).toBe(initialReset);
  });
});
