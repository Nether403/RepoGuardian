# Design Document

## Overview

This design document outlines the architecture and implementation approach for enhancing RepoRadar's authentication and security infrastructure. The enhancements will transform the current basic authentication system into a production-grade security solution with password hashing, OAuth integration, password reset capabilities, comprehensive rate limiting, and HTTPS enforcement.

### Goals
- Implement secure password storage using bcrypt hashing
- Integrate Google and GitHub OAuth through Stack Auth
- Provide self-service password reset functionality
- Protect against abuse through multi-level rate limiting
- Enforce HTTPS and secure session management
- Maintain backward compatibility with existing user sessions

### Non-Goals
- Multi-factor authentication (future enhancement)
- Biometric authentication
- Enterprise SSO/SAML integration
- Password complexity requirements beyond basic validation

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Login Form   │  │ OAuth Buttons│  │ Reset Form   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Middleware Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ HTTPS Redirect│  │ Rate Limiter │  │ Session Mgmt │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Authentication Service                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Password Auth│  │ OAuth Handler│  │ Token Manager│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ User Store   │  │ Token Store  │  │ Rate Limiter │      │
│  │ (PostgreSQL) │  │ (PostgreSQL) │  │ (Redis/Memory)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

**Password Authentication Flow:**
```
User → Login Form → Rate Limiter → Password Service → bcrypt.compare() 
→ Session Creation → Response
```

**OAuth Flow:**
```
User → OAuth Button → Stack Auth → OAuth Provider → Callback Handler 
→ User Creation/Update → Session Creation → Response
```

**Password Reset Flow:**
```
User → Reset Request → Token Generation → Email Service → User Clicks Link 
→ Token Validation → Password Update → Session Invalidation → Response
```

## Components and Interfaces

### 1. Password Hashing Service

**Location:** `server/auth/passwordService.ts`

**Interface:**
```typescript
interface PasswordService {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}
```

**Implementation Details:**
- Use bcrypt with cost factor 12 (configurable via env)
- Implement password strength validation
- Support automatic rehashing for old passwords
- Add timing-safe comparison to prevent timing attacks

### 2. OAuth Integration Service

**Location:** `server/auth/oauthService.ts`

**Interface:**
```typescript
interface OAuthService {
  initializeStackAuth(): StackServerApp;
  handleGoogleCallback(code: string, state: string): Promise<User>;
  handleGitHubCallback(code: string, state: string): Promise<User>;
  linkOAuthProvider(userId: string, provider: string, providerId: string): Promise<void>;
}
```

**Implementation Details:**
- Integrate Stack Auth SDK (@stackframe/stack)
- Configure Google and GitHub OAuth providers
- Handle account linking for existing emails
- Store OAuth provider information in user table


### 3. Password Reset Service

**Location:** `server/auth/resetService.ts`

**Interface:**
```typescript
interface ResetService {
  requestReset(email: string): Promise<void>;
  validateToken(token: string): Promise<{ valid: boolean; userId?: string }>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  invalidateUserTokens(userId: string): Promise<void>;
}
```

**Implementation Details:**
- Generate cryptographically secure tokens (32 bytes)
- Store tokens with 1-hour expiration
- Use email service for sending reset links
- Invalidate all user sessions on password change

### 4. Rate Limiting Service

**Location:** `server/middleware/rateLimiter.ts` (enhanced)

**Interface:**
```typescript
interface RateLimiter {
  checkLimit(key: string, limit: number, window: number): Promise<RateLimitResult>;
  resetLimit(key: string): Promise<void>;
  getRemaining(key: string): Promise<number>;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}
```

**Rate Limit Tiers:**
- Login attempts: 5 per 15 minutes per IP
- Password reset: 3 per hour per email
- API calls (free): 100 per hour per user
- API calls (pro): 1000 per hour per user
- Analysis (free): 10 per day per user
- Analysis (pro): 100 per day per user

### 5. HTTPS Enforcement Middleware

**Location:** `server/middleware/httpsEnforcement.ts`

