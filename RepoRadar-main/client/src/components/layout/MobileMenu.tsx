import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNeonAuth } from '@/contexts/neon-auth-context';
import { ThemeToggle } from '@/components/theme-toggle';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { NavigationItem } from '@/config/navigation';
import { Menu, ChevronDown, ChevronRight, ExternalLink, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileMenuProps {
  navigationItems: NavigationItem[];
  workspaceItems: NavigationItem[];
  userMenuItems: NavigationItem[];
  isAuthenticated: boolean;
  user: any;
  displayName: string;
}

export function MobileMenu({
  navigationItems,
  workspaceItems,
  userMenuItems,
  isAuthenticated,
  user,
  displayName,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { logout } = useNeonAuth();
  const focusTrapRef = useFocusTrap(open);

  // Handle escape key to close menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  const isActiveRoute = (path?: string) => {
    if (!path) return false;
    if (path === '/home') return location === '/home';
    return location.startsWith(path);
  };

  const handleNavigation = (item: NavigationItem) => {
    if (item.external && item.path) {
      window.open(item.path, '_blank', 'noopener,noreferrer');
    }
    setOpen(false);
  };

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-80 p-0" 
        aria-label="Mobile navigation menu"
        ref={(el) => {
          if (el) focusTrapRef.current = el as HTMLElement;
        }}
      >
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center justify-between">
            <span>Navigation Menu</span>
            <ThemeToggle />
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)] px-6">
          {/* User info for authenticated users */}
          {isAuthenticated && user && (
            <>
              <div className="flex items-center space-x-3 py-4">
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt={`${displayName}'s profile picture`}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                    <span className="text-sm font-semibold text-white">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  {user.email && (
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  )}
                </div>
              </div>
              <Separator className="my-2" />
            </>
          )}

          {/* Main navigation */}
          <nav className="space-y-1 py-4" aria-label="Primary navigation">
            {navigationItems.map((item) => {
              // Skip Home if not authenticated
              if (item.requiresAuth && !isAuthenticated) {
                return null;
              }

              if (item.dropdown) {
                return (
                  <MobileDropdownItem
                    key={item.label}
                    item={item}
                    isActiveRoute={isActiveRoute}
                    onNavigate={handleNavigation}
                  />
                );
              }

              return (
                <Link key={item.label} href={item.path || '#'}>
                  <a
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActiveRoute(item.path)
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                    aria-current={isActiveRoute(item.path) ? 'page' : undefined}
                  >
                    {item.icon && <item.icon className="w-4 h-4" aria-hidden="true" />}
                    <span>{item.label}</span>
                  </a>
                </Link>
              );
            })}
          </nav>

          {/* Workspace section for authenticated users */}
          {isAuthenticated && workspaceItems.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="py-4">
                <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider" id="workspace-menu-label">
                  Workspace
                </h3>
                <nav className="space-y-1" aria-labelledby="workspace-menu-label">
                  {workspaceItems.map((item) => (
                    <Link key={item.label} href={item.path || '#'}>
                      <a
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors',
                          isActiveRoute(item.path)
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        )}
                        aria-current={isActiveRoute(item.path) ? 'page' : undefined}
                      >
                        {item.icon && <item.icon className="w-4 h-4" aria-hidden="true" />}
                        <span>{item.label}</span>
                      </a>
                    </Link>
                  ))}
                </nav>
              </div>
            </>
          )}

          {/* User menu items for authenticated users */}
          {isAuthenticated && userMenuItems.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="py-4">
                <nav className="space-y-1" aria-label="User account menu">
                  {userMenuItems.map((item) => (
                    <Link key={item.label} href={item.path || '#'}>
                      <a
                        onClick={() => setOpen(false)}
                        className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {item.icon && <item.icon className="w-4 h-4" aria-hidden="true" />}
                        <span>{item.label}</span>
                      </a>
                    </Link>
                  ))}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm text-destructive hover:bg-accent transition-colors"
                    aria-label="Log out of your account"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    <span>Log out</span>
                  </button>
                </nav>
              </div>
            </>
          )}

          {/* Sign in button for non-authenticated users */}
          {!isAuthenticated && (
            <>
              <Separator className="my-2" />
              <div className="py-4">
                <Link href="/handler/sign-in">
                  <Button
                    onClick={() => setOpen(false)}
                    className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary"
                  >
                    Sign In
                  </Button>
                </Link>
              </div>
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface MobileDropdownItemProps {
  item: NavigationItem;
  isActiveRoute: (path?: string) => boolean;
  onNavigate: (item: NavigationItem) => void;
}

function MobileDropdownItem({ item, isActiveRoute, onNavigate }: MobileDropdownItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger 
        className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-expanded={isOpen}
        aria-label={`${item.label} submenu`}
      >
        <div className="flex items-center space-x-3">
          {item.icon && <item.icon className="w-4 h-4" aria-hidden="true" />}
          <span>{item.label}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 space-y-1 mt-1">
        {item.dropdown?.map((subItem) => {
          if (subItem.external) {
            return (
              <button
                key={subItem.label}
                onClick={() => onNavigate(subItem)}
                className="flex items-start space-x-3 w-full px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                aria-label={`${subItem.label} (opens in new tab)`}
              >
                {subItem.icon && <subItem.icon className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span>{subItem.label}</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </div>
                  {subItem.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{subItem.description}</p>
                  )}
                </div>
              </button>
            );
          }

          return (
            <Link key={subItem.label} href={subItem.path || '#'}>
              <a
                onClick={() => onNavigate(subItem)}
                className={cn(
                  'flex items-start space-x-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActiveRoute(subItem.path)
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                )}
                aria-current={isActiveRoute(subItem.path) ? 'page' : undefined}
              >
                {subItem.icon && <subItem.icon className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />}
                <div className="flex-1 min-w-0">
                  <span>{subItem.label}</span>
                  {subItem.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{subItem.description}</p>
                  )}
                </div>
              </a>
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
