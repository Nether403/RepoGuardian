import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FaGoogle, FaGithub } from 'react-icons/fa';

interface OAuthButtonsProps {
  mode: 'signin' | 'signup';
}

export function OAuthButtons({ mode }: OAuthButtonsProps) {
  // Temporarily disabled due to Stack Auth dependency issues
  // TODO: Re-enable after fixing Stack Auth configuration
  return null;
}

/* ORIGINAL CODE - DISABLED DUE TO STACK AUTH ISSUES

export function OAuthButtons({ mode }: OAuthButtonsProps) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    try {
      // Initialize Stack Auth OAuth flow for Google
      const stackAuth = await import('@stackframe/stack').then(m => m.StackClientApp);
      // Redirect to Google OAuth
      window.location.href = `/api/auth/oauth/google?mode=${mode}`;
    } catch (error) {
      console.error('Google OAuth error:', error);
      setIsGoogleLoading(false);
    }
  };

  const handleGithubAuth = async () => {
    setIsGithubLoading(true);
    try {
      // Initialize Stack Auth OAuth flow for GitHub
      const stackAuth = await import('@stackframe/stack').then(m => m.StackClientApp);
      // Redirect to GitHub OAuth
      window.location.href = `/api/auth/oauth/github?mode=${mode}`;
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      setIsGithubLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-gray-400">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleAuth}
          disabled={isGoogleLoading || isGithubLoading}
          className="bg-dark border-border hover:bg-dark/80"
        >
          {isGoogleLoading ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>
              <FaGoogle className="mr-2 h-4 w-4" />
              Google
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleGithubAuth}
          disabled={isGoogleLoading || isGithubLoading}
          className="bg-dark border-border hover:bg-dark/80"
        >
          {isGithubLoading ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>
              <FaGithub className="mr-2 h-4 w-4" />
              GitHub
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
*/