**Interface:**
```typescript
interface HTTPSMiddleware {
  enforceHTTPS(req: Request, res: Response, next: NextFunction): void;
  setSecurityHeaders(req: Request, res: Response, next: NextFunction): void;
}
```

**Security Headers:**
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy: (configured per environment)

### 6. Session Management Service

**Location:** `server/auth/sessionService.ts`

**Interface:**
```typescript
interface SessionService {
  createSession(userId: string, metadata: SessionMetadata): Promise<string>;
  validateSession(sessionId: string): Promise<Session | null>;
  regenerateSession(oldSessionId: string): Promise<string>;
  destroySession(sessionId: string): Promise<void>;
  destroyAllUserSessions(userId: string): Promise<void>;
}
```

## Data Models

### Enhanced User Schema

**Location:** `shared/schema.ts`

```typescript
export const users = pgTable("users", {
  // Existing fields
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // New authentication fields
  passwordHash: varchar("password_hash"), // bcrypt hash
  emailVerified: boolean("email_verified").default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  
  // OAuth fields
  googleId: varchar("google_id"),
  githubId: varchar("github_id"),
  oauthProviders: jsonb("oauth_providers").$type<string[]>().default([]),
  
  // Security fields
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: varchar("last_login_ip"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  accountLockedUntil: timestamp("account_locked_until"),
  
  // Existing fields
  subscriptionTier: varchar("subscription_tier").default("free"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### Password Reset Tokens Table

```typescript
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reset_tokens_token").on(table.token),
  index("idx_reset_tokens_user").on(table.userId),
  index("idx_reset_tokens_expires").on(table.expiresAt),
]);
```

### Rate Limit Store

```typescript
export const rateLimits = pgTable("rate_limits", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_rate_limits_key").on(table.key),
  index("idx_rate_limits_reset").on(table.resetAt),
]);
```

## Error Handling

### Authentication Errors

**Error Types:**
```typescript
enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  OAUTH_ERROR = 'OAUTH_ERROR',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
}
```

**Error Response Format:**
```typescript
interface AuthErrorResponse {
  error: AuthErrorCode;
  message: string;
  retryAfter?: number; // seconds
  details?: Record<string, unknown>;
}
```

**Security Considerations:**
- Use generic messages for login failures
- Log detailed errors server-side only
- Implement progressive delays for repeated failures
- Never expose whether an email exists in the system

## Testing Strategy

### Unit Tests

**Password Service Tests:**
- Hash generation with correct cost factor
- Password verification (valid/invalid)
- Rehashing detection for old hashes
- Timing attack resistance

**OAuth Service Tests:**
- Stack Auth initialization
- Callback handling for each provider
- Account linking logic
- Error handling for OAuth failures

**Rate Limiter Tests:**
- Limit enforcement across different tiers
- Window sliding behavior
- Reset functionality
- Concurrent request handling

### Integration Tests

**Authentication Flow Tests:**
- Complete login flow with password
- Complete OAuth flow (mocked providers)
- Password reset end-to-end
- Session management across requests

**Security Tests:**
- HTTPS redirect in production
- Security headers presence
- Rate limiting enforcement
- Session fixation prevention

### End-to-End Tests

**User Journey Tests:**
- New user signup with password
- Existing user login
- OAuth signup and login
- Password reset flow
- Account lockout and recovery


## Implementation Details

### Phase 1: Password Security

**Database Migration:**
1. Add `passwordHash` column to users table
2. Add security-related columns (failedLoginAttempts, accountLockedUntil, etc.)
3. Create indexes for performance

**Password Service Implementation:**
1. Install bcrypt: `npm install bcrypt @types/bcrypt`
2. Create password service with hash/verify methods
3. Update signup endpoint to hash passwords
4. Update login endpoint to verify hashed passwords
5. Add password strength validation

**Migration Strategy for Existing Users:**
- Users without passwordHash will be prompted to reset password
- Temporary flag to identify legacy accounts
- Gradual migration as users log in

### Phase 2: OAuth Integration

**Stack Auth Setup:**
1. Install Stack Auth SDK: `npm install @stackframe/stack`
2. Configure Stack Auth project in Neon Console
3. Set up Google OAuth credentials
4. Set up GitHub OAuth credentials
5. Configure callback URLs

**Backend Implementation:**
1. Create OAuth service with Stack Auth integration
2. Add OAuth callback routes
3. Implement account linking logic
4. Update user schema with OAuth fields

**Frontend Implementation:**
1. Add OAuth buttons to login/signup pages
2. Implement OAuth redirect handling
3. Update auth context to support OAuth
4. Add loading states for OAuth flows

### Phase 3: Password Reset

**Email Service Setup:**
1. Choose email provider (SendGrid, AWS SES, or Resend)
2. Configure email templates
3. Set up email service wrapper

**Backend Implementation:**
1. Create password reset tokens table
2. Implement token generation service
3. Add reset request endpoint
4. Add token validation endpoint
5. Add password update endpoint
6. Implement email sending

**Frontend Implementation:**
1. Create "Forgot Password" link on login page
2. Create reset request form
3. Create password reset form
4. Add success/error messaging

### Phase 4: Rate Limiting

**Rate Limiter Enhancement:**
1. Extend existing rate limiter with new tiers
2. Add IP-based limiting for auth endpoints
3. Add email-based limiting for reset requests
4. Add user-based limiting for API calls
5. Implement sliding window algorithm

**Storage Strategy:**
- Use Redis if available (fast, distributed)
- Fall back to PostgreSQL (persistent, reliable)
- Use in-memory for development

**Middleware Integration:**
1. Apply auth rate limiter to login/signup
2. Apply reset rate limiter to password reset
3. Apply API rate limiter to protected endpoints
4. Add rate limit headers to responses

### Phase 5: HTTPS Enforcement

**Production Configuration:**
1. Configure SSL/TLS certificates
2. Set up HTTPS redirect middleware
3. Add security headers middleware
4. Update cookie settings for secure flag

**Environment-Specific Behavior:**
```typescript
const isProduction = process.env.NODE_ENV === 'production';

