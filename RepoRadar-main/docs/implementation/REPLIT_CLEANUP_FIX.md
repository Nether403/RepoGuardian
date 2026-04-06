# Replit Code Cleanup & Configuration Fixes

## Issues Fixed

### 1. ✅ Removed Replit Dependencies
**Problem**: Old Replit-specific code was trying to load scripts and causing CSP violations

**Fixed**:
- Removed `@replit/vite-plugin-cartographer` from package.json
- Removed `@replit/vite-plugin-runtime-error-modal` from package.json
- Removed Replit plugin imports from vite.config.ts
- Removed Replit-specific plugin configuration

### 2. ✅ Fixed Content Security Policy (CSP)
**Problem**: CSP was blocking Stripe.js and other necessary scripts

**Fixed** (`server/middleware/httpsEnforcement.ts`):
- Added `https://js.stripe.com` to script-src
- Added `https://api.stripe.com` to connect-src
- Added `https://js.stripe.com` and `https://hooks.stripe.com` to frame-src
- Removed Replit domains from CSP

**Before**:
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://accounts.google.com https://apis.google.com"
```

**After**:
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://accounts.google.com https://apis.google.com https://js.stripe.com"
```

### 3. ✅ Fixed Vite HMR WebSocket Configuration
**Problem**: Vite HMR was trying to connect to wrong ports (3002 and 5173)

**Fixed** (`vite.config.ts`):
```typescript
server: {
  port: 5173,
  strictPort: false,
  hmr: {
    clientPort: 5173,
  },
  // ...
}
```

This ensures:
- Dev server runs on port 5173
- HMR WebSocket connects to the same port
- No more WebSocket connection failures

### 4. ✅ Fixed Stack Auth tiny-case Import Error
**Problem**: `The requested module 'tiny-case' does not provide an export named 'camelCase'`

**Fixed** (`vite.config.ts`):
```typescript
optimizeDeps: {
  exclude: ['@stackframe/stack-sc', '@stackframe/stack'],
  include: ['tiny-case'],  // ← Added this
  // ...
}
```

This forces Vite to pre-bundle tiny-case properly, fixing the export issue.

## Changes Made

### Files Modified:
1. **vite.config.ts**
   - Removed Replit plugins
   - Added HMR configuration
   - Fixed optimizeDeps for tiny-case

2. **package.json**
   - Removed `@replit/vite-plugin-cartographer`
   - Removed `@replit/vite-plugin-runtime-error-modal`

3. **server/middleware/httpsEnforcement.ts**
   - Added Stripe domains to CSP
   - Improved CSP for development mode

## Testing

After these fixes, restart your dev server:

```bash
npm run dev
```

You should see:
- ✅ No Replit script errors
- ✅ No CSP violations for Stripe
- ✅ Vite HMR working properly
- ✅ No tiny-case import errors
- ✅ OAuth buttons working

## What Was Removed

### Replit-Specific Code:
- Replit dev banner script
- Replit cartographer plugin (code mapping)
- Replit runtime error modal
- Replit environment detection (`REPL_ID`)

### Why This Matters:
- **Cleaner codebase**: No unnecessary dependencies
- **Better performance**: Fewer plugins to load
- **Proper CSP**: Security headers work correctly
- **Standard Vite setup**: Works like any other Vite project

## Remaining Issues (If Any)

### 401 Unauthorized on /api/auth/user
This is expected if you're not logged in. The app tries to check auth status on load.

**Not an error** - this is normal behavior for authentication check.

### Browser Extension Errors
The "listener indicated an asynchronous response" error is from a browser extension, not your app.

**Not your code** - ignore this error.

## Summary

✅ **Replit code**: Completely removed  
✅ **CSP**: Fixed to allow Stripe and necessary scripts  
✅ **Vite HMR**: Configured properly for port 5173  
✅ **Stack Auth**: Fixed tiny-case import issue  
✅ **Dependencies**: Cleaned up and reinstalled  

Your app is now free of Replit-specific code and should work as a standard Vite/React application!
