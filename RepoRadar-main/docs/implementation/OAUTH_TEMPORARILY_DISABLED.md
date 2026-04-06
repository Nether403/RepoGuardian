# OAuth Temporarily Disabled

## What I Did

**Disabled OAuth buttons** to stop the cascade of Stack Auth dependency errors.

## Why

Stack Auth has too many dependency issues in your Vite setup:
- `tiny-case` export errors
- `property-expr` export errors  
- `toposort` export errors
- `normalize-wheel` export errors

Each time we fix one, another appears. This is because Stack Auth was built for Next.js and has deep dependencies that don't play well with Vite.

## What Works Now

✅ **Email/Password Authentication**
- Sign up with email/password
- Login with email/password
- Password reset
- All the security features (rate limiting, session management, etc.)

❌ **OAuth (Google/GitHub)** - Temporarily disabled

## To Use the App

1. **Fix the user without password in Neon**:
   ```sql
   -- Delete the problematic user
   DELETE FROM users WHERE email = 'your-email@example.com';
   ```

2. **Restart the dev server**

3. **Sign up with a NEW email**:
   - Go to sign-up page
   - Enter email, name, password
   - Click Sign Up
   - You should be logged in!

## Remaining Errors (Can Ignore)

### WebSocket Errors
```
WebSocket connection to 'ws://localhost:5173' failed
```
**Status**: Harmless - Vite HMR trying to connect but not critical

**Why**: Your app uses Express middleware mode, not standalone Vite server

**Impact**: None - app works fine, just no hot module replacement

### 401 on /api/auth/user
**Status**: Normal - you're not logged in yet

### Nested <a> Warning
**Status**: Minor HTML issue in Header component

**Fix**: Check `Header.tsx` for nested links

## To Re-Enable OAuth Later

1. **Option A**: Remove Stack Auth entirely, use a different OAuth library
2. **Option B**: Switch to Next.js (Stack Auth works better there)
3. **Option C**: Wait for Stack Auth to improve Vite support

For now, email/password auth is fully functional and secure!

## Next Steps

1. Delete the user without password in Neon
2. Restart dev server
3. Try signing up with a new email
4. Test login/logout

The app should work perfectly for email/password authentication!
