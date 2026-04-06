import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useNeonAuth } from '@/contexts/neon-auth-context';
import { ThemeToggle } from '@/components/theme-toggle';
import { Notifications } from '@/components/notifications';
import { navigationConfig, workspaceMenuItems, userMenuItems } from '@/config/navigation';
import { DropdownMenu } from './DropdownMenu';
import { MobileMenu } from './MobileMenu';
import { UserMenu } from './UserMenu';
import { analytics } from '@/hooks/useNavigationTracking';
import { cn } from '@/lib/utils';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { user, isAuthenticated, isLoading } = useNeonAuth();
  const [location] = useLocation();

  const isActiveRoute = (path?: string) => {
    if (!path) return false;
    if (path === '/home') return location === '/home';
    return location.startsWith(path);
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border',
        className
      )}
      role="banner"
    >
      <nav className="container mx-auto px-4 h-24 flex items-center justify-between" aria-label="Main navigation">
        {/* Logo */}
        <Link href={isAuthenticated ? '/home' : '/landing'} aria-label="RepoRadar home">
          <a className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="w-20 h-20 rounded-xl flex items-center justify-center">
              <img 
                src="/Images/Gitradartrans.png" 
                alt="RepoRadar logo" 
                className="w-20 h-20 object-contain"
              />
            </div>
            <h1 className="text-xl font-bold gradient-text hidden sm:block">RepoRadar</h1>
          </a>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          {navigationConfig.map((item) => {
            // Skip Home if not authenticated
            if (item.requiresAuth && !isAuthenticated) {
              return null;
            }

            if (item.dropdown) {
              return (
                <DropdownMenu
                  key={item.label}
                  trigger={
                    <>
                      {item.icon && <item.icon className="w-4 h-4" aria-hidden="true" />}
                      <span>{item.label}</span>
                    </>
                  }
                  items={item.dropdown}
                  align="start"
                />
              );
            }

            return (
              <Link key={item.label} href={item.path || '#'}>
                <a
                  className={cn(
                    'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActiveRoute(item.path) && 'bg-accent text-accent-foreground'
                  )}
                  aria-current={isActiveRoute(item.path) ? 'page' : undefined}
                >
                  {item.icon && <item.icon className="w-4 h-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </a>
              </Link>
            );
          })}

          {/* Workspace dropdown for authenticated users */}
          {isAuthenticated && (
            <DropdownMenu
              trigger={<span>Workspace</span>}
              items={workspaceMenuItems}
              align="end"
            />
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-4">
          {/* Theme toggle - desktop only */}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          {/* Notifications - authenticated users only */}
          {isAuthenticated && (
            <div className="hidden md:block">
              <Notifications />
            </div>
          )}

          {/* User menu or Sign in button */}
          {!isLoading && (
            <>
              {isAuthenticated ? (
                <div className="hidden md:block">
                  <UserMenu user={user} displayName={displayName} menuItems={userMenuItems} />
                </div>
              ) : (
                <Link href="/handler/sign-in">
                  <Button
                    className="hidden md:inline-flex bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary"
                    aria-label="Sign in to your account"
                  >
                    Sign In
                  </Button>
                </Link>
              )}
            </>
          )}

          {/* Mobile menu */}
          <div className="md:hidden">
            <MobileMenu
              navigationItems={navigationConfig}
              workspaceItems={isAuthenticated ? workspaceMenuItems : []}
              userMenuItems={isAuthenticated ? userMenuItems : []}
              isAuthenticated={isAuthenticated}
              user={user}
              displayName={displayName}
            />
          </div>
        </div>
      </nav>
    </header>
  );
}
