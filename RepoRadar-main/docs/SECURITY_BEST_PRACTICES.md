# Security Best Practices Guide

This guide provides a comprehensive security checklist for deploying RepoRadar in production.

## Pre-Deployment Checklist

### Environment Variables

- [ ] Change `SESSION_SECRET` from default value
- [ ] Change `SESSION_ENCRYPTION_KEY` from default value (64-char hex)
- [ ] Use strong, randomly generated secrets
- [ ] Never commit secrets to version control
- [ ] Use different secrets for dev/staging/production

### HTTPS Configuration

- [ ] Enable `FORCE_HTTPS=true` in production
- [ ] Configure HSTS headers with appropriate max-age
- [ ] Obtain valid SSL/TLS certificate
- [ ] Configure certificate auto-renewal
- [ ] Test HTTPS redirect functionality

### Authentication

- [ ] Configure OAuth providers (Google, GitHub)
- [ ] Set up email service for password reset
- [ ] Configure rate limiting for auth endpoints
- [ ] Test account lockout functionality
- [ ] Verify password strength requirements

### Database Security

- [ ] Use strong database password
- [ ] Enable SSL/TLS for database connections
- [ ] Restrict database access by IP
- [ ] Enable database audit logging
- [ ] Set up automated backups

### Session Security

- [ ] Enable Redis sessions for multi-instance deployments
- [ ] Configure appropriate session timeout
- [ ] Enable session regeneration on login
- [ ] Enable session metadata tracking
- [ ] Test session invalidation

## Configuration Security

### Secrets Management

Generate secure secrets:

```bash
# Generate SESSION_SECRET (32 bytes)
openssl rand -hex 32

# Generate SESSION_ENCRYPTION_KEY (32 bytes)
openssl rand -hex 32
```

### Environment Variables

Never hardcode secrets:

```bash
# ❌ Bad
const secret = "my-secret-key";

# ✅ Good
const secret = process.env.SESSION_SECRET;
```

### Secret Rotation

Rotate secrets regularly:

1. Generate new secrets
2. Update environment variables
3. Restart application
4. Invalidate old sessions (if rotating session secrets)

## Authentication Security

### Password Security

- **Minimum Length**: 8 characters
- **Hashing**: bcrypt with cost factor 12
- **Storage**: Never store plaintext passwords
- **Validation**: Enforce password strength requirements

### Account Lockout

- **Failed Attempts**: 5 attempts
- **Lockout Duration**: 15 minutes
- **Notification**: Email user about lockout
- **Reset**: Allow unlock via email

### OAuth Security

- **Callback URLs**: Whitelist only trusted URLs
- **State Parameter**: Validate to prevent CSRF
- **Token Storage**: Store securely, never in localStorage
- **Scope Limitation**: Request minimum required scopes

### Password Reset

- **Token Expiration**: 1 hour
- **Single Use**: Tokens can only be used once
- **Rate Limiting**: 3 attempts per hour
- **Notification**: Email user about reset request

## Session Security

### Session Configuration

```bash
# Recommended production settings
SESSION_TIMEOUT=604800000              # 7 days
SESSION_REGENERATE_ON_LOGIN=true
SESSION_TRACK_METADATA=true
SESSION_SLIDING_WINDOW=true
SESSION_SUSPICIOUS_ACTIVITY_CHECK=true
```

### Session Storage

- **Development**: PostgreSQL sessions acceptable
- **Production**: Use Redis for multi-instance deployments
- **Encryption**: All session data is encrypted
- **Cleanup**: Expired sessions are automatically removed

### Session Validation

Sessions are validated on every request:

- Session exists and is not expired
- IP address matches (if tracking enabled)
- User agent matches (if tracking enabled)
- User account is still active

## Rate Limiting

### Configuration

```bash
# Authentication endpoints
RATE_LIMIT_AUTH_LOGIN_LIMIT=5
RATE_LIMIT_AUTH_LOGIN_WINDOW=900000    # 15 min

# API endpoints
RATE_LIMIT_API_FREE_LIMIT=100
RATE_LIMIT_API_FREE_WINDOW=3600000     # 1 hour

# Use Redis in production
RATE_LIMIT_STORAGE=redis
RATE_LIMIT_REDIS_URL=redis://your-redis-host:6379
```

### Monitoring

Monitor rate limiting:

- Track rate limit violations
- Alert on unusual patterns
- Review top rate-limited IPs/users
- Adjust limits based on usage

## HTTPS & Transport Security

### SSL/TLS Configuration

