# Port 3002 Configuration - Explained

## Your Setup (Replit-Style Architecture)

Your app uses a **single-port architecture** where Express serves everything:

```
Port 5000: Express HTTP Server
  ├─ Backend API (/api/*)
  ├─ Vite Dev Middleware (in development)
  └─ Static Files (in production)

Browser connects to: localhost:3002
```

Wait, why 3002 if Express is on 5000? Let me check...

## The Mystery of Port 3002

Actually, looking at your server code, Express should be on port 5000 (from `server/index.ts`). 

**Port 3002 might be**:
- A proxy/reverse proxy
- Configured in your `.env` file
- Set by Kiro's environment

## What I Fixed

### 1. Removed Conflicting Vite Server Config
**Before**: Vite config tried to run standalone server on 5173
**After**: Vite runs in middleware mode through Express

### 2. Fixed HMR Configuration
**Issue**: Browser tried to connect WebSocket to port 5173
**Fix**: Removed port-specific HMR config, let it use the HTTP server

### 3. Added toposort to optimizeDeps
**Issue**: Stack Auth dependency `toposort` wasn't being pre-bundled
**Fix**: Added to include list

## Auth Errors Explained

### 401 Unauthorized on /api/auth/user
✅ **Normal** - You're not logged in yet

### 401 on /api/auth/login
❌ **Problem** - Login is failing

### 409 Conflict on /api/auth/signup
⚠️ **Info** - User already exists (you tried to sign up twice)

## Next Steps

1. **Restart the dev server**:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Clear browser cache** (important!)

3. **Try to sign up with a NEW email** (not one you used before)

4. **Check the terminal** for any server errors

## The Real Issues to Investigate

1. **Why is the app on port 3002?**
   - Check your `.env` file for `PORT=3002`
   - Or Kiro might be proxying 5000 → 3002

2. **Why is login failing (401)?**
   - Could be database connection issue
   - Could be password hashing issue
   - Check server logs when you try to login

3. **Port 5173 mystery**
   - Probably a cached browser setting
   - Should go away after restart + cache clear

## What to Check

Run these to diagnose:

```bash
# Check what's in your .env
type .env | findstr PORT

# Check what ports are actually in use
netstat -ano | findstr "3002 5000 5173"
```

Let me know what you find!
