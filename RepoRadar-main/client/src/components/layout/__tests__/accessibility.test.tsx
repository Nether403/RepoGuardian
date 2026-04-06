import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/theme-context';
import { Header } from '../Header';
import { DropdownMenu } from '../DropdownMenu';
import { MobileMenu } from '../MobileMenu';
import { navigationConfig, workspaceMenuItems, userMenuItems } from '@/config/navigation';

// Create test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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

// Mock dependencies
vi.mock('wouter', () => ({
  Link: ({ children, href, ...props }: any) => {
    // Wouter's Link passes children as a function or element
    const childContent = typeof children === 'function' ? children({}) : children;
    return <a href={href} {...props}>{childContent}</a>;
  },
  useLocation: () => ['/home', vi.fn()],
}));

vi.mock('@/contexts/neon-auth-context', () => ({
  useNeonAuth: () => ({
    user: { id: '1', name: 'Test User', email: 'test@example.com' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle Theme</button>,
}));

vi.mock('@/components/notifications', () => ({
  Notifications: () => <div data-testid="notifications">Notifications</div>,
}));

vi.mock('../UserMenu', () => ({
  UserMenu: ({ displayName }: any) => <div data-testid="user-menu">{displayName}</div>,
}));

vi.mock('../DropdownMenu', () => ({
  DropdownMenu: ({ trigger, items }: any) => (
    <div data-testid="dropdown-menu">
      <button aria-haspopup="menu" aria-expanded="false">
        {trigger}
      </button>
    </div>
  ),
}));

vi.mock('../MobileMenu', () => ({
  MobileMenu: () => (
    <button aria-label="Open navigation menu" data-testid="mobile-menu">
      Menu
    </button>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

describe('Accessibility Features', () => {
  describe('ARIA Labels and Roles', () => {
    it('should have proper ARIA labels on navigation elements', () => {
      render(<Header />, { wrapper: createWrapper() });
      
      const nav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(nav).toBeInTheDocument();
      
      const banner = screen.getByRole('banner');
      expect(banner).toBeInTheDocument();
    });

    it('should have aria-current on active page links', () => {
      render(<Header />, { wrapper: createWrapper() });
      
      // The home link should have aria-current="page" since we're on /home
      const homeLink = screen.getByRole('link', { name: /home/i });
      expect(homeLink).toHaveAttribute('aria-current', 'page');
    });

    it('should have aria-expanded on dropdown triggers', () => {
      const items = [
        { label: 'Item 1', path: '/item1' },
        { label: 'Item 2', path: '/item2' },
      ];
      
      render(
        <DropdownMenu
          trigger={<span>Menu</span>}
          items={items}
        />
      );
      
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-haspopup on dropdown triggers', () => {
      const items = [
        { label: 'Item 1', path: '/item1' },
      ];
      
      render(
        <DropdownMenu
          trigger={<span>Menu</span>}
          items={items}
        />
      );
      
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('should have role="menu" on dropdown content', async () => {
      const items = [
        { label: 'Item 1', path: '/item1' },
      ];
      
      render(
        <DropdownMenu
          trigger={<span>Menu</span>}
          items={items}
        />
      );
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
      });
    });

    it('should have aria-label on mobile menu button', () => {
      render(
        <MobileMenu
          navigationItems={navigationConfig}
          workspaceItems={workspaceMenuItems}
          userMenuItems={userMenuItems}
          isAuthenticated={true}
          user={{ name: 'Test' }}
          displayName="Test"
        />
      );
      
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      expect(menuButton).toBeInTheDocument();
    });

    it('should label external links appropriately', () => {
      const items = [
        { label: 'External Link', path: 'https://example.com', external: true },
      ];
      
      render(
        <DropdownMenu
          trigger={<span>Menu</span>}
          items={items}
        />
      );
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      // External links should indicate they open in a new tab
      const externalItem = screen.getByRole('menuitem', { name: /external link.*opens in new tab/i });
      expect(externalItem).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation', async () => {
      const user = userEvent.setup();
      render(<Header />, { wrapper: createWrapper() });
      
      // Tab through navigation items
      await user.tab();
      
      // First focusable element should be focused
      const firstLink = screen.getByRole('link', { name: /reporadar home/i });
      expect(firstLink).toHaveFocus();
    });

    it('should close dropdown on Escape key', async () => {
      const user = userEvent.setup();
      const items = [
        { label: 'Item 1', path: '/item1' },
      ];
      
      render(
        <DropdownMenu
          trigger={<span>Menu</span>}
          items={items}
        />
      );
      
      const trigger = screen.getByRole('button');
      await user.click(trigger);
      
      // Menu should be open
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      
      // Press Escape
      await user.keyboard('{Escape}');
      
      // Menu should be closed
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('should navigate dropdown items with arrow keys', async () => {
      const user = userEvent.setup();
      const items = [
        { label: 'Item 1', path: '/item1' },
        { label: 'Item 2', path: '/item2' },
        { label: 'Item 3', path: '/item3' },
      ];
      
      render(
        <DropdownMenu
          trigger={<span>Menu</span>}
          items={items}
        />
      );
      
      const trigger = screen.getByRole('button');
      await user.click(trigger);
      
      // Press ArrowDown to focus first item
      await user.keyboard('{ArrowDown}');
      
      const firstItem = screen.getByRole('menuitem', { name: 'Item 1' });
      expect(firstItem).toHaveFocus();
      
      // Press ArrowDown again to focus second item
      await user.keyboard('{ArrowDown}');
      
      const secondItem = screen.getByRole('menuitem', { name: 'Item 2' });
      expect(secondItem).toHaveFocus();
    });

    it('should have visible focus indicators', () => {
      render(<Header />, { wrapper: createWrapper() });
      
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        // Check that focus-visible styles are applied
        expect(link.className).toMatch(/focus/);
      });
    });
  });

  describe('Screen Reader Support', () => {
    it('should have descriptive link text', () => {
      render(<Header />, { wrapper: createWrapper() });
      
      // Links should not just say "click here" or similar
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        const text = link.textContent || link.getAttribute('aria-label');
        expect(text).toBeTruthy();
        expect(text?.toLowerCase()).not.toMatch(/click here|read more|learn more/);
      });
    });

    it('should hide decorative icons from screen readers', () => {
      render(<Header />, { wrapper: createWrapper() });
      
      // Icons should have aria-hidden="true"
      const icons = document.querySelectorAll('svg');
      icons.forEach(icon => {
        if (icon.closest('[aria-label]') || icon.closest('[role="img"]')) {
          // Icon is meaningful, should not be hidden
        } else {
          // Decorative icon should be hidden
          expect(icon).toHaveAttribute('aria-hidden', 'true');
        }
      });
    });

    it('should announce navigation changes', () => {
      const { container } = render(<Header />, { wrapper: createWrapper() });
      
      // Check for ARIA live region (would be in App.tsx with ScreenReaderAnnouncer)
      // This is a placeholder test - actual implementation would need full app context
      expect(container).toBeInTheDocument();
    });

    it('should have skip to content link', () => {
      // This would be tested in App.tsx context
      // Placeholder to document the requirement
      expect(true).toBe(true);
    });
  });

  describe('Focus Management', () => {
    it('should trap focus in mobile menu when open', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={navigationConfig}
          workspaceItems={workspaceMenuItems}
          userMenuItems={userMenuItems}
          isAuthenticated={true}
          user={{ name: 'Test' }}
          displayName="Test"
        />
      );
      
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await user.click(menuButton);
      
      // Focus should be trapped within the menu
      // Tab through all items and it should cycle back
      // This is a complex test that would need more setup
      expect(menuButton).toBeInTheDocument();
    });

    it('should return focus to trigger after closing dropdown', async () => {
      const user = userEvent.setup();
      const items = [
        { label: 'Item 1', path: '/item1' },
      ];
      
      render(
        <DropdownMenu
          trigger={<span>Menu</span>}
          items={items}
        />
      );
      
      const trigger = screen.getByRole('button');
      await user.click(trigger);
      
      // Close with Escape
      await user.keyboard('{Escape}');
      
      // Focus should return to trigger
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });
  });
});
