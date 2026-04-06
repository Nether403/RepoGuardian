import * as React from 'react';
import { AppError } from '@/../../shared/errors';
import { AlertCircle, AlertTriangle, Info, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface ErrorMessageProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  severity?: 'error' | 'warning' | 'info';
  className?: string;
  showDetails?: boolean;
}

/**
 * Component for displaying user-friendly error messages with recovery options
 * 
 * @example
 * <ErrorMessage
 *   error={appError}
 *   onRetry={() => refetch()}
 *   onDismiss={() => setError(null)}
 *   severity="error"
 * />
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  onDismiss,
  severity = 'error',
  className,
  showDetails = false,
}) => {
  const icons = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = icons[severity];

  const variants = {
    error: 'destructive',
    warning: 'default',
    info: 'default',
  } as const;

  return (
    <Alert variant={variants[severity]} className={cn('relative', className)}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>{error.userMessage}</span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-transparent"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        {error.recoveryAction && (
          <p className="text-sm">
            <strong>What to do:</strong> {error.recoveryAction}
          </p>
        )}

        {showDetails && error.details && (
          <details className="text-xs">
            <summary className="cursor-pointer hover:underline">
              Technical details
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
              {JSON.stringify(error.details, null, 2)}
            </pre>
          </details>
        )}

        {showDetails && import.meta.env.DEV && (
          <details className="text-xs">
            <summary className="cursor-pointer hover:underline">
              Error code
            </summary>
            <p className="mt-1 font-mono">{error.code}</p>
          </details>
        )}

        {onRetry && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Try Again
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};

/**
 * Inline error message for form fields and smaller contexts
 */
export const InlineErrorMessage: React.FC<{
  message: string;
  className?: string;
}> = ({ message, className }) => {
  return (
    <p className={cn('text-sm text-destructive flex items-center gap-1', className)}>
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  );
};