- **Protocol**: TLS 1.2 or higher
- **Cipher Suites**: Strong ciphers only
- **Certificate**: Valid, not self-signed
- **Renewal**: Automated (e.g., Let's Encrypt)

### HSTS Configuration

```bash
FORCE_HTTPS=true
HSTS_MAX_AGE=31536000                  # 1 year
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=false                     # Enable after testing
```

### Security Headers

All security headers are enabled by default:

- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: DENY
- **X-XSS-Protection**: 1; mode=block
- **Content-Security-Policy**: Configured
- **Strict-Transport-Security**: Configured

## Database Security

### Connection Security

```bash
# Use SSL/TLS for database connections
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

### Access Control

- Use least privilege principle
- Create separate database users for different services
- Restrict database access by IP address
- Enable audit logging

### Query Security

- Use parameterized queries (Drizzle ORM handles this)
- Validate all user input
- Sanitize data before storage
- Monitor for SQL injection attempts

## API Security

### Authentication

- Require authentication for all protected endpoints
- Use secure session cookies
- Validate session on every request
- Implement proper authorization checks

### Input Validation

- Validate all input data
- Sanitize user-provided content
- Use TypeScript for type safety
- Implement request size limits

### Error Handling

- Don't expose sensitive information in errors
- Log errors securely
- Return generic error messages to clients
- Monitor error rates

## Monitoring & Logging

### Security Logging

Log security-relevant events:

- Failed login attempts
- Account lockouts
- Password resets
- Session invalidations
- Rate limit violations
- Suspicious activity

### Log Security

- Don't log sensitive data (passwords, tokens)
- Secure log storage
- Implement log rotation
- Monitor logs for security events

### Alerting

Set up alerts for:

- Multiple failed login attempts
- Unusual rate limit violations
- Database connection failures
- Certificate expiration
- Suspicious activity patterns

## Incident Response

### Preparation

- Document incident response procedures
- Maintain contact list for security team
- Set up monitoring and alerting
- Regular security audits

### Detection

Monitor for:

- Unusual login patterns
- Spike in failed authentication
- Unusual API usage
- Database anomalies

### Response

If security incident detected:

1. Isolate affected systems
2. Investigate and document
3. Notify affected users
4. Implement fixes
5. Review and improve security

## Compliance

### Data Protection

- Encrypt sensitive data at rest
- Encrypt data in transit (HTTPS)
- Implement data retention policies
- Provide data export/deletion

### Privacy

- Collect minimum necessary data
- Provide privacy policy
- Allow users to delete accounts
- Implement consent management

### Audit Trail

- Log all security-relevant events
- Maintain audit logs
- Implement log retention
- Provide audit reports

## Regular Maintenance

### Weekly

- [ ] Review security logs
- [ ] Check for failed login attempts
- [ ] Monitor rate limit violations
- [ ] Review error logs

### Monthly

- [ ] Update dependencies
- [ ] Review access controls
- [ ] Test backup restoration
- [ ] Review security alerts

### Quarterly

- [ ] Rotate secrets
- [ ] Security audit
- [ ] Penetration testing
- [ ] Update security documentation

### Annually

- [ ] Comprehensive security review
- [ ] Update security policies
- [ ] Review compliance requirements
- [ ] Security training for team

## Security Testing

### Before Deployment

- [ ] Test authentication flows
- [ ] Test rate limiting
- [ ] Test session management
- [ ] Test HTTPS enforcement
- [ ] Test error handling
- [ ] Test input validation

### Automated Testing

- Run security tests in CI/CD
- Use static analysis tools
- Scan for vulnerabilities
- Test for common security issues

### Manual Testing

- Penetration testing
- Security code review
- Configuration review
- Access control testing

## Common Vulnerabilities

### SQL Injection

**Prevention**:
- Use Drizzle ORM (parameterized queries)
- Validate all input
- Never concatenate SQL strings

### XSS (Cross-Site Scripting)

**Prevention**:
- Sanitize user input
- Use Content Security Policy
- Escape output in templates
- Use React (auto-escapes by default)

### CSRF (Cross-Site Request Forgery)

**Prevention**:
- Use SameSite cookies
- Validate origin headers
- Implement CSRF tokens for state-changing operations

### Session Hijacking

**Prevention**:
- Use HTTPS only
- Secure cookie flags
- Session regeneration
- IP/User-Agent validation

### Brute Force Attacks

**Prevention**:
- Rate limiting
- Account lockout
- CAPTCHA after threshold
- Monitor failed attempts

## Resources

### Tools

- **OWASP ZAP**: Security testing
- **npm audit**: Dependency vulnerabilities
- **Snyk**: Continuous security monitoring
- **SSL Labs**: SSL/TLS testing

### Documentation

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

### Related Guides

- [OAuth Setup Guide](OAUTH_SETUP.md)
- [Email Service Guide](EMAIL_SERVICE.md)
- [Rate Limiting Guide](RATE_LIMITING.md)

## Support

For security issues:

- **Email**: security@reporadar.com
- **Response Time**: 24 hours
- **Disclosure**: Responsible disclosure policy

Never disclose security vulnerabilities publicly before they are fixed.
