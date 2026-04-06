# Code Review Feature - Troubleshooting Guide

## Common Issues and Solutions

### Issue: "Failed to load code" Error

#### Cause 1: Using Demo/Mock Data
**Symptom:** You clicked "Start AI Review" without entering a real repository URL, or the review shows demo data.

**Solution:**
1. Enter a **real GitHub repository URL** (e.g., `https://github.com/torvalds/linux`)
2. Click "Start AI Review" again
3. Wait for the actual analysis to complete
4. Then try "View Code" or "Create Fix"

**How to tell if it's demo data:**
- The overall score is exactly 78
- Issues mention files like `src/api/database.js` that don't exist in your repo
- The analysis completed instantly (< 1 second)

#### Cause 2: GitHub API Authentication
**Symptom:** Error message mentions authentication or rate limits.

**Solution:**
1. Get a GitHub Personal Access Token:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scope: `repo` (Full control of private repositories)
   - Copy the token

2. Paste the token in the "GitHub Token" field
3. Try again

#### Cause 3: File Doesn't Exist
**Symptom:** 404 error or "File not found"

**Solution:**
- Verify the file path is correct
- Check if the file exists in the repository's main branch
- Some repositories use `master` instead of `main` as default branch

#### Cause 4: Rate Limiting
**Symptom:** Error mentions "rate limit exceeded"

**Solution:**
- Without token: 60 requests/hour limit
- With token: 5,000 requests/hour limit
- Wait an hour or add a GitHub token

### Issue: "Failed to create pull request" Error

#### Cause 1: Missing GitHub Token
**Solution:** You MUST provide a GitHub token to create pull requests.

#### Cause 2: Insufficient Permissions
**Solution:** 
- Token needs `repo` scope
- You need write access to the repository
- For organization repos, check if you're a member

#### Cause 3: Using Demo Data
**Solution:** Analyze a real repository first (see above)

## Testing the Feature

### Step-by-Step Test

1. **Test with a Public Repository**
   ```
   Repository URL: https://github.com/torvalds/linux
   ```

2. **Optional: Add GitHub Token**
   - Increases rate limits
   - Required for creating PRs
   - Get from: https://github.com/settings/tokens

3. **Start Review**
   - Click "Start AI Review"
   - Wait for analysis (may take 10-30 seconds)
   - Check that issues are specific to the actual repository

4. **Test View Code**
   - Click "View Code" on any issue
   - Should open a dialog showing the actual file
   - Line should be highlighted

5. **Test Create Fix** (requires token)
   - Click "Create Fix" on any issue
   - Should create a new branch
   - Should create a pull request
   - Check GitHub for the PR

### Quick API Test

Run this command to test GitHub API access:

```bash
node test-github-api.js
```

Or test manually with curl:

```bash
# Without token
curl -H "User-Agent: RepoRadar" \
     -H "Accept: application/vnd.github.v3.raw" \
     https://api.github.com/repos/torvalds/linux/contents/README

# With token
curl -H "User-Agent: RepoRadar" \
     -H "Accept: application/vnd.github.v3.raw" \
     -H "Authorization: token YOUR_TOKEN_HERE" \
     https://api.github.com/repos/torvalds/linux/contents/README
```

## Server Logs

Check the server console for detailed logs:

```
[Code Review] View code request: { repoUrl, filePath, line, hasToken }
[GitHub API] Fetching file: { url, hasToken }
[GitHub API] Response status: 200
[GitHub API] File fetched successfully, length: 12345
```

If you see errors, they'll show:
```
[GitHub API] Error response: { status, statusText, body }
```

## GitHub Token Setup

### Classic Token (Recommended)

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: "RepoRadar Code Review"
4. Expiration: Choose based on your needs
5. Scopes:
   - ✅ `repo` - Full control of private repositories
6. Click "Generate token"
7. **Copy immediately** (you won't see it again!)

### Fine-Grained Token (Alternative)

1. Go to https://github.com/settings/tokens?type=beta
2. Click "Generate new token"
3. Name: "RepoRadar Code Review"
4. Repository access: Choose repositories
5. Permissions:
   - Contents: Read and write
   - Pull requests: Read and write
6. Generate and copy

## API Endpoints

The feature uses these endpoints:

- `POST /api/code-review/view-code`
  - Body: `{ repoUrl, filePath, line, githubToken }`
  - Returns: `{ content, filePath, line, fileUrl }`

- `POST /api/code-review/create-fix`
  - Body: `{ repoUrl, filePath, line, issue, suggestion, githubToken }`
  - Returns: `{ success, pullRequest: { number, url }, branch }`

## GitHub API Details

### Authentication Format
- ✅ Correct: `Authorization: token ghp_xxxxxxxxxxxx`
- ❌ Wrong: `Authorization: Bearer ghp_xxxxxxxxxxxx`

### Required Headers
- `User-Agent: RepoRadar` (required by GitHub)
- `Accept: application/vnd.github.v3.raw` (for raw file content)
- `Authorization: token YOUR_TOKEN` (optional, but recommended)

### Rate Limits
- Unauthenticated: 60 requests/hour per IP
- Authenticated: 5,000 requests/hour per token
- Check remaining: `x-ratelimit-remaining` header

## Still Having Issues?

1. **Check server logs** - Look for `[Code Review]` and `[GitHub API]` messages
2. **Test GitHub API directly** - Use the test script or curl
3. **Verify repository URL** - Make sure it's a valid public GitHub repo
4. **Check token permissions** - Ensure `repo` scope is enabled
5. **Try a different repository** - Some repos may have special restrictions

## Known Limitations

- Only works with GitHub repositories (not GitLab, Bitbucket, etc.)
- Assumes `main` as default branch (not `master`)
- Cannot access private repositories without a token
- Cannot create PRs without write access
- AI-generated fixes should always be reviewed before merging
