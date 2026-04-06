---
title: "Troubleshooting"
description: "Solutions to common issues"
category: "troubleshooting"
order: 1
lastUpdated: "2025-01-10"
---

# Troubleshooting Guide

Quick solutions to common issues with RepoRadar.

## Quick Fixes

Try these first for most issues:

1. **Refresh the page** (Ctrl/Cmd + R)
2. **Clear browser cache** (Ctrl/Cmd + Shift + Delete)
3. **Try incognito/private mode**
4. **Check your internet connection**
5. **Try a different browser**

## Common Issues

### Analysis Problems

**Analysis taking too long or stuck:**
- Wait 30-60 seconds (large repos take time)
- Refresh and try again
- Try a smaller repository first
- Check [GitHub Status](https://www.githubstatus.com/)

**Analysis failed with error:**
- Verify repository URL is correct
- Ensure repository is public
- Check if you've hit rate limits
- Wait a few minutes and retry

**Scores seem incorrect:**
- Read detailed explanations for context
- Re-analyze if repository was recently updated
- Remember scores are AI opinions, not absolute truth
- Report clearly wrong analyses to support

### Authentication Issues

**Can't sign in:**
- Enable third-party cookies in browser
- Try incognito/private mode
- Disable browser extensions temporarily
- Check [GitHub Status](https://www.githubstatus.com/)

**Session expired:**
- Simply sign in again
- Sessions expire after 30 days of inactivity

**GitHub authorization failed:**
- Revoke app in [GitHub Settings](https://github.com/settings/applications)
- Sign in again and re-authorize

### Search & Discovery

**No search results:**
- Remove some filters (may be too restrictive)
- Check for typos in language names
- Broaden star count range
- Expand date range

**Filters not working:**
- Ensure at least one filter is set
- Check for validation errors
- Clear all and start over
- Refresh the page

### Performance Issues

**Page loading slowly:**
- Clear browser cache
- Disable browser extensions
- Check internet speed
- Close unused tabs
- Try different browser

**Dashboard not loading:**
- Refresh the page
- Verify you have analyses (dashboard needs data)
- Check subscription status (Pro feature)
- Clear browser cache

### Export Issues

**PDF export failing:**
- Try again (may be temporary)
- Check browser download settings
- Try different browser
- Verify disk space available

**CSV won't open properly:**
- Open Excel → Import → CSV
- Select UTF-8 encoding
- Set delimiter to comma
- For Google Sheets: File → Import

### Subscription & Billing

**Payment failed:**
- Verify card details
- Check sufficient funds
- Ensure international payments enabled
- Try different payment method
- Contact your bank

**Pro features not available:**
- Sign out and sign in again
- Check subscription status in profile
- Wait 5-10 minutes for activation
- Contact support with payment confirmation

## Error Messages

### "Repository not found"
- Check repository exists on GitHub
- Verify URL format: `owner/repo`
- Ensure repository is public

### "Rate limit exceeded"
- Wait for reset (time shown in error)
- Upgrade to Pro for higher limits
- Use batch analysis (more efficient)

### "AI service unavailable"
- Check [Google AI Status](https://status.cloud.google.com/)
- Wait 5-10 minutes and retry
- Contact support if persists

### "Authentication failed"
- Enable third-party cookies
- Clear browser cache
- Try incognito mode
- Check GitHub authorization

### "Session expired"
- Sign in again
- Enable "Remember me"
- Check browser cookie settings

## Self-Hosted Issues

### Database connection failed

```bash
# Check DATABASE_URL
cat .env | grep DATABASE_URL

# Test connection
npm run health:check

# Push schema
npm run db:push
```

### Gemini API not working

```bash
# Verify API key
echo $GEMINI_API_KEY

# Check configuration
npm run config:validate

# Test API
npm run health:check
```

### Server won't start

```bash
# Check for errors
npm run dev

# Verify dependencies
npm install

# Check port availability
# (default: 5000)

# Review logs
npm run health:check
```

## Browser-Specific Issues

### Chrome/Edge

**Clear cache:**
1. Ctrl + Shift + Delete
2. Select "Cached images and files"
3. Click "Clear data"

**Enable cookies:**
1. Settings → Privacy → Cookies
2. Allow cookies for reporadar.com

### Firefox

**Clear cache:**
1. Ctrl + Shift + Delete
2. Select "Cache"
3. Click "Clear Now"

**Enable cookies:**
1. Settings → Privacy → Cookies
2. Add exception for reporadar.com

### Safari

**Clear cache:**
1. Cmd + Option + E
2. Or Safari → Clear History

**Enable cookies:**
1. Preferences → Privacy
2. Uncheck "Prevent cross-site tracking"

## Getting Help

### Before Contacting Support

Gather this information:
- Exact error message or screenshot
- Repository URL (if applicable)
- Browser and version
- Steps to reproduce
- When it started
- Your account email

### Support Channels

**Instant Help:**
- **AI Assistant** (bottom-right corner) - Available 24/7

**Documentation:**
- [Common Issues](./common-issues.md) - Detailed solutions
- [FAQ](../faq/index.md) - Frequently asked questions
- [Feature Guides](../features/index.md) - How-to guides

**Community:**
- GitHub Issues - Bug reports
- Discord Server - Community help
- Community Forum - Discussions

**Direct Support:**
- **Email:** support@reporadar.com
- **Response Time:**
  - Free: 24-48 hours
  - Pro: 4-8 hours
  - Enterprise: 1-2 hours

## Detailed Guides

For comprehensive troubleshooting:

- [Common Issues](./common-issues.md) - In-depth solutions
- [Installation Issues](../getting-started/installation.md) - Setup problems
- [API Issues](../API_DOCUMENTATION.md) - Developer problems
- [Performance Issues](../PERFORMANCE_CONFIGURATION.md) - Speed optimization

## Prevention Tips

**For Best Experience:**
1. Keep browser updated
2. Clear cache weekly
3. Use supported browsers (Chrome, Firefox, Safari, Edge)
4. Stable internet connection
5. Don't exceed rate limits

**For Self-Hosters:**
1. Keep dependencies updated
2. Monitor server health
3. Regular database backups
4. Configure caching
5. Set up monitoring alerts

## Still Having Issues?

If you've tried these solutions:

1. Check [Common Issues](./common-issues.md) for detailed help
2. Ask the **AI Assistant** (bottom-right corner)
3. Search [FAQ](../faq/index.md) for your specific issue
4. Contact **support@reporadar.com** with details
5. Report bugs on **GitHub Issues**

Most issues have simple solutions - start with the quick fixes above!
