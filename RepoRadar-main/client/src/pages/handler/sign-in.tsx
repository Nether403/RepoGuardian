import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { AuthErrorDisplay, NetworkErrorDisplay, type AuthError } from '@/components/auth/AuthErrorDisplay';
import { Squares } from '@/components/ui/squares-background';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AuthError | string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  // Get returnUrl from query parameters
  const getReturnUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl');
    return returnUrl ? decodeURIComponent(returnUrl) : '/home';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsNetworkError(false);
    setIsLoading(true);

    try {
      await login(email, password);
      // Redirect to returnUrl or default to /home
      setLocation(getReturnUrl());
    } catch (err: any) {
      // Check if it's a network error
      if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setIsNetworkError(true);
      } else if (err.error && err.message) {
        // Structured error from API
        setError({
          error: err.error,
          message: err.message,
          recoveryAction: err.recoveryAction,
          retryAfter: err.retryAfter,
        });
      } else {
        // Generic error
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    setIsNetworkError(false);
    
    try {
      await login(email, password);
      // Redirect to returnUrl or default to /home
      setLocation(getReturnUrl());
    } catch (err: any) {
      if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setIsNetworkError(true);
      } else if (err.error && err.message) {
        setError({
          error: err.error,
          message: err.message,
          recoveryAction: err.recoveryAction,
          retryAfter: err.retryAfter,
        });
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handlePasswordReset = () => {
    setLocation('/forgot-password');
  };

  return (
    <div className="relative min-h-screen bg-dark flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Squares 
          direction="diagonal"
          speed={0.4}
          squareSize={40}
          borderColor="#222"
          hoverFillColor="#1a1a1a"
        />
      </div>
      <Card className="relative z-10 w-full max-w-md bg-card/95 backdrop-blur-sm border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center gradient-text">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            Sign in to your RepoRadar account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isNetworkError && (
              <NetworkErrorDisplay 
                onRetry={handleRetry}
                isRetrying={isRetrying}
              />
            )}
            
            {!isNetworkError && error && (
              <AuthErrorDisplay 
                error={error}
                onRetry={handleRetry}
                onPasswordReset={handlePasswordReset}
              />
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-dark border-border"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setLocation('/forgot-password')}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-dark border-border"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <OAuthButtons mode="signin" />

          <div className="text-center text-sm text-gray-400 mt-4">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => setLocation('/handler/sign-up')}
              className="text-primary hover:underline"
            >
              Sign up
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
