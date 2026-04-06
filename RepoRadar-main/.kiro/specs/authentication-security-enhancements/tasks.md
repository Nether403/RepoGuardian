# Implementation Plan

- [x] 1. Database schema updates and migrations





  - Add new authentication columns to users table (passwordHash, emailVerified, googleId, githubId, oauthProviders, lastLoginAt, lastLoginIp, failedLoginAttempts, accountLockedUntil)
  - Create password_reset_tokens table with indexes
  - Create rate_limits table with indexes (if not using Redis)
  - Run migrations using Drizzle Kit
  - _Requirements: 1.1, 1.2, 2.4, 3.2, 4.6_

- [x] 2. Password hashing service implementation



- [x] 2.1 Install bcrypt dependency and create password service


  - Install bcrypt and @types/bcrypt packages
  - Create `server/auth/passwordService.ts` with hash() and verify() methods
  - Implement bcrypt with configurable cost factor (default 12)
  - Add password strength validation (minimum 8 characters)
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2.2 Update authentication endpoints to use password hashing


  - Modify signup endpoint to hash passwords before storage
  - Modify login endpoint to verify passwords using bcrypt
  - Update user creation logic to store hashed passwords
  - Add error handling for password validation failures
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 2.3 Write unit tests for password service
  - Test password hashing with correct cost factor
  - Test password verification (valid and invalid passwords)
  - Test password strength validation
  - Test error handling for edge cases
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. OAuth integration with Stack Auth






- [x] 3.1 Install and configure Stack Auth SDK

  - Install @stackframe/stack package
  - Create `server/auth/oauthService.ts` with Stack Auth initialization
  - Configure Stack Auth with environment variables
  - Set up OAuth provider configurations for Google and GitHub
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.2 Implement OAuth callback handlers


  - Create OAuth callback route handlers for Google and GitHub
  - Implement user creation/update logic for OAuth users
  - Add account linking logic for existing email addresses
  - Store OAuth provider information in user table
  - _Requirements: 2.3, 2.4, 2.5, 2.6_


- [x] 3.3 Add OAuth buttons to frontend

  - Update sign-in page with Google and GitHub OAuth buttons
  - Update sign-up page with OAuth options
  - Implement OAuth redirect handling in auth context
  - Add loading states during OAuth flow
  - _Requirements: 2.1, 2.2, 2.7_

- [x] 3.4 Write integration tests for OAuth flow





  - Test OAuth callback handling with mocked providers
  - Test account linking for existing emails
  - Test user creation for new OAuth users
  - Test error handling for OAuth failures
  - _Requirements: 2.3, 2.4, 2.5, 2.6_

- [x] 4. Password reset functionality




- [x] 4.1 Create password reset token service

  - Create `server/auth/resetService.ts` with token generation
  - Implement cryptographically secure token generation (32 bytes)
  - Add token validation with 1-hour expiration
  - Implement token invalidation logic
  - _Requirements: 3.2, 3.4, 3.5, 3.8_


- [x] 4.2 Set up email service for password reset

  - Choose and configure email provider (SendGrid, AWS SES, or Resend)
  - Create email templates for password reset
  - Implement email sending wrapper in `server/utils/emailService.ts`
  - Add password reset email with secure link
  - _Requirements: 3.3, 3.9_


- [x] 4.3 Implement password reset API endpoints

  - Create POST /api/auth/request-reset endpoint
  - Create GET /api/auth/validate-reset-token endpoint
  - Create POST /api/auth/reset-password endpoint
  - Add session invalidation on password change
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4.4 Create password reset UI components


  - Create "Forgot Password" link on login page
  - Create password reset request form component
  - Create password reset form component (with token validation)
  - Add success/error messaging and user feedback
  - _Requirements: 3.1, 3.7, 3.9_

- [ ]* 4.5 Write tests for password reset flow
  - Test token generation and validation
  - Test email sending functionality
  - Test password reset endpoint logic
  - Test token expiration and invalidation
  - _Requirements: 3.2, 3.4, 3.5, 3.8_

-

- [x] 5. Enhanced rate limiting implementation


- [x] 5.1 Extend rate limiter with new tiers and strategies


  - Enhance `server/middleware/rateLimiter.ts` with sliding window algorithm
  - Add IP-based rate limiting for authentication endpoints
  - Add email-based rate limiting for password reset
  - Add user-based rate limiting for API calls with tier support
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.8_

- [x] 5.2 Implement rate limit storage layer


  - Create rate limit storage interface supporting Redis and PostgreSQL
  - Implement Redis storage adapter (if Redis available)
  - Implement PostgreSQL storage adapter as fallback
  - Add in-memory storage for development
  - _Requirements: 4.6, 4.8_

