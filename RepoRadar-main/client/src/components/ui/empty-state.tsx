/**
 * Reusable empty state component
 * Provides consistent empty state UI across the application
 */

import { Button } from './button';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon | string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  iconClassName?: string;
  testId?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  iconClassName = 'from-primary to-secondary',
  testId,
}: EmptyStateProps) {
  const IconComponent = typeof icon === 'string' ? null : icon;
  
  return (
    <div className="text-center py-12 md:py-16" data-testid={testId}>
      <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-r ${iconClassName} flex items-center justify-center mx-auto mb-4 md:mb-6`}>
        {IconComponent ? (
          <IconComponent className="text-white text-2xl md:text-3xl w-8 h-8 md:w-10 md:h-10" />
        ) : typeof icon === 'string' ? (
          <i className={`${icon} text-white text-2xl md:text-3xl`}></i>
        ) : (
          <i className="fas fa-inbox text-white text-2xl md:text-3xl"></i>
        )}
      </div>
      <h3 className="text-xl md:text-2xl font-bold mb-2 md:mb-3">{title}</h3>
      <p className="text-sm md:text-base text-gray-400 mb-4 md:mb-6 max-w-md mx-auto px-4">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          variant="outline"
          className="border border-primary/30 text-primary hover:bg-primary/10 touch-target"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
