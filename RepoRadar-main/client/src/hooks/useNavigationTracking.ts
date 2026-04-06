import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

interface NavigationEvent {
  from: string;
  to: string;
  type: 'header_nav' | 'dropdown' | 'sidebar' | 'breadcrumb' | 'external';
  timestamp: number;
}

interface DocEvent {
  category: string;
  title: string;
  path: string;
  timestamp: number;
}

interface SearchEvent {
  query: string;
  resultsCount: number;
  timestamp: number;
}

interface ExternalLinkEvent {
  url: string;
  label: string;
  timestamp: number;
}

// Analytics tracking utility
class NavigationAnalytics {
  private static instance: NavigationAnalytics;
  private events: NavigationEvent[] = [];
  private docViews: DocEvent[] = [];
  private searches: SearchEvent[] = [];
  private externalLinks: ExternalLinkEvent[] = [];

  private constructor() {}

  static getInstance(): NavigationAnalytics {
    if (!NavigationAnalytics.instance) {
      NavigationAnalytics.instance = new NavigationAnalytics();
    }
    return NavigationAnalytics.instance;
  }

  trackNavigation(from: string, to: string, type: NavigationEvent['type']) {
    const event: NavigationEvent = {
      from,
      to,
      type,
      timestamp: Date.now(),
    };
    
    this.events.push(event);
    
    // Send to analytics service (if configured)
    this.sendToAnalytics('navigation_click', event);
    
    // Log in development
    if (import.meta.env.DEV) {
      console.log('[Navigation Analytics]', event);
    }
  }

  trackDocView(category: string, title: string, path: string) {
    const event: DocEvent = {
      category,
      title,
      path,
      timestamp: Date.now(),
    };
    
    this.docViews.push(event);
    
    // Send to analytics service
    this.sendToAnalytics('docs_view', event);
    
    // Log in development
    if (import.meta.env.DEV) {
      console.log('[Doc View Analytics]', event);
    }
  }

  trackSearch(query: string, resultsCount: number) {
    const event: SearchEvent = {
      query,
      resultsCount,
      timestamp: Date.now(),
    };
    
    this.searches.push(event);
    
    // Send to analytics service
    this.sendToAnalytics('docs_search', event);
    
    // Log in development
    if (import.meta.env.DEV) {
      console.log('[Search Analytics]', event);
    }
  }

  trackExternalLink(url: string, label: string) {
    const event: ExternalLinkEvent = {
      url,
      label,
      timestamp: Date.now(),
    };
    
    this.externalLinks.push(event);
    
    // Send to analytics service
    this.sendToAnalytics('external_link_click', event);
    
    // Log in development
    if (import.meta.env.DEV) {
      console.log('[External Link Analytics]', event);
    }
  }

  private async sendToAnalytics(eventType: string, data: any) {
    try {
      // Send to backend analytics endpoint
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType,
          data,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      // Silently fail - don't disrupt user experience
      if (import.meta.env.DEV) {
        console.error('Analytics tracking error:', error);
      }
    }
  }

  getEvents() {
    return {
      navigation: this.events,
      docViews: this.docViews,
      searches: this.searches,
      externalLinks: this.externalLinks,
    };
  }

  clearEvents() {
    this.events = [];
    this.docViews = [];
    this.searches = [];
    this.externalLinks = [];
  }
}

export const analytics = NavigationAnalytics.getInstance();

// Hook for tracking navigation changes
export function useNavigationTracking() {
  const [location] = useLocation();
  const previousLocation = usePrevious(location);

  useEffect(() => {
    if (previousLocation && previousLocation !== location) {
      analytics.trackNavigation(previousLocation, location, 'header_nav');
    }
  }, [location, previousLocation]);
}

// Hook for tracking documentation views
export function useDocTracking(category: string, title: string, path: string) {
  useEffect(() => {
    analytics.trackDocView(category, title, path);
  }, [category, title, path]);
}

// Helper hook to get previous value
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}
