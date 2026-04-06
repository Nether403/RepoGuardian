import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileMenu } from '../MobileMenu';
import { useNeonAuth } from '@/contexts/neon-auth-context';
import type { NavigationItem } from '@/config/navigation';
import { Home, Search, BarChart3, BookOpen, User, Settings } from 'lucide-react';

// Mock the dependencies
vi.mock('wouter', () => ({
  Link: ({ children, href }: any) => {
    // Wouter Link uses render props pattern - children is a function
    const child = typeof children === 'function' ? children({ href, navigate: vi.fn() }) : children;
    return <div data-testid="wouter-link">{child}</div>;
  },
  useLocation: vi.fn(() => ['/home', vi.fn()]),
}));

vi.mock('@/contexts/neon-auth-context', () => ({
  useNeonAuth: vi.fn(),
}));

vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

// Mock shadcn/ui components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open, onOpenChange }: any) => (
    <div data-testid="sheet" data-open={open}>
      {children}
    </div>
  ),
  SheetTrigger: ({ children, asChild }: any) => (
    <div data-testid="sheet-trigger">{children}</div>
  ),
  SheetContent: ({ children }: any) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: any) => (
    <div data-testid="sheet-header">{children}</div>
  ),
  SheetTitle: ({ children }: any) => (
    <div data-testid="sheet-title">{children}</div>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open, onOpenChange }: any) => (
    <div data-testid="collapsible" data-open={open} onClick={() => onOpenChange?.(!open)}>
      {children}
    </div>
  ),
  CollapsibleTrigger: ({ children }: any) => (
    <button data-testid="collapsible-trigger">{children}</button>
  ),
  CollapsibleContent: ({ children }: any) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
    Menu: () => <span data-testid="menu-icon">Menu</span>,
    ChevronDown: () => <span data-testid="chevron-down-icon">ChevronDown</span>,
    ChevronRight: () => <span data-testid="chevron-right-icon">ChevronRight</span>,
    ExternalLink: () => <span data-testid="external-link-icon">ExternalLink</span>,
    LogOut: () => <span data-testid="logout-icon">LogOut</span>,
    Home: () => <span data-testid="home-icon">Home</span>,
    Search: () => <span data-testid="search-icon">Search</span>,
    BarChart3: () => <span data-testid="barchart-icon">BarChart3</span>,
    BookOpen: () => <span data-testid="bookopen-icon">BookOpen</span>,
    User: () => <span data-testid="user-icon">User</span>,
    Settings: () => <span data-testid="settings-icon">Settings</span>,
  };
});

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('MobileMenu', () => {
  const mockNavigationItems: NavigationItem[] = [
    { label: 'Home', path: '/home', icon: Home, requiresAuth: true },
    {
      label: 'Discover',
      icon: Search,
      dropdown: [
        { label: 'Discover Repositories', path: '/discover', icon: Search },
        {
          label: 'Trending Repositories',
          path: 'https://github.com/trending',
          external: true,
          icon: BarChart3,
        },
      ],
    },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    {
      label: 'Docs',
      icon: BookOpen,
      dropdown: [
        { label: 'Getting Started', path: '/docs/getting-started' },
        { label: 'Features', path: '/docs/features' },
      ],
    },
  ];

  const mockWorkspaceItems: NavigationItem[] = [
    { label: 'My Repositories', path: '/workspace/repositories' },
    { label: 'Bookmarks', path: '/workspace/bookmarks' },
  ];

  const mockUserMenuItems: NavigationItem[] = [
    { label: 'Profile', path: '/profile', icon: User },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    profileImageUrl: 'https://example.com/avatar.jpg',
  };

  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNeonAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: mockLogout,
    });
  });

  describe('Hamburger Menu Toggle', () => {
    it('renders hamburger menu button', () => {
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      expect(menuButton).toBeInTheDocument();
    });

    it('opens drawer when hamburger button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      // Check that drawer content is visible
      await waitFor(() => {
        expect(screen.getByText('Menu')).toBeInTheDocument();
      });
    });

    it('toggles drawer open and closed', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      
      // Open drawer
      await user.click(menuButton);
      await waitFor(() => {
        expect(screen.getByText('Menu')).toBeInTheDocument();
      });

      // Close drawer by clicking the button again
      await user.click(menuButton);
      await waitFor(() => {
        expect(screen.queryByText('Menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Drawer Open/Close', () => {
    it('displays navigation items when drawer is open', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
        expect(screen.getByText('Discover')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.getByText('Docs')).toBeInTheDocument();
      });
    });

    it('displays user information when authenticated', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('displays workspace items for authenticated users', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Workspace')).toBeInTheDocument();
        expect(screen.getByText('My Repositories')).toBeInTheDocument();
        expect(screen.getByText('Bookmarks')).toBeInTheDocument();
      });
    });

    it('displays user menu items for authenticated users', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Log out')).toBeInTheDocument();
      });
    });

    it('displays sign in button for unauthenticated users', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={[]}
          userMenuItems={[]}
          isAuthenticated={false}
          user={null}
          displayName=""
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument();
      });
    });

    it('does not display workspace items for unauthenticated users', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={false}
          user={null}
          displayName=""
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
        expect(screen.queryByText('My Repositories')).not.toBeInTheDocument();
      });
    });
  });

  describe('Navigation and Auto-Close', () => {
    it('closes drawer when navigation link is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Analytics')).toBeInTheDocument();
      });

      const analyticsLink = screen.getByText('Analytics').closest('a');
      await user.click(analyticsLink!);

      await waitFor(() => {
        expect(screen.queryByText('Menu')).not.toBeInTheDocument();
      });
    });

    it('closes drawer when dropdown item is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Discover')).toBeInTheDocument();
      });

      // Open dropdown
      const discoverTrigger = screen.getByText('Discover');
      await user.click(discoverTrigger);

      await waitFor(() => {
        expect(screen.getByText('Discover Repositories')).toBeInTheDocument();
      });

      // Click dropdown item
      const discoverReposLink = screen.getByText('Discover Repositories').closest('a');
      await user.click(discoverReposLink!);

      await waitFor(() => {
        expect(screen.queryByText('Menu')).not.toBeInTheDocument();
      });
    });

    it('closes drawer when external link is clicked', async () => {
      const user = userEvent.setup();
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Discover')).toBeInTheDocument();
      });

      // Open dropdown
      const discoverTrigger = screen.getByText('Discover');
      await user.click(discoverTrigger);

      await waitFor(() => {
        expect(screen.getByText('Trending Repositories')).toBeInTheDocument();
      });

      // Click external link
      const trendingButton = screen.getByText('Trending Repositories').closest('button');
      await user.click(trendingButton!);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://github.com/trending',
        '_blank',
        'noopener,noreferrer'
      );

      await waitFor(() => {
        expect(screen.queryByText('Menu')).not.toBeInTheDocument();
      });

      windowOpenSpy.mockRestore();
    });

    it('closes drawer when sign in button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={[]}
          userMenuItems={[]}
          isAuthenticated={false}
          user={null}
          displayName=""
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument();
      });

      const signInButton = screen.getByText('Sign In');
      await user.click(signInButton);

      await waitFor(() => {
        expect(screen.queryByText('Menu')).not.toBeInTheDocument();
      });
    });

    it('closes drawer and calls logout when logout button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Log out')).toBeInTheDocument();
      });

      const logoutButton = screen.getByText('Log out');
      await user.click(logoutButton);

      expect(mockLogout).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.queryByText('Menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('expands and collapses dropdown menus inline', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Discover')).toBeInTheDocument();
      });

      // Dropdown items should not be visible initially
      expect(screen.queryByText('Discover Repositories')).not.toBeInTheDocument();

      // Click to expand dropdown
      const discoverTrigger = screen.getByText('Discover');
      await user.click(discoverTrigger);

      await waitFor(() => {
        expect(screen.getByText('Discover Repositories')).toBeInTheDocument();
        expect(screen.getByText('Trending Repositories')).toBeInTheDocument();
      });

      // Click again to collapse
      await user.click(discoverTrigger);

      await waitFor(() => {
        expect(screen.queryByText('Discover Repositories')).not.toBeInTheDocument();
      });
    });

    it('handles multiple dropdowns independently', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('Discover')).toBeInTheDocument();
        expect(screen.getByText('Docs')).toBeInTheDocument();
      });

      // Open Discover dropdown
      const discoverTrigger = screen.getByText('Discover');
      await user.click(discoverTrigger);

      await waitFor(() => {
        expect(screen.getByText('Discover Repositories')).toBeInTheDocument();
      });

      // Open Docs dropdown
      const docsTrigger = screen.getByText('Docs');
      await user.click(docsTrigger);

      await waitFor(() => {
        expect(screen.getByText('Getting Started')).toBeInTheDocument();
        expect(screen.getByText('Features')).toBeInTheDocument();
      });

      // Both dropdowns should be open
      expect(screen.getByText('Discover Repositories')).toBeInTheDocument();
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });

    it('displays theme toggle in drawer header', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });
    });

    it('hides items that require authentication when user is not authenticated', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={false}
          user={null}
          displayName=""
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        // Home requires auth, should not be visible
        expect(screen.queryByText('Home')).not.toBeInTheDocument();
        
        // Discover doesn't require auth, should be visible
        expect(screen.getByText('Discover')).toBeInTheDocument();
      });
    });

    it('displays user avatar when available', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        const avatar = screen.getByAltText("Test User's profile picture");
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      });
    });

    it('displays user initial when avatar is not available', async () => {
      const user = userEvent.setup();
      const userWithoutAvatar = { ...mockUser, profileImageUrl: undefined };
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={userWithoutAvatar}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText('T')).toBeInTheDocument();
      });
    });

    it('sets aria-current attribute for active routes', async () => {
      const user = userEvent.setup();
      
      render(
        <MobileMenu
          navigationItems={mockNavigationItems}
          workspaceItems={mockWorkspaceItems}
          userMenuItems={mockUserMenuItems}
          isAuthenticated={true}
          user={mockUser}
          displayName="Test User"
        />
      );

      const menuButton = screen.getByLabelText('Open menu');
      await user.click(menuButton);

      await waitFor(() => {
        const homeLink = screen.getByText('Home').closest('a');
        expect(homeLink).toHaveAttribute('aria-current', 'page');
      });
    });
  });
});
