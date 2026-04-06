import { Link } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useNeonAuth } from '@/contexts/neon-auth-context';
import type { NavigationItem } from '@/config/navigation';
import { LogOut, ChevronDown } from 'lucide-react';

interface UserMenuProps {
  user: any;
  displayName: string;
  menuItems: NavigationItem[];
}

export function UserMenu({ user, displayName, menuItems }: UserMenuProps) {
  const { logout } = useNeonAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center space-x-2 hover:bg-accent"
          aria-label="User menu"
        >
          {user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt={`${displayName}'s profile picture`}
              className="w-8 h-8 rounded-lg object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
              <span className="text-sm font-semibold text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="hidden lg:inline-block font-medium">{displayName}</span>
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {user?.email && (
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {menuItems.map((item) => (
          <Link key={item.label} href={item.path || '#'}>
            <DropdownMenuItem className="cursor-pointer">
              {item.icon && <item.icon className="w-4 h-4 mr-2" aria-hidden="true" />}
              <span>{item.label}</span>
            </DropdownMenuItem>
          </Link>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive">
          <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
