import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/theme-context';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      onClick={toggleTheme}
      variant="ghost"
      size="icon"
      className="w-10 h-10 rounded-lg bg-background/50 backdrop-blur-sm border border-border hover:bg-background/80 transition-all duration-300"
      aria-label="Toggle theme"
      data-testid="button-theme-toggle"
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-yellow-500 rotate-0 scale-100 transition-all dark:rotate-0 dark:scale-100" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700 rotate-0 scale-100 transition-all dark:rotate-0 dark:scale-100" />
      )}
    </Button>
  );
}