// HTTPS redirect
if (isProduction && req.protocol !== 'https') {
  return res.redirect(301, `https://${req.hostname}${req.url}`);
}

// Cookie settings
cookie: {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: sessionTtl,
}
```

### Phase 6: Session Security

**Session Enhancements:**
1. Implement session regeneration on auth state changes
2. Add session metadata (IP, user agent)
3. Implement session invalidation on password change
4. Add "logout all devices" functionality

**Security Measures:**
1. Generate new session ID on login
2. Regenerate session ID on privilege escalation
3. Validate session metadata on each request
4. Implement session timeout with sliding window

## Configuration

### Environment Variables

```bash
# Password Security
BCRYPT_ROUNDS=12

# Stack Auth (OAuth)
NEXT_PUBLIC_STACK_PROJECT_ID=your_project_id
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=your_client_key
STACK_SECRET_SERVER_KEY=your_secret_key

# Email Service (choose one)
SENDGRID_API_KEY=your_sendgrid_key
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY=your_access_key
AWS_SES_SECRET_KEY=your_secret_key
RESEND_API_KEY=your_resend_key

# Email Configuration
EMAIL_FROM=noreply@reporadar.com
EMAIL_FROM_NAME=RepoRadar
PASSWORD_RESET_URL=https://reporadar.com/reset-password

# Rate Limiting
RATE_LIMIT_REDIS_URL=redis://localhost:6379
RATE_LIMIT_STORAGE=redis # redis, postgres, or memory

# HTTPS
FORCE_HTTPS=true # production only
HSTS_MAX_AGE=31536000

