import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { 
  AuthErrorDisplay, 
  NetworkErrorDisplay, 
  PasswordRequirements,
  type AuthError 
} from '@/components/auth/AuthErrorDisplay';
import { Squares } from '@/components/ui/squares-background';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<AuthError | string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const { signup } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsNetworkError(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError({
        error: 'PASSWORD_VALIDATION_ERROR',
        message: 'Password does not meet requirements.',
        recoveryAction: 'Password must be at least 8 characters long',
      });
      return;
    }

    setIsLoading(true);

    try {
      await signup(email, password, name);
      setLocation('/home');
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
        setError(err instanceof Error ? err.message : 'Signup failed');
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
      await signup(email, password, name);
      setLocation('/home');
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
        setError(err instanceof Error ? err.message : 'Signup failed');
      }
    } finally {
      setIsRetrying(false);
    }
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
            Create Account
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            Join RepoRadar and start analyzing repositories
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
              />
            )}
            
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-dark border-border"
              />
            </div>

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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setShowPasswordRequirements(true)}
                onBlur={() => setShowPasswordRequirements(false)}
                required
                minLength={8}
                className="bg-dark border-border"
              />
              {showPasswordRequirements && (
                <PasswordRequirements 
                  password={password}
                  showRequirements={true}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-dark border-border"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>

          <OAuthButtons mode="signup" />

          <div className="text-center text-sm text-gray-400 mt-4">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setLocation('/handler/sign-in')}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
