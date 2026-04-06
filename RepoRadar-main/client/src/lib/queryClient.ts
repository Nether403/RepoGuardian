import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { parseApiError, isRetryableError } from "./error-handling";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Try to parse JSON error response
    try {
      const errorData = JSON.parse(text);
      const error = parseApiError(errorData);
      throw error;
    } catch {
      // If not JSON, throw with status and text
      throw new Error(`${res.status}: ${text}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Set longer timeout for analysis endpoints (5 minutes)
  const isAnalysisEndpoint = url.includes('/analyze') || url.includes('/batch-analyze');
  const timeout = isAnalysisEndpoint ? 300000 : 30000; // 5 min for analysis, 30 sec for others
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout / 1000} seconds. The analysis may take longer for large repositories.`);
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes default
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && error.message.includes('401')) return false;
        if (error instanceof Error && error.message.includes('403')) return false;
        if (error instanceof Error && error.message.includes('404')) return false;
        if (error instanceof Error && error.message.includes('400')) return false;
        
        // Use error handling utility to determine if retryable
        if (!isRetryableError(error)) return false;
        
        // Retry up to 3 times for retryable errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => {
        // Exponential backoff: 1s, 2s, 4s, max 30s
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on client errors (4xx)
        if (error instanceof Error) {
          const message = error.message.toLowerCase();
          if (message.includes('400') || message.includes('401') || 
              message.includes('403') || message.includes('404')) {
            return false;
          }
        }
        
        // Use error handling utility to determine if retryable
        if (!isRetryableError(error)) return false;
        
        // Retry once for retryable errors (mutations are more sensitive)
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => {
        // Exponential backoff for mutations: 1s, 2s
        return Math.min(1000 * 2 ** attemptIndex, 5000);
      },
    },
  },
});
