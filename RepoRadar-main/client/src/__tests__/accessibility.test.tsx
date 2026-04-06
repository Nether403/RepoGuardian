import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/theme-context';
import Home from '@/pages/home';
import Search from '@/pages/search';
import { Header } from '@/components/layout/Header';
import { SkipLink } from '@/components/skip-link';

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profileImageUrl: null,
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock wouter
vi.mock('wouter', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ['/', vi.fn()],
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
};

describe('Accessibility Tests', () => {
  beforeEach(() => {
    // Clear any previous DOM state
    document.body.innerHTML = '';
  });

  describe('SkipLink', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<SkipLink />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Header', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<Header />, { wrapper: createWrapper() });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper landmark roles', () => {
      const { container } = render(<Header />, { wrapper: createWrapper() });
      const header = container.querySelector('header');
      expect(header).toHaveAttribute('role', 'banner');
      
      const nav = container.querySelector('nav');
      expect(nav).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('has accessible images with alt text', () => {
      const { container } = render(<Header />, { wrapper: createWrapper() });
      const images = container.querySelectorAll('img');
      images.forEach((img) => {
        expect(img).toHaveAttribute('alt');
        expect(img.getAttribute('alt')).not.toBe('');
      });
    });
  });

  describe('Home Page', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<Home />, { wrapper: createWrapper() });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has main content landmark', () => {
      const { container } = render(<Home />, { wrapper: createWrapper() });
      const main = container.querySelector('main');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('id', 'main-content');
      expect(main).toHaveAttribute('role', 'main');
    });
  });

  describe('Search Page', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<Search />, { wrapper: createWrapper() });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has main content landmark', () => {
      const { container } = render(<Search />, { wrapper: createWrapper() });
      const main = container.querySelector('main');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('id', 'main-content');
    });

    it('has accessible form inputs', () => {
      const { container } = render(<Search />, { wrapper: createWrapper() });
      const inputs = container.querySelectorAll('input');
      inputs.forEach((input) => {
        // Each input should have either a label, aria-label, or aria-labelledby
        const hasLabel = input.labels && input.labels.length > 0;
        const hasAriaLabel = input.hasAttribute('aria-label');
        const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
        const hasPlaceholder = input.hasAttribute('placeholder');
        
        expect(
          hasLabel || hasAriaLabel || hasAriaLabelledBy || hasPlaceholder
        ).toBe(true);
      });
    });
  });

  describe('Focus Management', () => {
    it('all interactive elements are keyboard accessible', () => {
      const { container } = render(<Header />, { wrapper: createWrapper() });
      
      const interactiveElements = container.querySelectorAll(
        'button, a, input, select, textarea, [tabindex]'
      );
      
      interactiveElements.forEach((element) => {
        const tabIndex = element.getAttribute('tabindex');
        // Elements should not have tabindex="-1" unless they're intentionally removed from tab order
        if (tabIndex === '-1') {
          // This is okay for elements that are programmatically focused
          return;
        }
        // All other interactive elements should be in the tab order
        expect(tabIndex === null || parseInt(tabIndex) >= 0).toBe(true);
      });
    });

    it('buttons have accessible names', () => {
      const { container } = render(<Header />, { wrapper: createWrapper() });
      const buttons = container.querySelectorAll('button');
      
      buttons.forEach((button) => {
        const hasTextContent = button.textContent && button.textContent.trim().length > 0;
        const hasAriaLabel = button.hasAttribute('aria-label');
        const hasAriaLabelledBy = button.hasAttribute('aria-labelledby');
        
        expect(hasTextContent || hasAriaLabel || hasAriaLabelledBy).toBe(true);
      });
    });
  });

  describe('Color Contrast', () => {
    it('should pass color contrast checks', async () => {
      const { container } = render(<Header />, { wrapper: createWrapper() });
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      expect(results).toHaveNoViolations();
    });
  });

  describe('ARIA Attributes', () => {
    it('uses valid ARIA attributes', async () => {
      const { container } = render(<Header />, { wrapper: createWrapper() });
      const results = await axe(container, {
        rules: {
          'aria-valid-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
        },
      });
      expect(results).toHaveNoViolations();
    });

    it('decorative icons have aria-hidden', () => {
      const { container } = render(<Header />, { wrapper: createWrapper() });
      const icons = container.querySelectorAll('i.fas, i.fab');
      
      icons.forEach((icon) => {
        // Icons should either have aria-hidden or be inside an element with accessible text
        const hasAriaHidden = icon.getAttribute('aria-hidden') === 'true';
        const parentHasText = icon.parentElement?.textContent && 
                             icon.parentElement.textContent.trim().length > 0;
        
        expect(hasAriaHidden || parentHasText).toBe(true);
      });
    });
  });
});
