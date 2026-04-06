# Common Issues and Solutions

## Analysis Issues

### Analysis Taking Too Long

**Symptoms:**
- Analysis stuck on "Analyzing..."
- Progress bar not moving
- Timeout after several minutes

**Common Causes:**
1. Large repository size (>100MB)
2. GitHub API rate limiting
3. High server load
4. Network connectivity issues
5. Gemini API delays

**Solutions:**

**Immediate fixes:**
```bash
1. Refresh the page and try again
2. Check your internet connection
3. Try a smaller repository first
4. Wait 5-10 minutes and retry
```

**If problem persists:**
- Check [GitHub Status](https://www.githubstatus.com/)
- Verify your API quota hasn't been exceeded
- Try during off-peak hours
- Contact support with repository URL

**For self-hosted instances:**
```bash
# Check server logs
npm run health:check

# Verify Gemini API key
echo $GEMINI_API_KEY

# Check database connection
npm run db:push
```

### Analysis Failed with Error

**Error: "Repository not found"**

**Causes:**
- Invalid repository URL
- Repository was deleted
- Repository is private
- Typo in repository name

**Solutions:**
1. Verify the repository exists on GitHub
2. Check URL format: `owner/repo` or `https://github.com/owner/repo`
3. Ensure repository is public (or upgrade to Pro for private repos)
4. Try copying URL directly from GitHub

**Error: "Rate limit exceeded"**

**Causes:**
- Too many analyses in short time
- GitHub API rate limit reached
- Gemini API quota exceeded

**Solutions:**
1. Wait for rate limit to reset (shown in error message)
2. Upgrade to Pro for higher limits
3. For self-hosted: Add GitHub Personal Access Token
4. Use batch analysis for multiple repos (more efficient)

**Error: "AI service unavailable"**

**Causes:**
- Gemini API outage
- API key invalid or expired
- Network connectivity issues
- Service maintenance

**Solutions:**
1. Check [Google AI Status](https://status.cloud.google.com/)
2. Wait 5-10 minutes and retry
3. For self-hosted: Verify `GEMINI_API_KEY` in `.env`
4. Contact support if issue persists

### Incorrect or Unexpected Scores

**Symptoms:**
- Scores seem too high or too low
- Scores don't match expectations
- Inconsistent results on re-analysis

**Understanding:**
- Scores are AI-generated opinions
- Based on available public data
- May differ from human judgment
- Can vary slightly between analyses

**What to do:**
1. Read the detailed explanations for each score
2. Check the strengths and weaknesses sections
3. Re-analyze if repository was recently updated
4. Use scores as one input, not the only factor
5. Report clearly incorrect analyses to support

**Improving accuracy:**
- Ensure repository has good README
- Add comprehensive documentation
- Include topics and description
- Maintain active development
- Add tests and examples

## Authentication Issues

### Can't Sign In

**Error: "Authentication failed"**

**Causes:**
- Browser blocking third-party cookies
- GitHub OAuth not authorized
- Network/firewall restrictions
- Browser extensions interfering

**Solutions:**

**Browser settings:**
```
Chrome/Edge:
1. Settings → Privacy → Cookies
2. Allow cookies for reporadar.com
3. Clear cache and cookies
4. Try again

Firefox:
1. Settings → Privacy → Cookies
2. Add exception for reporadar.com
3. Clear cache
4. Try again

Safari:
1. Preferences → Privacy
2. Uncheck "Prevent cross-site tracking"
3. Clear cache
4. Try again
```

**Other fixes:**
1. Try incognito/private browsing mode
2. Disable browser extensions temporarily
3. Try a different browser
4. Check if GitHub is accessible
5. Verify you're not behind a restrictive firewall

### Session Expired

**Symptoms:**
- Suddenly logged out
- "Session expired" message
- Need to sign in again

**Causes:**
- 30-day inactivity timeout
- Browser cleared cookies
- Server restart (self-hosted)
- Security token refresh

**Solutions:**
1. Simply sign in again
2. Enable "Remember me" if available
3. Check browser cookie settings
4. For frequent logouts: Contact support

### GitHub Authorization Issues

**Error: "GitHub authorization failed"**

**Solutions:**
1. Go to [GitHub Settings → Applications](https://github.com/settings/applications)
2. Find RepoRadar in "Authorized OAuth Apps"
3. Click "Revoke" to remove old authorization
4. Try signing in again
5. Authorize when prompted

## Search and Discovery Issues

### No Search Results

**Symptoms:**
- Search returns empty results
- "No repositories found"
- Filters too restrictive

**Solutions:**

**Broaden your search:**
1. Remove some filters
2. Increase star count range
3. Expand date range
4. Try different keywords
5. Check for typos

**Common mistakes:**
- Setting minimum stars too high
- Date range too narrow
- Conflicting filters
- Misspelled language names
- Invalid topic names

**Tips for better results:**
```
Instead of:
- Language: "javascript" (wrong)
- Stars: 10000+ (too restrictive)
- Updated: Last week (too narrow)

Try:
- Language: "JavaScript" (correct case)
- Stars: 100+ (more inclusive)
- Updated: Last 6 months (broader)
```

### Advanced Search Not Working

**Symptoms:**
- Filters not applying
- Results don't match criteria
- Search button disabled

**Solutions:**
1. Ensure at least one filter is set
2. Check for validation errors (red text)
3. Verify date ranges are valid
4. Clear all filters and start over
5. Refresh the page

**Known limitations:**
- Some filter combinations may return no results
- GitHub API has its own limitations
- Very specific queries may timeout

## Performance Issues

### Page Loading Slowly

**Symptoms:**
- Long load times
- Blank screens
- Slow navigation
- Laggy interactions

**Solutions:**

**Browser-side:**
```bash
1. Clear browser cache:
   - Chrome: Ctrl+Shift+Delete
   - Firefox: Ctrl+Shift+Delete
   - Safari: Cmd+Option+E

2. Disable extensions:
   - Try incognito/private mode
   - Disable ad blockers temporarily
   - Disable VPN if active

3. Check internet speed:
   - Run speed test
   - Try different network
   - Restart router
```

**Application-side:**
1. Close unused tabs
2. Restart browser
3. Update browser to latest version
4. Try different browser
5. Check system resources (CPU, RAM)

**For self-hosted:**
```bash
# Check server health
npm run health:check

# Monitor performance
npm run lighthouse

# Check database
npm run db:push

# Restart server
npm run start
```

### Dashboard Not Loading

**Symptoms:**
- Analytics dashboard shows errors
- Charts not rendering
- Data not appearing

**Solutions:**
1. Refresh the page
2. Clear browser cache
3. Check if you have any analyses (dashboard needs data)
4. Try different browser
5. Check browser console for errors (F12)

**For Pro users:**
- Verify subscription is active
- Check payment status
- Contact support if subscription issues

## Export Issues

### PDF Export Failing

**Symptoms:**
- "Export failed" error
- Download doesn't start
- Corrupted PDF file

**Solutions:**
1. Try again (temporary glitch)
2. Check browser download settings
3. Disable download managers
4. Try different browser
5. Check available disk space

**Browser-specific:**
```
Chrome:
- Settings → Downloads
- Check download location
- Disable "Ask where to save"

Firefox:
- Options → General → Downloads
- Set download folder
- Clear download history

Safari:
- Preferences → General
- Set download location
- Check permissions
```

### CSV Export Issues

**Symptoms:**
- CSV won't open in Excel
- Data appears corrupted
- Encoding issues

**Solutions:**

**Opening in Excel:**
```
1. Open Excel
2. File → Import → CSV
3. Select file
4. Choose UTF-8 encoding
5. Set delimiter to comma
6. Import
```

**For Google Sheets:**
```
1. File → Import
2. Upload CSV
3. Select "Comma" as separator
4. Import data
```

**Encoding issues:**
- Open in text editor first
- Save as UTF-8
- Re-import to spreadsheet

## Subscription and Billing Issues

### Payment Failed

**Symptoms:**
- "Payment failed" error
- Subscription not activated
- Card declined

**Solutions:**
1. Verify card details are correct
2. Check card has sufficient funds
3. Ensure card supports international payments
4. Try different payment method
5. Contact your bank
6. Contact support with error details

### Subscription Not Active

**Symptoms:**
- Still seeing free tier limits
- Pro features not available
- "Upgrade to Pro" prompts

**Solutions:**
1. Sign out and sign in again
2. Check subscription status in profile
3. Verify payment was processed
4. Wait 5-10 minutes for activation
5. Contact support with payment confirmation

### Can't Cancel Subscription

**Solutions:**
1. Go to Profile → Subscription
2. Click "Cancel Subscription"
3. Confirm cancellation
4. Check email for confirmation
5. If button doesn't work: Contact support

## Database Issues (Self-Hosted)

### Connection Errors

**Error: "Database connection failed"**

**Solutions:**

```bash
# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test connection
npm run health:check

# Push schema
npm run db:push

# For Neon database:
# 1. Check Neon dashboard
# 2. Verify IP allowlist
# 3. Check connection string
# 4. Verify database exists
```

### Migration Issues

**Error: "Migration failed"**

**Solutions:**

```bash
# Reset and re-push schema
npm run db:push

# Check database logs
# (varies by provider)

# Verify PostgreSQL version
# (should be 12+)

# Check database permissions
# (user needs CREATE, ALTER rights)
```

## API Issues (For Developers)

### API Key Not Working

**Error: "Invalid API key"**

**Solutions:**
1. Verify key is copied correctly (no spaces)
2. Check key hasn't been revoked
3. Ensure Pro/Enterprise subscription is active
4. Generate new key if needed
5. Check API key permissions

### Rate Limit Errors

**Error: "API rate limit exceeded"**

**Solutions:**
1. Check your tier limits
2. Implement exponential backoff
3. Cache responses when possible
4. Upgrade tier for higher limits
5. Contact sales for custom limits

**Example retry logic:**
```javascript
async function analyzeWithRetry(repo, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await analyze(repo);
    } catch (error) {
      if (error.code === 'RATE_LIMIT' && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

## Getting More Help

### Before Contacting Support

Gather this information:
1. **Error message** (exact text or screenshot)
2. **Repository URL** (if applicable)
3. **Browser and version**
4. **Steps to reproduce**
5. **When it started happening**
6. **Your account email**

### Support Channels

**AI Assistant:**
- Click icon in bottom-right corner
- Available 24/7
- Instant responses
- Context-aware help

**Documentation:**
- [FAQ](../faq/index.md)
- [Feature Guides](../features/index.md)
- [API Docs](../API_DOCUMENTATION.md)

**Community:**
- GitHub Issues
- Discord server
- Community forum

**Direct Support:**
- Email: support@reporadar.com
- Response time: 24-48 hours (free), 4-8 hours (Pro), 1-2 hours (Enterprise)

### Self-Hosted Support

**Check logs:**
```bash
# Application logs
npm run dev  # Watch console output

# Health check
npm run health:check

# Configuration
npm run config:validate
npm run config:summary
```

**Common fixes:**
```bash
# Restart server
npm run start

# Clear cache
# (depends on cache provider)

# Update dependencies
npm install

# Rebuild
npm run build
```

## Preventing Issues

### Best Practices

**For Users:**
1. Keep browser updated
2. Clear cache regularly
3. Use supported browsers
4. Stable internet connection
5. Don't exceed rate limits

**For Self-Hosters:**
1. Keep dependencies updated
2. Monitor server health
3. Regular database backups
4. Configure caching properly
5. Set up monitoring alerts
6. Review logs regularly

### Monitoring

**Set up alerts for:**
- Server downtime
- High error rates
- Database issues
- API quota warnings
- Performance degradation

**Tools:**
```bash
# Health checks
npm run health:check

# Performance audit
npm run lighthouse

# Configuration validation
npm run config:validate
```

## Still Having Issues?

If you've tried these solutions and still have problems:

1. **Check status page** for known issues
2. **Search documentation** for specific error
3. **Ask AI Assistant** for immediate help
4. **Contact support** with details
5. **Report bugs** on GitHub

Remember: Most issues have simple solutions. Start with the basics (refresh, clear cache, try again) before diving into complex troubleshooting.
