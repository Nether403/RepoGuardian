# Profile Persistence Debugging Guide

## Issue
Profile changes (including GitHub token) are not persisting after save.

## Debugging Steps

### 1. Check Browser Console Logs

After adding the logging, open your browser's Developer Tools (F12) and check the Console tab when:

1. **Loading the profile page**:
   - Look for: `[Profile] User data received:`
   - Look for: `[Profile] GitHub token from user:`
   - This shows what data is being loaded

2. **Saving profile changes**:
   - Look for: `[Profile] Sending update:`
   - Look for: `[Profile] Update response:`
   - Look for: `[Profile] Update successful, refetching user...`
   - Look for: `[Auth] Received user data:`

3. **After navigating away and back**:
   - Look for: `[Auth] Received user data:`
   - Check if the GitHub token is in the user object

### 2. Check Network Tab

In Developer Tools, go to the Network tab:

1. **When saving profile**:
   - Find the `PUT /api/user/profile` request
   - Check the Request Payload - does it include `githubToken`?
   - Check the Response - does it return the updated user with `githubToken`?

2. **When loading profile**:
   - Find the `GET /api/auth/user` request
   - Check the Response - does it include `githubToken`?

### 3. Check Database

If you have access to the database, check if the data is actually being saved:

```sql
SELECT id, email, "firstName", "lastName", bio, "githubToken", "updatedAt" 
FROM users 
WHERE email = 'your-email@example.com';
```

## Common Issues and Solutions

### Issue 1: Data Not Sent to Server
**Symptom**: Request payload doesn't include githubToken
**Solution**: Check that the form field is bound correctly and handleProfileUpdate is sending the data

### Issue 2: Server Not Saving Data
**Symptom**: Request succeeds but database doesn't update
**Solution**: Check server logs for errors in the updateUserProfile function

### Issue 3: Data Saved But Not Returned
**Symptom**: Database has the data but API doesn't return it
**Solution**: Check that the GET /api/auth/user endpoint returns all user fields

### Issue 4: Data Returned But Not Displayed
**Symptom**: API returns data but form fields are empty
**Solution**: Check the useEffect that populates form fields from user data

### Issue 5: Auth Context Not Updating
**Symptom**: User object in auth context doesn't update after save
**Solution**: Check that refetchUser() is being called and checkAuth() is working

## Expected Flow

1. User fills in GitHub token field
2. User clicks "Save Changes"
3. `handleProfileUpdate()` is called
4. `updateProfileMutation.mutate()` sends data to server
5. Server updates database via `storage.updateUserProfile()`
6. Server returns updated user object
7. `onSuccess` callback calls `refetchUser()`
8. `checkAuth()` fetches fresh user data from `/api/auth/user`
9. Auth context updates user state
10. useEffect in profile page updates form fields
11. GitHub token appears in form field

## Temporary Workaround

If the issue persists, you can manually check the database and verify the token is saved. Then, the token should still work for API calls even if it doesn't display in the UI.

## Files to Check

1. `client/src/pages/profile.tsx` - Profile page component
2. `client/src/contexts/neon-auth-context.tsx` - Auth context
3. `server/routes.ts` - API endpoints (lines 291-330)
4. `server/storage.ts` - Database operations (lines 259-275)
5. `shared/schema.ts` - Database schema

## Next Steps

1. Open browser console
2. Try saving a profile change
3. Check the console logs
4. Share the logs to identify where the flow is breaking
