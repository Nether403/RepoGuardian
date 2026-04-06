import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  trackEvent,
  trackPageView,
  trackRepositoryAnalysis,
  trackSearch,
  trackExport,
  trackError,
  optOutOfAnalytics,
  optInToAnalytics,
  isOptedOut,
} from '../analytics';

// Mock fetch
global.fetch = vi.fn();

describe('Analytics Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('trackEvent', () => {
    it('should send analytics event to server', async () => {
      await trackEvent('test_event', 'test_category', { key: 'value' });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/track',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('test_event'),
        })
      );
    });

    it('should include session ID in headers', async () => {
      await trackEvent('test_event', 'test_category');

      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers;
      
      expect(headers['X-Session-Id']).toBeDefined();
      expect(headers['X-Session-Id']).toMatch(/^session_/);
    });

    it('should reuse session ID across calls', async () => {
      await trackEvent('event1', 'category1');
      await trackEvent('event2', 'category2');

      const call1Headers = (global.fetch as any).mock.calls[0][1].headers;
      const call2Headers = (global.fetch as any).mock.calls[1][1].headers;

      expect(call1Headers['X-Session-Id']).toBe(call2Headers['X-Session-Id']);
    });

    it('should not track if user has opted out', async () => {
      optOutOfAnalytics();

      await trackEvent('test_event', 'test_category');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fail silently on network error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await expect(trackEvent('test_event', 'test_category')).resolves.toBeUndefined();
    });
  });

  describe('trackPageView', () => {
    it('should track page view with correct category', async () => {
      await trackPageView('/test-page', { referrer: 'google' });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.name).toBe('page_view');
      expect(body.category).toBe('navigation');
      expect(body.properties.page).toBe('/test-page');
      expect(body.properties.referrer).toBe('google');
    });
  });

  describe('trackRepositoryAnalysis', () => {
    it('should track successful analysis', async () => {
      await trackRepositoryAnalysis(
        'https://github.com/owner/repo',
        true,
        { language: 'TypeScript' }
      );

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.name).toBe('repository_analysis');
      expect(body.category).toBe('analysis');
      expect(body.properties.repositoryUrl).toBe('https://github.com/owner/repo');
      expect(body.properties.success).toBe(true);
      expect(body.properties.language).toBe('TypeScript');
    });

    it('should track failed analysis', async () => {
      await trackRepositoryAnalysis(
        'https://github.com/owner/repo',
        false,
        { errorMessage: 'Not found' }
      );

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.properties.success).toBe(false);
      expect(body.properties.errorMessage).toBe('Not found');
    });
  });

  describe('trackSearch', () => {
    it('should track search query with result count', async () => {
      await trackSearch('react hooks', 42, { filters: { language: 'JavaScript' } });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.name).toBe('search_query');
      expect(body.category).toBe('search');
      expect(body.properties.query).toBe('react hooks');
      expect(body.properties.resultCount).toBe(42);
      expect(body.properties.filters).toEqual({ language: 'JavaScript' });
    });
  });

  describe('trackExport', () => {
    it('should track successful export', async () => {
      await trackExport('pdf', 'analysis', true, { repositoryName: 'test-repo' });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.name).toBe('data_export');
      expect(body.category).toBe('export');
      expect(body.properties.format).toBe('pdf');
      expect(body.properties.dataType).toBe('analysis');
      expect(body.properties.success).toBe(true);
      expect(body.properties.repositoryName).toBe('test-repo');
    });

    it('should track failed export', async () => {
      await trackExport('csv', 'batch', false, { errorMessage: 'File too large' });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.properties.success).toBe(false);
      expect(body.properties.errorMessage).toBe('File too large');
    });
  });

  describe('trackError', () => {
    it('should track error with stack trace', async () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at line1\n  at line2\n  at line3\n  at line4';

      await trackError(error, { component: 'TestComponent' });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.name).toBe('error_occurred');
      expect(body.category).toBe('error');
      expect(body.properties.errorMessage).toBe('Test error');
      expect(body.properties.errorName).toBe('Error');
      expect(body.properties.component).toBe('TestComponent');
      // Should only include first 3 lines of stack
      expect(body.properties.errorStack.split('\n').length).toBeLessThanOrEqual(3);
    });
  });

  describe('Opt-out functionality', () => {
    it('should opt out of analytics', () => {
      optOutOfAnalytics();

      expect(isOptedOut()).toBe(true);
      expect(localStorage.getItem('analytics_opt_out')).toBe('true');
      expect(sessionStorage.getItem('analytics_session_id')).toBeNull();
    });

    it('should opt in to analytics', () => {
      optOutOfAnalytics();
      optInToAnalytics();

      expect(isOptedOut()).toBe(false);
      expect(localStorage.getItem('analytics_opt_out')).toBeNull();
    });

    it('should not track events when opted out', async () => {
      optOutOfAnalytics();

      await trackEvent('test_event', 'test_category');
      await trackPageView('/test');
      await trackSearch('query', 10);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should resume tracking after opting back in', async () => {
      optOutOfAnalytics();
      optInToAnalytics();

      await trackEvent('test_event', 'test_category');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Session management', () => {
    it('should generate session ID on first call', async () => {
      expect(sessionStorage.getItem('analytics_session_id')).toBeNull();

      await trackEvent('test_event', 'test_category');

      expect(sessionStorage.getItem('analytics_session_id')).toBeDefined();
    });

    it('should persist session ID in sessionStorage', async () => {
      await trackEvent('event1', 'category1');
      const sessionId1 = sessionStorage.getItem('analytics_session_id');

      await trackEvent('event2', 'category2');
      const sessionId2 = sessionStorage.getItem('analytics_session_id');

      expect(sessionId1).toBe(sessionId2);
    });

    it('should clear session ID on opt-out', () => {
      sessionStorage.setItem('analytics_session_id', 'test-session');

      optOutOfAnalytics();

      expect(sessionStorage.getItem('analytics_session_id')).toBeNull();
    });
  });
});
