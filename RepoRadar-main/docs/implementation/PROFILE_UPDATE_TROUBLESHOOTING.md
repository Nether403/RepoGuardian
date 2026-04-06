# Profile Update Troubleshooting Guide

## Issue
Getting "401 Unauthorized" error when trying to save profile changes.

## Root Cause
The new `/api/user/profile` endpoint was added but the server needs to be restarted to register the new routes.

## Solution Steps

### 1. Restart the Development Server
```bash
# Stop the current server (Ctrl+C)
# Then restart it
npm run dev
```

### 2. Verify the Endpoint is Registered
After restart, check the server logs for:
```
[Profile Update] Request received
```

### 3. Check Authentication
The endpoint requires authentication. Make sure you're logged in:
- Check if you can access `/api/auth/user` successfully
- Verify your session is active

### 4. Test the Endpoint
Try updating your profile again. The server logs should show:
```
[Profile Update] Request received
[Profile Update] User: { claims: { sub: '...' }, ... }
[Profile Update] Updating profile for user: ...
[Profile Update] Profile updated successfully
```

## Common Issues

### Issue: "Not authenticated" error
**Cause**: Session expired or not logged in
**Solution**: Log out and log back in

### Issue: Endpoint not found (404)
**Cause**: Server not restarted after code changes
**Solution**: Restart the development server

### Issue: CORS errors
**Cause**: Credentials not being sent
**Solution**: Already handled - `credentials: "include"` is set in the client

## Verification

After restarting, you should be able to:
1. ✅ Edit your profile (name, bio, profile picture)
2. ✅ Save changes successfully
3. ✅ See updated information immediately
4. ✅ Change your password (if you have password auth set up)

## Debug Commands

### Check if endpoint exists:
```bash
curl -X PUT http://localhost:5000/api/user/profile \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test"}' \
  --cookie-jar cookies.txt \
  --cookie cookies.txt
```

### Check authentication:
```bash
curl http://localhost:5000/api/auth/user \
  --cookie-jar cookies.txt \
  --cookie cookies.txt
```

## Additional Notes

- The endpoint is protected by `isAuthenticated` middleware
- It requires a valid session with user claims
- The bio field was added to the database successfully
- All TypeScript errors are pre-existing and don't affect functionality
