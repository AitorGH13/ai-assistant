import { Sun, Moon } from 'lucide-react';
import { Theme } from '../../utils/theme';
import { Button } from './Button';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <Button
      onClick={onToggle}
      variant="ghost"
      size="icon"
      className="text-gray-600 dark:text-gray-400"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  );
}
