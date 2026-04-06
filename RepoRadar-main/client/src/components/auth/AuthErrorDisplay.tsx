/**
 * Authentication Error Display Component
 * 
 * Displays user-friendly error messages for authentication failures
 * with recovery actions and retry information
 */

import { AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export interface AuthError {
  error: string;
  message: string;
  recoveryAction?: string;
  retryAfter?: number;
}

interface AuthErrorDisplayProps {
  error: AuthError | string | null;
  onRetry?: () => void;
  onPasswordReset?: () => void;
}

export function AuthErrorDisplay({ error, onRetry, onPasswordReset }: AuthErrorDisplayProps) {
  if (!error) return null;

  // Handle string errors
  if (typeof error === 'string') {
    return (
      <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // Handle structured errors
  const { error: errorCode, message, recoveryAction, retryAfter } = error;

  // Format retry-after time
  const formatRetryTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  // Determine if this is an account locked error
  const isAccountLocked = errorCode === 'ACCOUNT_LOCKED';
  const isRateLimited = errorCode === 'RATE_LIMIT_EXCEEDED';
  const isPasswordError = errorCode === 'PASSWORD_VALIDATION_ERROR';

  return (
    <Alert 
      variant="destructive" 
      className="bg-red-500/10 border-red-500/20 space-y-3"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5" />
        <div className="flex-1 space-y-2">
          <AlertTitle className="text-red-400">
            {isAccountLocked && 'Account Temporarily Locked'}
            {isRateLimited && 'Too Many Attempts'}
            {isPasswordError && 'Password Requirements Not Met'}
            {!isAccountLocked && !isRateLimited && !isPasswordError && 'Authentication Failed'}
          </AlertTitle>
          
          <AlertDescription className="text-red-300/90 space-y-2">
            <p>{message}</p>
            
            {recoveryAction && (
              <p className="text-sm text-red-300/70">
                {recoveryAction}
              </p>
            )}
            
            {retryAfter && retryAfter > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-300/70 mt-2">
                <Clock className="h-3 w-3" />
                <span>Please wait {formatRetryTime(retryAfter)} before trying again</span>
              </div>
            )}
          </AlertDescription>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            {isAccountLocked && onPasswordReset && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPasswordReset}
                className="text-xs"
              >
                Reset Password
              </Button>
            )}
            
            {onRetry && !retryAfter && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>
    </Alert>
  );
}

/**
 * Password Requirements Display
 * Shows password requirements clearly
 */
interface PasswordRequirementsProps {
  password: string;
  showRequirements?: boolean;
}

export function PasswordRequirements({ password, showRequirements = true }: PasswordRequirementsProps) {
  if (!showRequirements) return null;

  const requirements = [
    {
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
  ];

  return (
    <div className="space-y-1 text-xs">
      <p className="text-gray-400">Password requirements:</p>
      {requirements.map((req, index) => (
        <div
          key={index}
          className={`flex items-center gap-2 ${
            req.met ? 'text-green-400' : 'text-gray-500'
          }`}
        >
          <span className="text-lg leading-none">
            {req.met ? '✓' : '○'}
          </span>
          <span>{req.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Network Error Display
 * Shows network-specific errors with retry mechanism
 */
interface NetworkErrorDisplayProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function NetworkErrorDisplay({ onRetry, isRetrying }: NetworkErrorDisplayProps) {
  return (
    <Alert className="bg-yellow-500/10 border-yellow-500/20">
      <AlertCircle className="h-4 w-4 text-yellow-400" />
      <AlertTitle className="text-yellow-400">Connection Error</AlertTitle>
      <AlertDescription className="text-yellow-300/90 space-y-3">
        <p>Unable to connect to the server. Please check your internet connection.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
          className="text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying...' : 'Retry Connection'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
