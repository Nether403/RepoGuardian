/**
 * Client-side analytics utility for tracking user events
 */

// Generate or retrieve session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  
  return sessionId;
}

// Check if user has opted out of analytics
function hasOptedOut(): boolean {
  return localStorage.getItem('analytics_opt_out') === 'true';
}

/**
 * Track an analytics event
 */
export async function trackEvent(
  name: string,
  category: string,
  properties?: Record<string, any>
): Promise<void> {
  // Don't track if user has opted out
  if (hasOptedOut()) {
    return;
  }

  try {
    const sessionId = getSessionId();
    
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
      body: JSON.stringify({
        name,
        category,
        properties: properties || {},
      }),
    });
  } catch (error) {
    // Silently fail - don't disrupt user experience
    console.debug('Analytics tracking failed:', error);
  }
}

/**
 * Track a page view
 */
export async function trackPageView(page: string, metadata?: Record<string, any>): Promise<void> {
  await trackEvent('page_view', 'navigation', {
    page,
    ...metadata,
  });
}

/**
 * Track repository analysis
 */
export async function trackRepositoryAnalysis(
  repositoryUrl: string,
  success: boolean,
  metadata?: Record<string, any>
): Promise<void> {
  await trackEvent('repository_analysis', 'analysis', {
    repositoryUrl,
    success,
    ...metadata,
  });
}

/**
 * Track search query
 */
export async function trackSearch(
  query: string,
  resultCount: number,
  metadata?: Record<string, any>
): Promise<void> {
  await trackEvent('search_query', 'search', {
    query,
    resultCount,
    ...metadata,
  });
}

/**
 * Track data export
 */
export async function trackExport(
  format: string,
  dataType: string,
  success: boolean,
  metadata?: Record<string, any>
): Promise<void> {
  await trackEvent('data_export', 'export', {
    format,
    dataType,
    success,
    ...metadata,
  });
}

/**
 * Track error
 */
export async function trackError(
  error: Error,
  context?: Record<string, any>
): Promise<void> {
  await trackEvent('error_occurred', 'error', {
    errorMessage: error.message,
    errorName: error.name,
    errorStack: error.stack?.split('\n').slice(0, 3).join('\n'),
    ...context,
  });
}

/**
 * Opt out of analytics tracking
 */
export function optOutOfAnalytics(): void {
  localStorage.setItem('analytics_opt_out', 'true');
  sessionStorage.removeItem('analytics_session_id');
}

/**
 * Opt in to analytics tracking
 */
export function optInToAnalytics(): void {
  localStorage.removeItem('analytics_opt_out');
}

/**
 * Check if user has opted out
 */
export function isOptedOut(): boolean {
  return hasOptedOut();
}
