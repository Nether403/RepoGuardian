import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

/**
 * Component that announces page navigation changes to screen readers
 * Uses an ARIA live region to announce route changes
 */
export function ScreenReaderAnnouncer() {
  const [location] = useLocation();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    // Get page title or generate from route
    const getPageTitle = (path: string): string => {
      // Remove leading slash and split by /
      const segments = path.split('/').filter(Boolean);
      
      if (segments.length === 0) return 'Home page';
      
      // Convert kebab-case to Title Case
      const title = segments[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      return `${title} page`;
    };

    const pageTitle = getPageTitle(location);
    setAnnouncement(`Navigated to ${pageTitle}`);

    // Clear announcement after it's been read
    const timer = setTimeout(() => setAnnouncement(''), 1000);
    return () => clearTimeout(timer);
  }, [location]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