- [x] 5.3 Apply rate limiting middleware to endpoints


  - Apply auth rate limiter to login and signup endpoints (5 per 15 min)
  - Apply reset rate limiter to password reset endpoint (3 per hour)
  - Apply API rate limiter to protected endpoints (tier-based)
  - Add rate limit headers to responses (X-RateLimit-*)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7_

- [x] 5.4 Add rate limit error handling and user feedback


  - Return 429 status with retry-after information
  - Add clear error messages for rate limit exceeded
  - Log rate limit violations for security monitoring
  - Implement progressive delays for repeated failures
  - _Requirements: 4.2, 4.6, 4.7_

- [ ]* 5.5 Write tests for rate limiting
  - Test rate limit enforcement across different tiers
  - Test sliding window behavior
  - Test concurrent request handling
  - Test rate limit reset functionality
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.8_

- [x] 6. HTTPS enforcement and security headers



- [x] 6.1 Create HTTPS enforcement middleware


  - Create `server/middleware/httpsEnforcement.ts`
  - Implement HTTPS redirect for production environment
  - Add environment detection (skip redirect in development)
  - Configure redirect to use 301 permanent redirect
  - _Requirements: 5.1, 5.2, 5.6_

- [x] 6.2 Implement security headers middleware

  - Add Strict-Transport-Security header (HSTS)
  - Add X-Content-Type-Options: nosniff
  - Add X-Frame-Options: DENY
  - Add X-XSS-Protection header
  - Add Content-Security-Policy header
  - _Requirements: 5.4, 5.7_

- [x] 6.3 Update session and cookie configuration


  - Set secure flag on cookies in production
  - Set SameSite attribute to 'strict' in production
  - Ensure httpOnly flag is enabled
  - Configure cookie domain and path appropriately
  - _Requirements: 5.3, 5.5, 5.6_

- [ ]* 6.4 Write tests for HTTPS enforcement
  - Test HTTPS redirect in production mode
  - Test HTTP allowed in development mode
  - Test security headers presence
  - Test cookie security flags
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [x] 7. Session security enhancements




- [x] 7.1 Implement session regeneration


  - Create `server/auth/sessionService.ts` with session management
  - Implement session regeneration on login
  - Implement session regeneration on authentication state changes
  - Add session metadata tracking (IP, user agent)
  - _Requirements: 6.1, 6.2, 6.7_

- [x] 7.2 Add session invalidation logic


  - Implement session destruction on logout
  - Implement session invalidation on password change
  - Add "logout all devices" functionality
  - Clear session cookies on logout
  - _Requirements: 6.4, 6.6_

- [x] 7.3 Implement session validation and security checks


  - Validate session metadata on each request
  - Implement session timeout with sliding window
  - Add suspicious activity detection
  - Implement automatic session invalidation for suspicious activity
  - _Requirements: 6.3, 6.4, 6.5_

- [ ]* 7.4 Write tests for session security
  - Test session regeneration on login
  - Test session invalidation on logout
  - Test session timeout behavior
  - Test "logout all devices" functionality
  - _Requirements: 6.1, 6.2, 6.4, 6.6, 6.7_

- [x] 8. Authentication error handling and user feedback




- [x] 8.1 Implement secure error handling


  - Create authentication error types and codes
  - Implement generic error messages for login failures
  - Add detailed server-side logging for debugging
  - Implement progressive delays for repeated failures
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 8.2 Add account lockout functionality


  - Track failed login attempts in user table
  - Implement account lockout after threshold (5 attempts)
  - Add lockout duration (15 minutes)
  - Provide password reset option when locked
  - _Requirements: 7.2, 7.5_

- [x] 8.3 Update frontend error messaging


  - Display user-friendly error messages for auth failures
  - Show retry-after information for rate limits
  - Display password requirement errors clearly
  - Add retry mechanisms for network errors
  - _Requirements: 7.1, 7.3, 7.6, 7.7_

- [ ]* 8.4 Write tests for error handling
  - Test generic error messages for login failures
  - Test account lockout behavior
  - Test progressive delay implementation
  - Test error logging without exposing sensitive data
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 9. Environment configuration and deployment




- [x] 9.1 Update environment variables


  - Add BCRYPT_ROUNDS configuration
  - Add Stack Auth configuration variables
  - Add email service configuration
  - Add rate limiting configuration
  - Add HTTPS enforcement configuration
  - Update .env.example with all new variables
  - _Requirements: 1.1, 2.1, 3.3, 4.1, 5.1_

- [x] 9.2 Create configuration validation


  - Validate required environment variables on startup
  - Provide helpful error messages for missing config
  - Add configuration summary logging
  - Implement graceful degradation for optional features
  - _Requirements: 1.1, 2.1, 3.3, 4.1, 5.1_

- [x] 9.3 Update documentation



  - Update README with new authentication features
  - Document OAuth setup process
  - Document email service configuration
  - Document rate limiting configuration
  - Add security best practices guide
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_
