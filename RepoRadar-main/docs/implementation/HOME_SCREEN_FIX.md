# Home Screen Fix - Trending Repositories & Recent Analysis

## Issue
On the home screen:
- "Trending Repositories" was showing user's recent analyses (wrong data)
- "Recent Analysis" was showing "No Recent Analysis" even when user had analyses
- The two sections had swapped/incorrect data sources

## Root Cause
1. **Trending Repositories** was querying `/api/repositories/trending` which returned repositories from the database (recent analyses with high scores), not actual trending GitHub repos
2. **Recent Analysis** was querying `/api/analyses/recent` which returned ALL analyses (not user-specific), and the home page wasn't filtering by user

## Changes Made

### 1. GitHub Service (`server/github.ts`)
Added a new method to fetch actual trending repositories from GitHub:

```typescript
async getTrendingRepositories(limit = 5): Promise<GitHubRepository[]>
```

This method:
- Searches GitHub for repositories created in the last 7 days
- Filters for repos with >100 stars
- Sorts by star count (descending)
- Returns the top 5 trending repos

### 2. Backend Routes (`server/routes.ts`)

#### Updated Trending Endpoint
Changed `/api/repositories/trending` to use GitHub API instead of database:
- Now fetches real trending repos from GitHub
- Formats the response to match the expected structure
- Returns top 5 trending repositories

#### Added User-Specific Recent Analyses Endpoint
Created new endpoint `/api/analyses/user/recent`:
- Protected with `isAuthenticated` middleware
- Returns only the authenticated user's analyses
- Limits to 10 most recent analyses

### 3. Frontend Home Page (`client/src/pages/home.tsx`)

Updated the data queries:
- **Recent Analysis**: Changed from `/api/analyses/recent` to `/api/analyses/user/recent`
- **Trending Repositories**: Already using `/api/repositories/trending` (now returns correct data)

## Result
- **Trending Repositories** now shows actual trending GitHub repos (created in last 7 days with high stars)
- **Recent Analysis** now shows the user's own recent analyses (up to 10)
- Both sections display the correct, relevant data

## Testing
To verify the fix:
1. Log in to the application
2. Navigate to the home page
3. Check "Trending Repositories" - should show popular GitHub repos from the last week
4. Check "Recent Analysis" - should show your recent repository analyses
5. If you haven't analyzed any repos yet, "Recent Analysis" will show the empty state

## Notes
- The trending repos are fetched from GitHub's public API
- The query looks for repos created in the last 7 days with >100 stars
- User's recent analyses are limited to the 10 most recent
- Both sections refresh automatically (trending repos every 5 minutes)
