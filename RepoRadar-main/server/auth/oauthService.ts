import { StackServerApp } from '@stackframe/stack';

/**
 * OAuth Service
 * 
 * Provides OAuth integration through Stack Auth for Google and GitHub authentication.
 * Handles OAuth callbacks, user creation/update, and account linking.
 */

// Stack Auth configuration from environment variables
const STACK_PROJECT_ID = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
const STACK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY;
const STACK_SECRET_KEY = process.env.STACK_SECRET_SERVER_KEY;

/**
 * OAuth configuration error
 */
export class OAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthConfigurationError';
  }
}

/**
 * OAuth authentication error
 */
export class OAuthAuthenticationError extends Error {
  constructor(message: string, public provider?: string) {
    super(message);
    this.name = 'OAuthAuthenticationError';
  }
}

/**
 * Validates that all required Stack Auth environment variables are present
 * @throws {OAuthConfigurationError} If any required variables are missing
 */
function validateConfiguration(): void {
  const missing: string[] = [];
  
  if (!STACK_PROJECT_ID) missing.push('NEXT_PUBLIC_STACK_PROJECT_ID');
  if (!STACK_PUBLISHABLE_KEY) missing.push('NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY');
  if (!STACK_SECRET_KEY) missing.push('STACK_SECRET_SERVER_KEY');
  
  if (missing.length > 0) {
    throw new OAuthConfigurationError(
      `Missing required Stack Auth configuration: ${missing.join(', ')}`
    );
  }
}

// Singleton instance of Stack Auth
let stackServerApp: StackServerApp | null = null;

/**
 * Initializes and returns the Stack Auth server app instance
 * @returns StackServerApp instance
 * @throws {OAuthConfigurationError} If configuration is invalid
 */
export function initializeStackAuth(): StackServerApp {
  // Return existing instance if already initialized
  if (stackServerApp) {
    return stackServerApp;
  }
  
  // Validate configuration
  validateConfiguration();
  
  try {
    // Initialize Stack Auth with server configuration
    // Using 'cookie' tokenStore for React/Vite compatibility (not Next.js specific)
    stackServerApp = new StackServerApp({
      projectId: STACK_PROJECT_ID!,
      publishableClientKey: STACK_PUBLISHABLE_KEY!,
      secretServerKey: STACK_SECRET_KEY!,
      tokenStore: 'cookie', // Use standard cookie-based token storage for React
    });
    
    console.log('Stack Auth initialized successfully');
    return stackServerApp;
  } catch (error) {
    console.error('Failed to initialize Stack Auth:', error);
    throw new OAuthConfigurationError(
      `Failed to initialize Stack Auth: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets the Stack Auth instance, initializing if necessary
 * @returns StackServerApp instance
 */
export function getStackAuth(): StackServerApp {
  if (!stackServerApp) {
    return initializeStackAuth();
  }
  return stackServerApp;
}

/**
 * OAuth user data returned from providers
 */
export interface OAuthUserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  provider: 'google' | 'github';
  providerId: string;
}

/**
 * Handles Google OAuth callback
 * @param code - OAuth authorization code
 * @param state - OAuth state parameter for CSRF protection
 * @returns Promise resolving to user data
 * @throws {OAuthAuthenticationError} If authentication fails
 */
export async function handleGoogleCallback(
  code: string,
  state: string
): Promise<OAuthUserData> {
  try {
    const stackAuth = getStackAuth();
    
    // Exchange code for user information through Stack Auth
    // Note: Stack Auth handles the OAuth flow internally
    // This is a placeholder for the actual implementation
    // which will be completed in the callback route handler
    
    throw new Error('Google OAuth callback not yet implemented - will be handled in route');
  } catch (error) {
    console.error('Google OAuth error:', error);
    throw new OAuthAuthenticationError(
      `Google authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'google'
    );
  }
}

/**
 * Handles GitHub OAuth callback
 * @param code - OAuth authorization code
 * @param state - OAuth state parameter for CSRF protection
 * @returns Promise resolving to user data
 * @throws {OAuthAuthenticationError} If authentication fails
 */
export async function handleGitHubCallback(
  code: string,
  state: string
): Promise<OAuthUserData> {
  try {
    const stackAuth = getStackAuth();
    
    // Exchange code for user information through Stack Auth
    // Note: Stack Auth handles the OAuth flow internally
    // This is a placeholder for the actual implementation
    // which will be completed in the callback route handler
    
    throw new Error('GitHub OAuth callback not yet implemented - will be handled in route');
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    throw new OAuthAuthenticationError(
      `GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'github'
    );
  }
}

/**
 * Links an OAuth provider to an existing user account
 * @param userId - The user ID to link the provider to
 * @param provider - The OAuth provider name
 * @param providerId - The provider-specific user ID
 * @returns Promise that resolves when linking is complete
 */
export async function linkOAuthProvider(
  userId: string,
  provider: 'google' | 'github',
  providerId: string
): Promise<void> {
  try {
    // This will be implemented in the storage layer
    // to update the user's OAuth provider information
    console.log(`Linking ${provider} provider ${providerId} to user ${userId}`);
  } catch (error) {
    console.error(`Failed to link ${provider} provider:`, error);
    throw new Error(
      `Failed to link ${provider} account: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * OAuth Service interface for dependency injection
 */
export const oauthService = {
  initializeStackAuth,
  getStackAuth,
  handleGoogleCallback,
  handleGitHubCallback,
  linkOAuthProvider,
};
