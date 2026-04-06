# GitHub Token Persistence Fix

## Issue
GitHub token (and other profile fields) were not persisting after saving in the profile settings. When navigating away and returning to the profile page, the GitHub token field would be empty.

## Root Cause
The auth context's `checkAuth()` function was expecting a different response format from the `/api/auth/user` endpoint.

### Expected Format (Incorrect)
```typescript
{
  authenticated: true,
  user: {
    id: "...",
    email: "...",
    githubToken: "...",
    // ... other fields
  }
}
```

### Actual Format (From API)
```typescript
{
  id: "...",
  email: "...",
  githubToken: "...",
  // ... other fields (user object directly)
}
```

## The Problem

In `client/src/contexts/neon-auth-context.tsx`, the `checkAuth` function was checking:

```typescript
if (userData.authenticated && userData.user) {
  setUser(userData.user);
}
```

Since the API returns the user object directly (not wrapped), this condition was never true, so the user state was never updated after profile changes.

## Solution

Updated the `checkAuth` function to correctly handle the API response:

```typescript
if (userData && userData.id) {
  setUser(userData);
}
```

Now it checks if the response has a user `id` (which indicates a valid user object) and sets the user state directly.

## Files Changed

### `client/src/contexts/neon-auth-context.tsx`
- Fixed the `checkAuth()` function to properly parse the user data from the API response
- Changed from checking `userData.authenticated && userData.user` to `userData && userData.id`
- Changed from `setUser(userData.user)` to `setUser(userData)`

## Impact

This fix resolves:
1. ✅ GitHub token not persisting after save
2. ✅ Profile changes (firstName, lastName, bio) not reflecting immediately
3. ✅ Profile image URL not persisting
4. ✅ Any other user profile fields not updating correctly

## Testing

To verify the fix:

1. **Save GitHub Token**:
   - Go to Profile page
   - Enter a GitHub Personal Access Token
   - Click "Save Changes"
   - Navigate to another page (e.g., Home)
   - Return to Profile page
   - ✅ Token should still be visible

2. **Update Other Profile Fields**:
   - Change first name, last name, or bio
   - Save changes
   - Navigate away and back
   - ✅ Changes should persist

3. **Code Review Page**:
   - After adding GitHub token
   - Go to Code Review page
   - ✅ Should see green "GitHub token added" alert

## Related Components

The fix affects:
- Profile page (`client/src/pages/profile.tsx`)
- Code Review page (`client/src/pages/code-review.tsx`)
- Any component using `useAuth()` hook
- User authentication state management

## API Endpoints Involved

- `GET /api/auth/user` - Returns user object directly
- `PUT /api/user/profile` - Updates user profile including GitHub token

Both endpoints work correctly; the issue was only in the client-side parsing.

## Future Considerations

To prevent similar issues:
1. Consider standardizing API response formats across all endpoints
2. Add TypeScript interfaces for API responses
3. Add integration tests for auth flow
4. Document expected response formats in API documentation
