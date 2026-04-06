import React, { useState } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { analytics } from '@/hooks/useNavigationTracking';
import { cn } from '@/lib/utils';

export interface DropdownMenuItem {
  label: string;
  path?: string;
  external?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: 'start' | 'center' | 'end';
  onItemClick?: (item: DropdownMenuItem) => void;
}

export function DropdownMenu({ 
  trigger, 
  items, 
  align = 'start',
  onItemClick 
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [location] = useLocation();
  const itemRefs = React.useRef<(HTMLElement | null)[]>([]);

  const isActiveRoute = (path?: string) => {
    if (!path) return false;
    return location.startsWith(path);
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHovering(true);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    setHovering(false);
    hoverTimeoutRef.current = setTimeout(() => {
      if (!hovering) {
        setOpen(false);
      }
    }, 150);
  };

  const handleItemClick = (item: DropdownMenuItem) => {
    // Track analytics
    if (item.external && item.path) {
      analytics.trackExternalLink(item.path, item.label);
      window.open(item.path, '_blank', 'noopener,noreferrer');
    } else if (item.path) {
      analytics.trackNavigation(location, item.path, 'dropdown');
    }
    
    setOpen(false);
    onItemClick?.(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < items.length - 1 ? prev + 1 : 0;
          itemRefs.current[next]?.focus();
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : items.length - 1;
          itemRefs.current[next]?.focus();
          return next;
        });
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        itemRefs.current[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        const lastIndex = items.length - 1;
        setFocusedIndex(lastIndex);
        itemRefs.current[lastIndex]?.focus();
        break;
    }
  };

  React.useEffect(() => {
    if (open) {
      setFocusedIndex(-1);
    }
  }, [open]);

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger
        asChild
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="outline-none"
      >
        <button
          className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`${typeof trigger === 'string' ? trigger : 'Menu'} dropdown`}
          onKeyDown={handleKeyDown}
        >
          {trigger}
          <ChevronDown 
            className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={8}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="min-w-[200px] bg-background border border-border rounded-md shadow-lg p-1 z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          onCloseAutoFocus={(e) => e.preventDefault()}
          role="menu"
          aria-label="Dropdown menu"
          onKeyDown={handleKeyDown}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            
            const isActive = isActiveRoute(item.path);
            
            if (item.external || !item.path) {
              return (
                <DropdownMenuPrimitive.Item
                  key={index}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 text-sm rounded hover:bg-accent cursor-pointer transition-colors outline-none focus:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                  onSelect={() => handleItemClick(item)}
                  role="menuitem"
                  aria-label={item.external ? `${item.label} (opens in new tab)` : item.label}
                  tabIndex={-1}
                >
                  {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </DropdownMenuPrimitive.Item>
              );
            }

            return (
              <DropdownMenuPrimitive.Item
                key={index}
                asChild
                className="outline-none"
                onSelect={() => handleItemClick(item)}
              >
                <Link
                  href={item.path}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 text-sm rounded hover:bg-accent cursor-pointer transition-colors focus:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                  aria-current={isActive ? 'page' : undefined}
                  role="menuitem"
                  aria-label={item.label}
                  tabIndex={-1}
                  ref={(el) => {
                    itemRefs.current[index] = el as HTMLElement | null;
                  }}
                >
                  {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </Link>
              </DropdownMenuPrimitive.Item>
            );
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
