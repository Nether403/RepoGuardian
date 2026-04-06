# Code Review - Debugging Guide

## Error: "Review failed - Unable to complete code review"

This generic error message means something went wrong during the analysis. Here's how to debug it:

### Step 1: Check Browser Console

Open your browser's Developer Tools (F12) and look for errors:

```javascript
// Look for messages like:
[Code Review] Error: Failed to fetch repository: ...
[Code Review] Error: AI analysis failed: ...
```

### Step 2: Check Server Logs

Look at your server console for detailed logs:

```
[Code Review] Analyze request: { type: 'repository', content: 'https://...', hasToken: true }
[Code Review] Analyzing repository: { owner: 'user', repo: 'repo' }
[Code Review] Error fetching repository: ...
```

### Common Errors and Solutions

#### 1. "AI service is not configured"
**Cause:** Missing `GEMINI_API_KEY` environment variable

**Solution:**
```bash
# Add to your .env file:
GEMINI_API_KEY=your_api_key_here
```

Get a key from: https://makersuite.google.com/app/apikey

#### 2. "Failed to fetch repository"
**Causes:**
- Invalid repository URL
- Repository doesn't exist
- Repository is private (without token)
- GitHub API rate limit

**Solutions:**
- Verify the URL is correct
- Check if repository exists on GitHub
- Add a GitHub token for private repos
- Wait if rate limited (60 requests/hour without token)

#### 3. "Could not determine repository languages"
**Cause:** Repository has no code files or is empty

**Solution:**
- Try a different repository with actual code
- Check if the repository has any source files

#### 4. "Could not fetch any code files"
**Causes:**
- Repository has unusual file structure
- Files are in non-standard locations
- GitHub API access issues

**Solutions:**
- Add a GitHub token for better access
- Try a different repository
- Check GitHub API status

#### 5. "AI analysis failed"
**Causes:**
- Gemini API key invalid
- Gemini API rate limit
- Network issues
- AI service down

**Solutions:**
- Verify your Gemini API key is valid
- Check Gemini API status
- Wait and retry
- Check network connection

### Step 3: Test Individual Components

#### Test GitHub API Access
```bash
node test-github-api.js
```

Should show:
```
✅ SUCCESS: GitHub API is working!
```

#### Test with a Known-Good Repository
Try these repositories that should work:
```
https://github.com/expressjs/express
https://github.com/facebook/react
https://github.com/microsoft/vscode
```

#### Test with GitHub Token
1. Get a token from https://github.com/settings/tokens
2. Add it to the GitHub Token field
3. Try again

### Step 4: Check Environment Variables

Make sure these are set in your `.env` file:

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key

# Optional but recommended
GITHUB_TOKEN=your_github_token
```

### Step 5: Enable Detailed Logging

The server already logs detailed information. Watch for:

```
[Code Review] Analyze request: ...
[Code Review] Analyzing repository: ...
[Code Review] Repository languages: ...
[Code Review] Main language: ...
[Code Review] Fetched file: ... length: ...
[Code Review] AI response received, length: ...
[Code Review] Analysis complete: ...
```

If you see an error at any step, that's where the problem is.

### Step 6: Common Fixes

#### Clear and Restart
```bash
# Stop the server (Ctrl+C)
# Clear any caches
# Restart
npm run dev
```

#### Check API Keys
```bash
# Test Gemini API key
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY"
```

#### Check GitHub API
```bash
# Test GitHub API
curl -H "User-Agent: RepoRadar" \
  https://api.github.com/repos/expressjs/express
```

### Error Messages Reference

| Error Message | Likely Cause | Solution |
|--------------|--------------|----------|
| "Content is required" | Empty request | Check frontend is sending data |
| "Invalid repository URL" | Bad URL format | Use format: `https://github.com/owner/repo` |
| "Repository not found" | Repo doesn't exist | Verify URL on GitHub |
| "Could not determine repository languages" | Empty repo | Try a repo with code |
| "Could not fetch any code files" | Access issues | Add GitHub token |
| "AI service is not configured" | Missing API key | Set GEMINI_API_KEY |
| "AI analysis failed" | Gemini API issue | Check API key and status |

### Still Not Working?

1. **Check the full error message** in browser console
2. **Check server logs** for the complete error stack
3. **Try a different repository** to isolate the issue
4. **Verify all environment variables** are set correctly
5. **Check API service status**:
   - GitHub: https://www.githubstatus.com/
   - Google AI: https://status.cloud.google.com/

### Example Successful Flow

```
[Code Review] Analyze request: { type: 'repository', content: 'https://github.com/expressjs/express', hasToken: true }
[Code Review] Analyzing repository: { owner: 'expressjs', repo: 'express' }
[Code Review] Repository languages: { JavaScript: 234567, ... }
[Code Review] Main language: JavaScript
[Code Review] Fetched file: index.js length: 2341
[Code Review] Fetched file: lib/express.js length: 5432
[Code Review] AI response received, length: 3456
[Code Review] Analysis complete: { overallScore: 88, issuesCount: 5 }
```

If your logs look different, that's where the problem is!
