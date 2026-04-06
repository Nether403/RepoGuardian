# Security Configuration Guide

This guide covers all security features implemented in RepoRadar, including HTTPS enforcement, security headers, session security, and best practices for production deployment.

## Table of Contents

1. [HTTPS Enforcement](#https-enforcement)
2. [Security Headers](#security-headers)
3. [Session Security](#session-security)
4. [Content Security Policy](#content-security-policy)
5. [Environment Variables](#environment-variables)
6. [Testing Security](#testing-security)
7. [Production Deployment](#production-deployment)
8. [Security Checklist](#security-checklist)

## HTTPS Enforcement

### Overview

RepoRadar automatically enforces HTTPS connections in production environments to protect data in transit.

### How It Works

The `enforceHTTPS` middleware:
- Detects if the request is already using HTTPS
- Redirects HTTP requests to HTTPS with a 301 permanent redirect
- Preserves the full URL including query parameters
- Respects reverse proxy headers (`x-forwarded-proto`)

### Configuration

```bash
# Enable HTTPS enforcement in production
NODE_ENV=production
FORCE_HTTPS=true

# Disable for local development
NODE_ENV=development
FORCE_HTTPS=false
```

### Testing HTTPS Enforcement

```bash
# Test redirect (should return 301)
curl -I http://your-app.com/api/health

# Test HTTPS (should return 200)
curl -I https://your-app.com/api/health
```

## Security Headers

### Overview

RepoRadar uses Helmet.js to set comprehensive security headers that protect against common web vulnerabilities.

### Headers Configured

#### 1. Strict-Transport-Security (HSTS)

Forces browsers to use HTTPS for all future requests.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Configuration**:
```bash
HSTS_MAX_AGE=31536000  # 1 year (default)
```

#### 2. X-Content-Type-Options

Prevents MIME type sniffing.

```
X-Content-Type-Options: nosniff
```

#### 3. X-Frame-Options

Prevents clickjacking attacks.

```
X-Frame-Options: DENY
```

#### 4. Referrer-Policy

Controls referrer information sent with requests.

```
Referrer-Policy: strict-origin-when-cross-origin
```

#### 5. Permissions-Policy

Controls browser features and APIs.

```
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```

### Configuration

```bash
# Enable/disable all security headers
SECURITY_HEADERS_ENABLED=true

# Enable/disable CSP separately
CSP_ENABLED=true

# Custom HSTS duration
HSTS_MAX_AGE=31536000
```

## Session Security

### Secure Cookie Configuration

```javascript
{
  secure: true,              // HTTPS only in production
  httpOnly: true,            // Prevent JavaScript access
  maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  sameSite: 'strict',        // CSRF protection
  path: '/',                 // Available for entire domain
  domain: 'your-domain.com'  // Set in production
}
```

### Session Encryption

Sessions are encrypted using AES-256-GCM:

```bash
# Generate a secure encryption key
SESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

## Content Security Policy

### Default Policy

```javascript
{
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: ["'self'", "https://api.github.com"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"]
}
```

## Environment Variables

### Required for Production

```bash
NODE_ENV=production
FORCE_HTTPS=true
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true
HSTS_MAX_AGE=31536000
SESSION_SECRET=<generate-with-openssl-rand-hex-32>
SESSION_ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>
COOKIE_DOMAIN=your-domain.com
USE_REDIS_SESSIONS=true
```

### Generating Secure Keys

```bash
# Session secret
openssl rand -hex 32

# Session encryption key
openssl rand -hex 32
```

## Testing Security

### Automated Tests

```bash
npm run test:run -- server/__tests__/security-headers.test.ts
```

### Manual Testing

```bash
# Check security headers
curl -I https://your-app.com/api/health
```

### Security Scanning Tools

- Mozilla Observatory: https://observatory.mozilla.org/
- Security Headers: https://securityheaders.com/
- SSL Labs: https://www.ssllabs.com/ssltest/

## Production Deployment

### Render Configuration

Set in Render dashboard:

```bash
NODE_ENV=production
FORCE_HTTPS=true
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true
SESSION_SECRET=<your-secret>
SESSION_ENCRYPTION_KEY=<your-key>
COOKIE_DOMAIN=your-app.onrender.com
```

## Security Checklist

### Pre-Deployment
- [ ] Generate secure session secret
- [ ] Generate secure encryption key
- [ ] Configure environment variables
- [ ] Enable HTTPS enforcement
- [ ] Enable security headers
- [ ] Test locally with production settings

### Post-Deployment
- [ ] Verify HTTPS redirect works
- [ ] Check all security headers are present
- [ ] Test session cookies are secure
- [ ] Run security scans
- [ ] Monitor for CSP violations

## Additional Resources

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Content Security Policy Reference](https://content-security-policy.com/)
