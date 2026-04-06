# Authentication Flow - How to Test Profile Updates

## The Issue
Getting 401 errors when trying to access the profile page in an incognito window.

## Root Cause
**You're not logged in!** The profile page requires authentication, and incognito windows don't have any saved sessions.

## Solution: Log In First

### Step 1: Navigate to the Sign-In Page
In your incognito window, go to:
```
http://localhost:3002/handler/sign-in
```

### Step 2: Log In with Your Credentials
Use your existing account:
- **Email**: `martin@realm101.com`
- **Password**: Your password

### Step 3: After Login, Navigate to Profile
Once logged in, go to:
```
http://localhost:3002/profile
```

Now you should be able to:
- ✅ View your profile
- ✅ Edit your name, bio, and profile picture
- ✅ Save changes successfully
- ✅ Change your password

## Why This Happens

The authentication flow works like this:

1. **User visits site** → No session exists
2. **User logs in** → Session created with user data
3. **User accesses protected pages** → Session validated
4. **User makes API calls** → Session checked by `isAuthenticated` middleware

When you open an incognito window:
- No cookies/session exists
- All authenticated endpoints return 401
- You must log in to create a session

## Testing Checklist

### Before Testing Profile Updates:
- [ ] Open incognito window
- [ ] Navigate to `/handler/sign-in`
- [ ] Log in with valid credentials
- [ ] Verify you see your dashboard/home page
- [ ] Navigate to `/profile`
- [ ] Now test profile updates

### Expected Behavior After Login:
- ✅ `/api/auth/user` returns your user data (200)
- ✅ `/api/notifications` works (200)
- ✅ `/api/analyses/user/recent` works (200)
- ✅ `/api/user/profile` accepts updates (200)

## Alternative: Use Regular Browser Window

If you have an active session in a regular browser window:
1. Open regular Chrome/Firefox (not incognito)
2. You should already be logged in
3. Navigate to `/profile`
4. Test profile updates

## Demo User (No Password)

There's also a demo user in the database:
- **Email**: `demo@example.com`
- **Has Password**: No (OAuth only)

This user can't log in with password - they would need OAuth (Google/GitHub).

## Quick Test Script

```bash
# Test login endpoint
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"martin@realm101.com","password":"YOUR_PASSWORD"}' \
  -c cookies.txt

# Test authenticated endpoint
curl http://localhost:3002/api/auth/user \
  -b cookies.txt

# Test profile update
curl -X PUT http://localhost:3002/api/user/profile \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Martin","lastName":"Updated"}' \
  -b cookies.txt
```

## Summary

The profile update feature is working correctly! The 401 errors you're seeing are expected behavior when not logged in. Simply:

1. **Log in first** at `/handler/sign-in`
2. **Then access** `/profile`
3. **Test updates** - they should work perfectly

The authentication system is protecting your endpoints as designed! 🔒
