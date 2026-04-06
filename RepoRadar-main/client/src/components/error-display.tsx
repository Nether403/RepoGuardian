import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, WifiOff, ServerCrash, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  parseApiError, 
  TierRestrictionError, 
  ValidationError, 
  NetworkError,
  getUserFriendlyErrorMessage 
} from "@/lib/error-handling";
import { UpgradePrompt } from "./upgrade-prompt";

interface ErrorDisplayProps {
  error: any;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorDisplay({ 
  error, 
  onRetry, 
  className,
  compact = false 
}: ErrorDisplayProps) {
  const parsedError = parseApiError(error);
  
  // Show upgrade prompt for tier restrictions
  if (parsedError instanceof TierRestrictionError) {
    return <UpgradePrompt feature="this feature" />;
  }
  
  // Determine icon and styling based on error type
  let Icon = AlertCircle;
  let iconColor = "text-destructive";
  let title = "Error";
  
  if (parsedError instanceof NetworkError) {
    Icon = WifiOff;
    iconColor = "text-orange-500";
    title = "Connection Error";
  } else if (parsedError.statusCode && parsedError.statusCode >= 500) {
    Icon = ServerCrash;
    iconColor = "text-red-500";
    title = "Server Error";
  } else if (parsedError instanceof ValidationError) {
    Icon = ShieldAlert;
    iconColor = "text-yellow-500";
    title = "Validation Error";
  }
  
  const message = getUserFriendlyErrorMessage(error);
  
  // Compact version for inline errors
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-destructive", className)}>
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>{message}</span>
        {onRetry && parsedError.retryable && (
          <Button
            onClick={onRetry}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }
  
  // Full card version
  return (
    <Card className={cn("border-destructive/50", className)}>
      <CardContent className="p-8 text-center">
        <Icon className={cn("h-12 w-12 mx-auto mb-4", iconColor)} />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          {message}
        </p>
        {onRetry && parsedError.retryable && (
          <Button onClick={onRetry} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