# Session Security
SESSION_SECRET=your_session_secret
SESSION_TTL=604800000 # 7 days in milliseconds
```

### Rate Limit Configuration

```typescript
export const RATE_LIMITS = {
  auth: {
    login: { limit: 5, window: 15 * 60 * 1000 }, // 5 per 15 min
    signup: { limit: 3, window: 60 * 60 * 1000 }, // 3 per hour
    reset: { limit: 3, window: 60 * 60 * 1000 }, // 3 per hour
  },
  api: {
    free: { limit: 100, window: 60 * 60 * 1000 }, // 100 per hour
    pro: { limit: 1000, window: 60 * 60 * 1000 }, // 1000 per hour
    enterprise: { limit: -1, window: 0 }, // unlimited
  },
  analysis: {
    free: { limit: 10, window: 24 * 60 * 60 * 1000 }, // 10 per day
    pro: { limit: 100, window: 24 * 60 * 60 * 1000 }, // 100 per day
    enterprise: { limit: -1, window: 0 }, // unlimited
  },
};
```

## Security Considerations

### Password Security
- Minimum 8 characters required
- bcrypt cost factor 12 (adjustable for future-proofing)
- Automatic rehashing for old passwords
- No password complexity requirements (length is sufficient)

### OAuth Security
- State parameter validation to prevent CSRF
- Token verification through Stack Auth
- Secure storage of OAuth tokens
- Account linking only for verified emails

### Session Security
- HttpOnly cookies to prevent XSS
- Secure flag in production
- SameSite attribute to prevent CSRF
- Session regeneration on auth changes

### Rate Limiting
- IP-based for anonymous endpoints
- User-based for authenticated endpoints
- Progressive delays for repeated failures
- Distributed rate limiting with Redis

### HTTPS Enforcement
- Automatic redirect in production
- HSTS headers for browser enforcement
- Secure cookie flag
- TLS 1.2+ only

## Migration Plan

### Database Migrations

**Step 1: Add new columns**
```sql
ALTER TABLE users 
  ADD COLUMN password_hash VARCHAR(255),
  ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN email_verified_at TIMESTAMP,
  ADD COLUMN google_id VARCHAR(255),
  ADD COLUMN github_id VARCHAR(255),
  ADD COLUMN oauth_providers JSONB DEFAULT '[]',
  ADD COLUMN last_login_at TIMESTAMP,
  ADD COLUMN last_login_ip VARCHAR(45),
  ADD COLUMN failed_login_attempts INTEGER DEFAULT 0,
  ADD COLUMN account_locked_until TIMESTAMP;
```

**Step 2: Create new tables**
```sql
CREATE TABLE password_reset_tokens (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_reset_tokens_expires ON password_reset_tokens(expires_at);
```

**Step 3: Create rate limit table (if not using Redis)**
```sql
CREATE TABLE rate_limits (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_key ON rate_limits(key);
CREATE INDEX idx_rate_limits_reset ON rate_limits(reset_at);
```

### Deployment Strategy

**Phase 1: Backend Preparation**
1. Deploy password hashing service (backward compatible)
2. Deploy new database schema
3. Deploy rate limiting infrastructure

**Phase 2: OAuth Integration**
1. Configure Stack Auth
2. Deploy OAuth endpoints
3. Test OAuth flows in staging

**Phase 3: Frontend Updates**
1. Deploy OAuth buttons
2. Deploy password reset UI
3. Update error messaging

**Phase 4: Security Hardening**
1. Enable HTTPS enforcement
2. Enable rate limiting
3. Monitor for issues

**Phase 5: User Migration**
1. Notify users of security improvements
2. Prompt legacy users to reset passwords
3. Monitor migration progress

## Monitoring and Observability

### Metrics to Track
- Login success/failure rates
- OAuth provider usage
- Password reset requests
- Rate limit hits by endpoint
- Session creation/destruction rates
- Account lockout events

### Logging Strategy
- Log all authentication attempts (success/failure)
- Log OAuth provider interactions
- Log rate limit violations
- Log security header violations
- Never log passwords or tokens

### Alerts
- High rate of failed login attempts
- Unusual OAuth error rates
- Rate limit threshold exceeded
- Session store errors
- Email service failures

## Performance Considerations

### Password Hashing
- bcrypt is intentionally slow (security feature)
- Use async operations to avoid blocking
- Consider worker threads for high load

### Rate Limiting
- Redis preferred for distributed systems
- In-memory fallback for single instance
- PostgreSQL as last resort (persistent)

### Session Management
- Use Redis for session store if available
- Implement session cleanup job
- Monitor session store size

### OAuth
- Cache OAuth provider configurations
- Implement timeout for OAuth requests
- Handle provider outages gracefully
