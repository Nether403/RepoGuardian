# Rollback Procedures for Render Deployment

Complete guide for rolling back RepoRadar deployments on Render, including automatic rollback behavior, manual procedures, and rollback verification steps.

## Table of Contents

1. [Overview](#overview)
2. [Automatic Rollback](#automatic-rollback)
3. [Manual Rollback Procedures](#manual-rollback-procedures)
4. [Rollback Considerations](#rollback-considerations)
5. [Rollback Verification](#rollback-verification)
6. [Emergency Rollback](#emergency-rollback)
7. [Post-Rollback Actions](#post-rollback-actions)
8. [Preventing Rollback Needs](#preventing-rollback-needs)

## Overview

Rollback is the process of reverting your application to a previous working version when a deployment introduces issues. Render provides both automatic and manual rollback capabilities to ensure your application remains stable.

### When to Rollback

Consider rolling back when:
- New deployment causes application crashes
- Critical functionality is broken
- Performance degrades significantly
- Security vulnerabilities are introduced
- Database migrations fail
- Health checks consistently fail
- User-reported critical bugs

### Rollback Types

**Automatic Rollback**: Render automatically reverts when health checks fail
**Manual Rollback**: You initiate rollback via dashboard or Git
**Emergency Rollback**: Fast rollback for critical production issues

## Automatic Rollback

Render automatically rolls back deployments when certain failure conditions are met.

### Automatic Rollback Triggers

Render will automatically rollback when:

1. **Health Check Failures**
   - 3 consecutive health check failures after deployment
   - Health endpoint returns 503 (unhealthy status)
   - Health endpoint times out (no response within 10 seconds)

2. **Application Startup Failures**
   - Application crashes during startup
   - Start command exits with non-zero code
   - Application fails to bind to PORT

3. **Build Failures**
   - Build command fails (exits with non-zero code)
   - Out of memory during build
   - Missing dependencies or compilation errors

### Automatic Rollback Behavior

When automatic rollback occurs:

New Deployment Starts ↓ Build Phase Completes ↓ Start Phase Begins ↓ Health Checks Run (3 attempts) ↓ Health Checks Fail ↓ Automatic Rollback Triggered ↓ Previous Version Restored ↓ Traffic Routes to Previous Version ↓ Notification Sent (if configured)


### Monitoring Automatic Rollback

**In Render Dashboard:**
1. Go to your service
2. Click "Events" tab
3. Look for "Deploy failed" or "Rolled back" messages
4. Check "Logs" tab for error details

**Notification:**
- Render sends email notification on rollback (if configured)
- Check deployment status in Events tab
- Review logs to identify root cause

### No Manual Intervention Required

Automatic rollback requires no action from you:
- Previous working version is restored automatically
- Traffic is routed back to stable version
- No downtime for users
- You can investigate and fix issues at your own pace

## Manual Rollback Procedures

When you need to manually rollback a deployment that passed health checks but has issues.

### Method 1: Rollback via Render Dashboard (Recommended)

This is the fastest and safest method for rolling back.

**Step-by-Step:**

1. **Navigate to Service**
Render Dashboard → Your Service → Events Tab


2. **Find Previous Deployment**
- Scroll through deployment history
- Identify the last known working deployment
- Note the commit hash and timestamp

3. **Initiate Rollback**
- Click the three dots (⋯) next to the working deployment
- Select "Rollback to this version"
- Confirm the rollback action

4. **Monitor Rollback**
- Watch the Events tab for rollback progress
- Check Logs tab for any errors
- Verify health endpoint returns 200 OK

5. **Verify Application**
- Test critical functionality
- Check user-facing features
- Monitor error rates

**Timeline:**
- Rollback initiation: Immediate
- Deployment time: 2-5 minutes (no rebuild needed)
- Health check validation: 30-60 seconds
- Total time: ~3-6 minutes

### Method 2: Rollback via Git Revert

Use this method when you want to create a new commit that undoes changes.

**Step-by-Step:**

1. **Identify Problem Commit**
```bash
# View recent commits
git log --oneline -10

# Example output:
# abc1234 Add new feature (PROBLEM)
# def5678 Fix bug
# ghi9012 Update docs (LAST WORKING)
Revert the Commit

# Revert specific commit (creates new commit)
git revert abc1234

# Or revert multiple commits
git revert abc1234 def5678

# Resolve any conflicts if they occur
git add .
git revert --continue
Push to Trigger Deployment

# Push revert commit
git push origin main

# Render will automatically deploy the revert
Monitor Deployment

Watch Render dashboard Events tab
Check build and deploy logs
Verify health checks pass
Advantages:

Creates audit trail in Git history
Preserves all commit history
Can be reverted again if needed
Team can see what was rolled back
Disadvantages:

Requires full rebuild (slower)
May have merge conflicts
Takes longer than dashboard rollback
Method 3: Rollback via Git Reset (Use with Caution)
Use this method only in emergencies when you need to completely remove commits.

⚠️ WARNING: This rewrites Git history. Use only when necessary.

Step-by-Step:

Identify Working Commit

# View commit history
git log --oneline -10

# Find the last working commit hash
# Example: ghi9012
Reset to Working Commit

# Reset to specific commit (removes all commits after it)
git reset --hard ghi9012
Force Push

# Force push to remote (overwrites history)
git push --force origin main

# Render will automatically deploy this version
Notify Team

Inform team members of force push
Team members need to reset their local branches
git fetch origin
git reset --hard origin/main
Advantages:

Fastest rollback method
Completely removes problematic commits
Clean history
Disadvantages:

Rewrites Git history (dangerous)
Requires force push
Team members must reset local branches
Lost commits are hard to recover
When to Use:

Emergency situations only
When revert creates too many conflicts
When you need to remove sensitive data
When problematic commits are not yet public
Method 4: Deploy Specific Commit
Deploy a specific previous commit without changing Git history.

Step-by-Step:

Find Working Commit

git log --oneline -20
Deploy via Render Dashboard

Go to Render Dashboard → Your Service
Click "Manual Deploy" button
Select "Deploy commit"
Enter the commit hash (e.g., ghi9012)
Click "Deploy"
Monitor Deployment

Watch Events tab
Verify health checks pass
Test application functionality
Advantages:

No Git changes required
Fast deployment
Can test specific versions
Doesn't affect Git history
Disadvantages:

Temporary solution
Next Git push will deploy latest code
Need to fix and push proper solution
Rollback Considerations
Important factors to consider before and during rollback.

Database Migrations
Critical Consideration: Database migrations may not be automatically reversed.

Before Rollback
Check for Recent Migrations

# Review recent migration files
ls -la server/migrations/

# Check migration history in database
psql "$DATABASE_URL" -c "SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
Assess Migration Impact

Additive migrations (ADD COLUMN, CREATE TABLE): Usually safe, old code ignores new fields
Destructive migrations (DROP COLUMN, DROP TABLE): Dangerous, old code may break
Schema changes (ALTER COLUMN): May cause compatibility issues
Migration Rollback Strategies
Strategy 1: Leave Migrations in Place (Recommended)

If migrations are additive (new columns, new tables):

-- New columns added in recent deployment
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;

-- Old code will ignore this column
-- No rollback needed
Strategy 2: Manual Migration Reversal

If migrations are destructive or breaking:

# Connect to database
psql "$DATABASE_URL"

# Manually reverse migration
-- Example: If migration added a column
ALTER TABLE users DROP COLUMN last_login;

-- Example: If migration dropped a column (restore from backup)
ALTER TABLE users ADD COLUMN old_field VARCHAR(255);

-- Example: If migration changed column type
ALTER TABLE users ALTER COLUMN age TYPE INTEGER;
Strategy 3: Database Backup Restore

For critical issues:

# Restore from Neon backup
# 1. Go to Neon dashboard
# 2. Select your project
# 3. Go to "Backups" tab
# 4. Select backup before migration
# 5. Click "Restore"
Migration Best Practices
To avoid migration issues during rollback:

Use Backward-Compatible Migrations

-- Good: Add nullable column
ALTER TABLE users ADD COLUMN email VARCHAR(255);

-- Bad: Add non-nullable column without default
ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL;
Deploy Migrations Separately

Deploy migration in one release
Deploy code changes in next release
Allows rollback without migration issues
Test Migrations in Staging

Always test migrations in staging first
Verify rollback scenarios
Check old code compatibility
Keep Migration History

Don't delete migration files
Document migration purpose
Track which deployment included which migrations
Environment Variables
Environment variables may have changed between versions.

Check Variable Compatibility
Before Rollback:

Review Recent Variable Changes

Render Dashboard → Environment Tab → View History
Identify New Variables

Variables added in recent deployment
Variables removed in recent deployment
Variables with changed values
Assess Compatibility

Will old code work with new variables?
Does old code require removed variables?
Are variable formats compatible?
Variable Rollback Actions
If New Variables Were Added:

# Option 1: Leave them (old code will ignore)
# No action needed if variables are optional

# Option 2: Remove them if they cause issues
# Render Dashboard → Environment → Delete variable
If Variables Were Removed:

# Restore removed variables
# Render Dashboard → Environment → Add variable
# Use previous values from history
If Variable Values Changed:

# Revert to previous values
# Render Dashboard → Environment → Edit variable
# Check history for previous value
Environment Variable Best Practices
Document Variable Changes

Note which deployment added/changed variables
Keep changelog of variable updates
Document variable dependencies
Use Backward-Compatible Defaults

// Good: Provide fallback
const newFeature = process.env.NEW_FEATURE_ENABLED === 'true' || false;

// Bad: Assume variable exists
const newFeature = process.env.NEW_FEATURE_ENABLED;
Test with Old Variables

Test new code with old variable set
Verify graceful degradation
Check for missing variable errors
External Services
External service compatibility must be verified.

API Version Compatibility
Check Before Rollback:

Gemini API

Verify old code works with current API version
Check for deprecated endpoints
Review API changelog
OpenAI API

Check model availability
Verify API key compatibility
Review rate limits
GitHub API

Check API version compatibility
Verify token permissions
Review rate limit changes
Stripe API

Check webhook compatibility
Verify API version
Review product/price IDs
Webhook Configurations
Verify Webhooks:

# Check Stripe webhooks
# Stripe Dashboard → Developers → Webhooks
# Verify endpoint URL and events

# Check GitHub webhooks (if applicable)
# GitHub Repo → Settings → Webhooks
# Verify payload URL and events
External Service Rollback Actions
If API Versions Changed:

Check external service dashboard
Verify old code compatibility
Update API keys if needed
Test integrations after rollback
If Webhooks Changed:

Update webhook URLs if needed
Verify webhook signatures
Test webhook delivery
Check webhook logs
Redis and Cache
Cache and session data considerations.

Cache Invalidation
After Rollback:

# Option 1: Clear all cache (safest)
redis-cli -u "$REDIS_URL" FLUSHDB

# Option 2: Clear specific keys
redis-cli -u "$REDIS_URL" DEL "cache:*"

# Option 3: Let cache expire naturally
# Wait for TTL to expire (default: 1 hour)
Session Compatibility
Check Session Structure:

If using Redis sessions:

Old code may not understand new session structure
Consider clearing sessions: redis-cli FLUSHDB
Users will need to log in again
If using PostgreSQL sessions:

Sessions stored in database
Old code should handle gracefully
Monitor for session errors
Cache Best Practices
Version Cache Keys

// Good: Include version in key
const cacheKey = `v2:user:${userId}`;

// Bad: Unversioned key
const cacheKey = `user:${userId}`;
Use Short TTLs

Shorter TTLs reduce rollback impact
Cache expires naturally
Less manual cleanup needed
Handle Cache Misses

Always handle missing cache gracefully
Rebuild cache from database
Don't assume cache exists
Rollback Verification
Steps to verify rollback was successful.

Immediate Verification (0-5 minutes)
1. Check Deployment Status

# In Render Dashboard
# Events Tab → Verify "Deploy succeeded" message
# Note the commit hash and timestamp
2. Test Health Endpoint

# Check health endpoint
curl https://your-app.onrender.com/health

# Expected: 200 OK with "healthy" status
# Verify all checks are healthy
3. Check Application Logs

# In Render Dashboard → Logs Tab
# Look for:
# - "Server started on port 10000"
# - "Database connected successfully"
# - No error messages
# - Correct version/commit hash in logs
4. Verify Application Loads

# Visit application URL
https://your-app.onrender.com

# Check:
# - Frontend loads correctly
# - No JavaScript errors in console
# - Assets load properly
Functional Verification (5-15 minutes)
5. Test Critical User Flows

# Test authentication
# - User login
# - User registration
# - Session persistence

# Test core features
# - Repository analysis
# - View analysis results
# - Bookmarking
# - Search functionality

# Test data operations
# - Create operations
# - Read operations
# - Update operations
# - Delete operations
6. Test API Endpoints

# Test health endpoint
curl https://your-app.onrender.com/api/health

# Test authentication endpoint
curl https://your-app.onrender.com/api/user

# Test analysis endpoint
curl -X POST https://your-app.onrender.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/user/repo"}'
7. Test WebSocket Connections

# Open browser DevTools → Network → WS tab
# Verify WebSocket connection status
# Check for connection errors
# Test real-time features
8. Verify Database Operations

# Test database connectivity
psql "$DATABASE_URL" -c "SELECT 1"

# Check recent data
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users"

# Verify data integrity
# Check that no data was lost during rollback
Performance Verification (15-30 minutes)
9. Monitor Performance Metrics

# In Render Dashboard → Metrics Tab
# Check:
# - CPU usage (should be < 70%)
# - Memory usage (should be < 80%)
# - Response times (should be < 2s)
# - Error rates (should be < 1%)
10. Check Performance Dashboard

# Access internal performance dashboard
curl https://your-app.onrender.com/api/performance/dashboard

# Review:
# - Average response times
# - Database query performance
# - Cache hit rates
# - Error rates
11. Review Slow Query Logs

# In Render Dashboard → Logs Tab
# Search for: "Slow query detected"
# Verify no new slow queries
# Compare with pre-deployment performance
Extended Verification (30+ minutes)
12. Monitor Error Rates

# In Render Dashboard → Logs Tab
# Filter by: ERROR level
# Check for:
# - Unexpected errors
# - Increased error frequency
# - New error types
13. Check External Integrations

# Verify external services
# - Gemini API calls working
# - GitHub API calls working
# - Stripe webhooks working (if applicable)
# - Email sending working (if applicable)

# Check external service dashboards
# - Review API usage
# - Check for errors
# - Verify rate limits
14. User Acceptance Testing

# Have team members test
# - Critical workflows
# - Edge cases
# - Recently reported issues

# Monitor user feedback
# - Check support channels
# - Review user reports
# - Monitor social media
Verification Checklist
Use this checklist to ensure complete verification:

[ ] Deployment status shows success
[ ] Health endpoint returns 200 OK
[ ] Application logs show no errors
[ ] Frontend loads correctly
[ ] User authentication works
[ ] Core features functional
[ ] API endpoints responding
[ ] WebSocket connections stable
[ ] Database operations working
[ ] Performance metrics normal
[ ] No increase in error rates
[ ] External integrations working
[ ] Team verification complete
[ ] No user-reported issues
Emergency Rollback
Fast rollback procedures for critical production issues.

When to Use Emergency Rollback
Use emergency rollback when:

Application is completely down
Critical security vulnerability discovered
Data corruption occurring
Massive error rates (>50%)
Revenue-impacting issues
Legal/compliance issues
Emergency Rollback Procedure
Step 1: Immediate Action (0-2 minutes)

# Option A: Dashboard rollback (fastest)
# 1. Go to Render Dashboard
# 2. Events Tab → Find last working deployment
# 3. Click ⋯ → Rollback to this version
# 4. Confirm immediately

# Option B: Git force push (if dashboard unavailable)
git log --oneline -10
git reset --hard <last-working-commit>
git push --force origin main
Step 2: Notify Stakeholders (2-5 minutes)

# Notify team immediately
# - Post in team chat
# - Send email to stakeholders
# - Update status page (if applicable)

# Example message:
"URGENT: Production issue detected. Emergency rollback in progress.
Previous version being restored. ETA: 5 minutes.
Will provide updates every 10 minutes."
Step 3: Monitor Rollback (5-10 minutes)

# Watch deployment progress
# Render Dashboard → Events Tab

# Monitor health endpoint
watch -n 5 'curl -s https://your-app.onrender.com/health | jq .'

# Check logs for errors
# Render Dashboard → Logs Tab
Step 4: Verify Critical Functions (10-15 minutes)

# Test only critical paths
# - User login
# - Core business function
# - Payment processing (if applicable)
# - Data integrity

# Skip non-critical testing
# Focus on getting service stable
Step 5: Communicate Status (15-20 minutes)

# Update stakeholders
"Rollback complete. Service restored to previous version.
Critical functions verified working.
Investigating root cause.
Full post-mortem to follow."
Emergency Rollback Checklist
[ ] Identify critical issue
[ ] Initiate rollback immediately
[ ] Notify team and stakeholders
[ ] Monitor rollback progress
[ ] Verify critical functions only
[ ] Communicate status updates
[ ] Document incident
[ ] Schedule post-mortem
Post-Emergency Actions
Immediate (0-1 hour):

Document what happened
Capture logs and metrics
Identify root cause
Communicate timeline for fix
Short-term (1-24 hours):

Conduct post-mortem meeting
Create action items
Implement monitoring improvements
Update runbooks
Long-term (1-7 days):

Implement preventive measures
Update deployment procedures
Improve testing coverage
Train team on lessons learned
Post-Rollback Actions
Actions to take after successful rollback.

Immediate Actions (0-1 hour)
1. Document the Incident

Create incident report with:

# Incident Report: [Date]

## Summary
- What happened
- When it was detected
- Impact on users
- Rollback decision

## Timeline
- [Time] Issue detected
- [Time] Rollback initiated
- [Time] Rollback completed
- [Time] Service verified

## Root Cause
- What caused the issue
- Why it wasn't caught earlier
- What failed in testing

## Resolution
- Rollback to version [commit]
- Verification steps taken
- Current status
2. Notify Stakeholders

# Send update to:
# - Development team
# - Product managers
# - Customer support
# - Executive team (if major incident)

# Include:
# - What happened
# - Current status
# - Next steps
# - Timeline for fix
3. Preserve Evidence

# Save logs from failed deployment
# Render Dashboard → Logs → Download logs

# Save metrics and screenshots
# Capture error rates, response times, etc.

# Save database state (if relevant)
# Take database snapshot for analysis
Short-term Actions (1-24 hours)
4. Conduct Root Cause Analysis

# Analyze what went wrong
# - Review code changes
# - Check test coverage
# - Examine deployment process
# - Review monitoring alerts

# Questions to answer:
# - What was the root cause?
# - Why wasn't it caught in testing?
# - What monitoring could have detected it earlier?
# - How can we prevent this in the future?
5. Create Fix Plan

# Document fix approach
# - What needs to be fixed
# - How to fix it
# - How to test the fix
# - Deployment strategy

# Create tasks
# - Code fixes
# - Test improvements
# - Monitoring enhancements
# - Documentation updates
6. Improve Testing

# Add tests for the issue
# - Unit tests
# - Integration tests
# - E2E tests
# - Performance tests

# Update test coverage
npm run test:coverage

# Add to CI/CD pipeline
# Ensure issue can't happen again
Long-term Actions (1-7 days)
7. Conduct Post-Mortem Meeting

# Schedule meeting with team
# - Developers
# - QA
# - DevOps
# - Product

# Agenda:
# - Review incident timeline
# - Discuss root cause
# - Identify action items
# - Assign owners and deadlines
# - Update procedures
8. Implement Preventive Measures

# Code improvements
# - Add error handling
# - Improve validation
# - Add feature flags
# - Implement circuit breakers

# Process improvements
# - Update deployment checklist
# - Improve staging environment
# - Add deployment gates
# - Require code reviews

# Monitoring improvements
# - Add new alerts
# - Improve dashboards
# - Set up error tracking
# - Implement synthetic monitoring
9. Update Documentation

# Update runbooks
# - Add new troubleshooting steps
# - Document new procedures
# - Update rollback guide
# - Add lessons learned

# Update deployment guide
# - Add new verification steps
# - Document new requirements
# - Update checklists
# - Add warnings
10. Train Team

# Share lessons learned
# - Present in team meeting
# - Update onboarding docs
# - Create training materials
# - Conduct drills

# Improve processes
# - Update code review guidelines
# - Improve testing standards
# - Enhance deployment procedures
# - Update incident response plan
Post-Rollback Checklist
[ ] Incident documented
[ ] Stakeholders notified
[ ] Evidence preserved
[ ] Root cause identified
[ ] Fix plan created
[ ] Tests improved
[ ] Post-mortem conducted
[ ] Preventive measures implemented
[ ] Documentation updated
[ ] Team trained
Preventing Rollback Needs
Best practices to minimize rollback requirements.

Pre-Deployment Testing
1. Local Testing

# Test production build locally
npm run build
NODE_ENV=production npm run start

# Run full test suite
npm run test:run

# Run E2E tests
npm run test:e2e

# Check for TypeScript errors
npm run check

# Validate configuration
npm run config:validate
2. Staging Environment

# Deploy to staging first
# - Test with production-like data
# - Test with production-like load
# - Test all integrations
# - Verify migrations

# Staging checklist:
# - All tests pass
# - Performance acceptable
# - No errors in logs
# - Integrations working
# - Migrations successful
3. Feature Flags

// Use feature flags for risky changes
const newFeatureEnabled = process.env.FEATURE_NEW_FEATURE === 'true';

if (newFeatureEnabled) {
  // New code path
} else {
  // Old code path (fallback)
}

// Benefits:
// - Deploy code without enabling
// - Enable for subset of users
// - Quick rollback (just toggle flag)
// - No code deployment needed
Deployment Best Practices
4. Gradual Rollout

# Deploy to single instance first
# - Monitor for issues
# - Verify functionality
# - Check performance

# Then scale to more instances
# - Gradual traffic increase
# - Monitor each step
# - Quick rollback if needed
5. Blue-Green Deployment

# Maintain two environments
# - Blue: Current production
# - Green: New version

# Deploy to green
# Test green thoroughly
# Switch traffic to green
# Keep blue as instant rollback
6. Canary Deployment

# Deploy to small percentage of users
# - 5% of traffic to new version
# - Monitor metrics closely
# - Gradually increase if stable
# - Quick rollback if issues
Monitoring and Alerting
7. Comprehensive Monitoring

# Monitor key metrics
# - Error rates
# - Response times
# - CPU/Memory usage
# - Database performance
# - Cache hit rates

# Set up alerts
# - Error rate > 5%
# - Response time > 2s
# - Memory usage > 85%
# - Database queries > 1s
8. Automated Health Checks

# Implement health checks
# - Database connectivity
# - Redis connectivity
# - External API availability
# - Critical functionality

# Configure Render health checks
# - Path: /health
# - Interval: 30 seconds
# - Timeout: 10 seconds
# - Threshold: 3 failures
9. Synthetic Monitoring

# Set up synthetic tests
# - Test critical user flows
# - Run every 5 minutes
# - Alert on failures
# - Verify from multiple locations

# Example: Uptime monitoring
# - Pingdom
# - UptimeRobot
# - StatusCake
Code Quality
10. Code Review

# Require code reviews
# - At least one approval
# - Check for common issues
# - Verify tests included
# - Review deployment impact

# Review checklist:
# - Tests added/updated
# - Documentation updated
# - Breaking changes noted
# - Migration plan included
11. Automated Testing

# CI/CD pipeline checks
# - Unit tests pass
# - Integration tests pass
# - E2E tests pass
# - Code coverage > 95%
# - No linting errors
# - No type errors

# Block deployment if tests fail
12. Database Migration Safety

# Safe migration practices
# - Always backward compatible
# - Test rollback scenario
# - Deploy migrations separately
# - Use transactions
# - Have backup plan

# Example: Safe column addition
ALTER TABLE users ADD COLUMN email VARCHAR(255);
-- Old code ignores new column
-- New code uses new column
-- Rollback safe
Prevention Checklist
[ ] All tests pass locally
[ ] Staging deployment successful
[ ] Feature flags implemented
[ ] Monitoring configured
[ ] Alerts set up
[ ] Code reviewed
[ ] Documentation updated
[ ] Rollback plan documented
[ ] Team notified
[ ] Backup plan ready
Summary
Quick Reference
Automatic Rollback:

Triggered by health check failures
No manual intervention needed
Previous version restored automatically
Manual Rollback:

Dashboard: Events → Rollback to version
Git revert: git revert <commit>
Git reset: git reset --hard <commit> (emergency only)
Verification:

Health endpoint: curl /health
Test critical functions
Monitor metrics
Check logs
Considerations:

Database migrations may need manual reversal
Environment variables may need adjustment
External services may need verification
Cache may need clearing
Key Takeaways
Automatic rollback protects you - Render automatically rolls back failed deployments
Manual rollback is fast - Dashboard rollback takes 3-6 minutes
Always verify - Test critical functions after rollback
Consider migrations - Database changes may need manual reversal
Document everything - Create incident reports and post-mortems
Prevent future issues - Improve testing and monitoring
Have a plan - Know rollback procedures before you need them
Related Documentation
Render Deployment Guide
Render Troubleshooting
Health Check Guide
Database Production Config
Environment Configuration
Support
If you need help with rollback:

Check this guide first
Review Render logs for errors
Check Render status: https://status.render.com
Contact Render support: support@render.com
Review Render community: https://community.render.com