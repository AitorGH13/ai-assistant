import { User, Bot } from 'lucide-react';

interface AvatarProps {
  role: 'user' | 'assistant';
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ role, size = 'md' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10 sm:w-12 sm:h-12',
    lg: 'w-12 h-12 sm:w-14 sm:h-14',
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 26,
  };

  const isUser = role === 'user';

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
        isUser
          ? 'bg-primary-500 dark:bg-primary-600 text-white'
          : 'bg-primary/10 text-primary'
      }`}
    >
      {isUser ? (
        <User size={iconSizes[size]} />
      ) : (
        <Bot size={iconSizes[size]} />
      )}
    </div>
  );
}
