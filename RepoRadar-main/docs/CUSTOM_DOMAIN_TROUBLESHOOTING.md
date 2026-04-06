# Custom Domain Troubleshooting Guide

## Issue: Blank Screen on Custom Domain

### Symptoms
- Default Render URL works fine: `https://your-app.onrender.com` ✅
- Custom domain shows blank screen: `https://your-custom-domain.com` ❌
- SSL certificate is valid
- DNS records are configured correctly
- Render says everything is working

### Root Cause
The application's CORS configuration only allows requests from the origin specified in the `APP_URL` environment variable. When you access the app via a custom domain, the browser blocks API requests due to CORS policy violations.

## Solutions

### Solution 1: Update APP_URL (Quick Fix)

**Best if:** You only want to use your custom domain.

1. Go to your Render service dashboard
2. Navigate to **Environment** tab
3. Update `APP_URL` environment variable:
   ```bash
   APP_URL=https://your-custom-domain.com
   ```
4. Save changes (Render will automatically redeploy)
5. Wait 2-3 minutes for deployment to complete
6. Clear browser cache and try again

**Important:** After this change, only your custom domain will work. The default Render URL will show a blank screen (CORS blocked).

### Solution 2: Allow Multiple Origins (Recommended)

**Best if:** You want both the Render URL and custom domain to work.

1. Go to your Render service dashboard
2. Navigate to **Environment** tab
3. Set your primary domain in `APP_URL`:
   ```bash
   APP_URL=https://your-custom-domain.com
   ```
4. Add a new environment variable `CORS_ALLOWED_ORIGINS` with both URLs:
   ```bash
   CORS_ALLOWED_ORIGINS=https://your-custom-domain.com,https://your-app.onrender.com
   ```
5. Save changes (Render will automatically redeploy)
6. Wait 2-3 minutes for deployment to complete
7. Clear browser cache and try again

**Benefits:**
- Both URLs work
- Useful for testing and migration
- Can add more domains if needed

## Post-Update Steps

### 1. Clear Service Worker Cache

The service worker may have cached the old origin. Clear it by:

**In Chrome/Edge:**
1. Press `F12` to open DevTools
2. Go to **Application** tab
3. Click **Service Workers** in left sidebar
4. Click **Unregister** next to your service worker
5. Go to **Storage** in left sidebar
6. Click **Clear site data**
7. Refresh the page

**In Firefox:**
1. Press `F12` to open DevTools
2. Go to **Storage** tab
3. Right-click on **Service Workers**
4. Click **Unregister**
5. Clear browser cache
6. Refresh the page

### 2. Hard Refresh

After clearing the service worker:
- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

### 3. Verify in DevTools

1. Open DevTools (`F12`)
2. Go to **Console** tab
3. Look for CORS errors (should be gone now)
4. Go to **Network** tab
5. Refresh and check that API calls succeed (status 200)

## Verification

### Check CORS Configuration

Look at your Render deployment logs to verify CORS is configured correctly:

```
✅ CORS: Production mode with configured origins
   origins: [
     "https://your-custom-domain.com",
     "https://your-app.onrender.com"
   ]
```

### Test Both URLs

1. Test custom domain: `https://your-custom-domain.com`
   - Should load completely
   - Console should be error-free
   - Features should work

2. Test Render URL: `https://your-app.onrender.com`
   - Should load completely (if using Solution 2)
   - Console should be error-free
   - Features should work

## Common Mistakes

### ❌ Wrong Format for CORS_ALLOWED_ORIGINS
```bash
# Wrong: with spaces
CORS_ALLOWED_ORIGINS=https://domain1.com, https://domain2.com

# Wrong: with quotes
CORS_ALLOWED_ORIGINS="https://domain1.com,https://domain2.com"

# Correct: no spaces, no quotes
CORS_ALLOWED_ORIGINS=https://domain1.com,https://domain2.com
```

### ❌ Missing HTTPS Protocol
```bash
# Wrong
CORS_ALLOWED_ORIGINS=domain1.com,domain2.com

# Correct
CORS_ALLOWED_ORIGINS=https://domain1.com,https://domain2.com
```

### ❌ Trailing Slashes
```bash
# Wrong
APP_URL=https://domain.com/

# Correct
APP_URL=https://domain.com
```

## Additional Considerations

### Email Links and Redirects

If you're using email services (password reset, etc.), update:
```bash
# In your Render environment
APP_URL=https://your-custom-domain.com
PASSWORD_RESET_URL=https://your-custom-domain.com/reset-password
```

### Stripe Checkout

If you're using Stripe, the `APP_URL` is used for success/cancel redirects:
```bash
APP_URL=https://your-custom-domain.com
```

Stripe will redirect to:
- Success: `https://your-custom-domain.com/subscription/success`
- Cancel: `https://your-custom-domain.com/subscription`

### OAuth Callbacks

If you're using OAuth (Google, GitHub, etc.), update callback URLs in your OAuth provider's settings:
- Old: `https://your-app.onrender.com/api/auth/callback/google`
- New: `https://your-custom-domain.com/api/auth/callback/google`

## Still Not Working?

### Check DNS Propagation
```bash
# Windows
nslookup your-custom-domain.com

# Mac/Linux
dig your-custom-domain.com
```

Should point to Render's servers.

### Check SSL Certificate
1. Visit your custom domain in browser
2. Click the padlock icon in address bar
3. Verify certificate is valid and issued to your domain

### Check Render Status
- Deployment should show "Live" status
- No error messages in deployment logs
- Service should be running (not sleeping)

### Check Browser Console
Look for specific error messages:
- CORS errors → CORS configuration issue
- 404 errors → Routing issue
- 500 errors → Server issue
- SSL errors → Certificate issue

## Need Help?

If you're still experiencing issues:
1. Check Render deployment logs for errors
2. Check browser console for specific errors
3. Verify all environment variables are set correctly
4. Try accessing the API directly: `https://your-domain.com/api/health`
5. Contact Render support if DNS/SSL issues persist

## Related Documentation
- [Environment Configuration](ENVIRONMENT_CONFIGURATION.md)
- [Render Deployment Guide](RENDER_DEPLOYMENT_GUIDE.md)
- [Render Environment Template](RENDER_ENV_TEMPLATE.md)

