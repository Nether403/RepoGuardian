import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from '../Header';
import { useNeonAuth } from '@/contexts/neon-auth-context';

// Mock the dependencies
vi.mock('wouter', () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
  useLocation: vi.fn(() => ['/home', vi.fn()]),
}));

vi.mock('@/contexts/neon-auth-context', () => ({
  useNeonAuth: vi.fn(),
}));

vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

vi.mock('@/components/notifications', () => ({
  Notifications: () => <div data-testid="notifications">Notifications</div>,
}));

vi.mock('../DropdownMenu', () => ({
  DropdownMenu: ({ trigger }: any) => <div>{trigger}</div>,
}));

vi.mock('../MobileMenu', () => ({
  MobileMenu: () => <button aria-label="Open menu">Menu</button>,
}));

vi.mock('../UserMenu', () => ({
  UserMenu: ({ displayName }: any) => <div>{displayName}</div>,
}));

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with correct navigation items for authenticated users', () => {
    vi.mocked(useNeonAuth).mockReturnValue({
      user: { id: '1', email: 'test@example.com', name: 'Test User' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    render(<Header />);

    // Check that the logo is rendered
    expect(screen.getByLabelText('RepoRadar home')).toBeInTheDocument();

    // Check that main navigation items are present
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Discover')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });

  it('handles authentication state correctly for unauthenticated users', () => {
    vi.mocked(useNeonAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    render(<Header />);

    // Check that Sign In button is present
    expect(screen.getByText('Sign In')).toBeInTheDocument();

    // Check that Home link is not present (requires auth)
    expect(screen.queryByText('Home')).not.toBeInTheDocument();

    // Check that Workspace is not present (requires auth)
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
  });

  it('displays user information when authenticated', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      profileImageUrl: 'https://example.com/avatar.jpg',
    };

    vi.mocked(useNeonAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    render(<Header />);

    // Check that user name is displayed
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    vi.mocked(useNeonAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    render(<Header />);

    // When loading, user menu and sign in button should not be rendered
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
  });

  it('applies fixed positioning styles', () => {
    vi.mocked(useNeonAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    const { container } = render(<Header />);
    const header = container.querySelector('header');

    expect(header).toHaveClass('fixed');
    expect(header).toHaveClass('top-0');
    expect(header).toHaveClass('z-50');
  });

  it('highlights active route correctly', () => {
    vi.mocked(useNeonAuth).mockReturnValue({
      user: { id: '1', email: 'test@example.com', name: 'Test User' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    render(<Header />);

    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('aria-current', 'page');
  });

  it('renders mobile menu on small screens', () => {
    vi.mocked(useNeonAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    render(<Header />);

    // Mobile menu should be present (though hidden on desktop via CSS)
    const mobileMenuTrigger = screen.getByLabelText('Open menu');
    expect(mobileMenuTrigger).toBeInTheDocument();
  });
});
