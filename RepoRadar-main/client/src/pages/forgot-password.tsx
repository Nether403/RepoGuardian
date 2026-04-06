import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { AuthErrorDisplay, NetworkErrorDisplay, type AuthError } from '@/components/auth/AuthErrorDisplay';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<AuthError | string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsNetworkError(false);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error && data.message) {
          setError({
            error: data.error,
            message: data.message,
            recoveryAction: data.recoveryAction,
            retryAfter: data.retryAfter,
          });
        } else {
          throw new Error(data.error || 'Failed to send reset email');
        }
        return;
      }

      setIsSuccess(true);
    } catch (err: any) {
      if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setIsNetworkError(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send reset email');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center gradient-text">
              Check Your Email
            </CardTitle>
            <CardDescription className="text-center text-gray-400">
              We've sent password reset instructions to your email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-300">
                  <p className="font-medium mb-1">Email sent to:</p>
                  <p className="text-gray-400">{email}</p>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-400 space-y-2">
              <p>If you don't see the email, check your spam folder.</p>
              <p>The reset link will expire in 1 hour for security reasons.</p>
            </div>

            <Button
              onClick={() => setLocation('/handler/sign-in')}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center gradient-text">
            Reset Your Password
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            Enter your email and we'll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isNetworkError && (
              <NetworkErrorDisplay 
                onRetry={() => handleSubmit(new Event('submit') as any)}
                isRetrying={isRetrying}
              />
            )}
            
            {!isNetworkError && error && (
              <AuthErrorDisplay 
                error={error}
                onRetry={() => handleSubmit(new Event('submit') as any)}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-dark border-border"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>

          <div className="mt-6">
            <Button
              onClick={() => setLocation('/handler/sign-in')}
              variant="ghost"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
