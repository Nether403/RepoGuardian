# Code Review Feature Enhancements

## Overview
Enhanced the AI Code Review feature with two powerful new capabilities:
1. **View Code** - Fetch and display the actual file content from GitHub
2. **Create Fix** - Generate AI-powered fixes and automatically create pull requests

## What's New

### 1. View Code Button
- Fetches the actual file content from GitHub
- Displays code in a modal dialog with syntax highlighting
- Highlights the problematic line
- Provides a direct link to view the file on GitHub
- Shows line numbers for easy navigation

### 2. Create Fix Button
- Uses AI (Google Gemini 2.5 Pro) to generate code fixes
- Automatically creates a new branch in the repository
- Commits the fixed code to the new branch
- Creates a pull request with detailed description
- Includes issue details and suggestions in the PR body
- Provides a direct link to the created PR

## How to Use

### Prerequisites
For creating pull requests, you'll need:
- A GitHub Personal Access Token with `repo` scope
- Get one from: https://github.com/settings/tokens

### Steps

1. **Analyze a Repository**
   - Enter a GitHub repository URL
   - Optionally provide your GitHub token (required for creating PRs)
   - Click "Start AI Review"

2. **View Code Issues**
   - Browse through the detected issues in the "Issues" tab
   - Each issue shows:
     - Severity level (critical, high, medium, low)
     - File path and line number
     - Issue description and suggestion

3. **View Code**
   - Click "View Code" on any issue
   - A dialog opens showing the file content
   - The problematic line is highlighted
   - Click "View on GitHub" to see it in the repository

4. **Create Fix**
   - Click "Create Fix" on any issue (requires GitHub token)
   - AI generates a fix for the issue
   - A new branch is created automatically
   - A pull request is created with the fix
   - Click the link in the toast notification to view the PR

## Technical Implementation

### Backend Changes

#### New GitHub Service Methods (`server/github.ts`)
- `getFileContent()` - Fetches raw file content from GitHub
- `createBranch()` - Creates a new branch from a base branch
- `updateFile()` - Updates or creates a file in a branch
- `createPullRequest()` - Creates a pull request

#### New API Endpoints (`server/routes.ts`)
- `POST /api/code-review/view-code` - Fetches file content
  - Parameters: `repoUrl`, `filePath`, `line`
  - Returns: file content, file URL, line number

- `POST /api/code-review/create-fix` - Creates a fix and PR
  - Parameters: `repoUrl`, `filePath`, `line`, `issue`, `suggestion`, `githubToken`
  - Returns: PR number, PR URL, branch name

### Frontend Changes (`client/src/pages/code-review.tsx`)

#### New UI Components
- GitHub token input field with instructions
- Code viewer dialog with syntax highlighting
- Loading states for async operations
- Toast notifications for success/error feedback

#### New Mutations
- `viewCodeMutation` - Fetches and displays code
- `createFixMutation` - Creates fix and PR

## Security Considerations

- GitHub tokens are never stored on the server
- Tokens are only used for the specific API call
- All GitHub API calls use HTTPS
- Error messages don't expose sensitive information
- Rate limiting applies to all endpoints

## Error Handling

The feature handles various error scenarios:
- Invalid repository URLs
- File not found
- GitHub API rate limits
- Missing GitHub token
- Network errors
- AI service unavailable

## Future Enhancements

Potential improvements:
- Support for private repositories
- Batch fix creation for multiple issues
- Custom fix templates
- Integration with GitHub Apps for better auth
- Support for other Git platforms (GitLab, Bitbucket)
- Code diff preview before creating PR
- Automated testing of fixes

## Example Workflow

```
1. User analyzes: https://github.com/user/repo
2. AI finds: "SQL injection vulnerability in src/api/database.js:42"
3. User clicks "View Code" → sees the vulnerable code
4. User clicks "Create Fix" → AI generates secure code
5. System creates branch: fix/code-review-1234567890
6. System commits fix with message: "Fix: SQL injection vulnerability..."
7. System creates PR: "🤖 AI Code Review Fix: SQL injection vulnerability..."
8. User reviews PR on GitHub and merges if satisfied
```

## Troubleshooting

### "Failed to load code" Error

If you get this error when clicking "View Code":
1. **Check the file path** - Make sure the file exists in the repository
2. **Provide a GitHub token** - Some repositories may require authentication
3. **Check rate limits** - GitHub API has rate limits (60 requests/hour without token, 5000 with token)
4. **Verify repository access** - Ensure the repository is public or you have access

### "Failed to create pull request" Error

Common causes:
1. **Missing GitHub token** - Token is required for creating PRs
2. **Insufficient permissions** - Token needs `repo` scope
3. **Branch already exists** - The auto-generated branch name may conflict
4. **Repository permissions** - You need write access to create PRs

### GitHub Token Setup

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "RepoRadar Code Review")
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click "Generate token"
6. Copy the token immediately (you won't see it again!)
7. Paste it into the GitHub Token field in RepoRadar

## Notes

- The AI-generated fixes should always be reviewed before merging
- The feature works best with public repositories
- GitHub token permissions should be limited to only what's needed
- The default base branch is assumed to be `main` (can be customized)
- GitHub API requires a User-Agent header (automatically added)
- Rate limits: 60 requests/hour without token, 5000 with token
