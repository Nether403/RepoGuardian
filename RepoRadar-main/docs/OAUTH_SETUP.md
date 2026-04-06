# OAuth Setup Guide

This guide walks you through setting up Google and GitHub OAuth authentication using Stack Auth (Neon Auth).

## Overview

RepoRadar uses Stack Auth, which is integrated with Neon's authentication system, to provide OAuth authentication. This allows users to sign in with their Google or GitHub accounts.

## Prerequisites

- A Neon account with a project
- Access to Neon Console

## Step 1: Enable Neon Auth

1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. Navigate to the **Auth** tab in the left sidebar
4. Click **Enable Auth** if not already enabled

## Step 2: Get Your Stack Auth Credentials

Once Neon Auth is enabled, you'll see your Stack Auth credentials:

1. Go to the **Configuration** tab in the Auth section
2. Copy the following values:
   - **Project ID** (starts with `c74a78dc-...`)
   - **Publishable Client Key** (starts with `pck_...`)
   - **Secret Server Key** (starts with `ssk_...`)

## Step 3: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Stack Auth Configuration
NEXT_PUBLIC_STACK_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=your_client_key_here
STACK_SECRET_SERVER_KEY=your_secret_key_here
```

**Important**: 
- The `NEXT_PUBLIC_*` variables are exposed to the client
- The `STACK_SECRET_SERVER_KEY` must be kept secret and never exposed to the client

## Step 4: Configure OAuth Providers

### Google OAuth

1. In Neon Console → Auth → Configuration
2. Find the **OAuth Providers** section
3. Click **Configure** next to Google
4. Follow the instructions to:
   - Create a Google Cloud project (if you don't have one)
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs
5. Copy your Google Client ID and Client Secret
6. Paste them into the Neon Auth configuration

### GitHub OAuth

1. In Neon Console → Auth → Configuration
2. Find the **OAuth Providers** section
3. Click **Configure** next to GitHub
4. Follow the instructions to:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Click **New OAuth App**
   - Fill in the application details
   - Add the callback URL provided by Neon
5. Copy your GitHub Client ID and Client Secret
6. Paste them into the Neon Auth configuration

## Step 5: Configure Callback URLs

Make sure your callback URLs are correctly configured:

### Development
```
http://localhost:3000/handler/callback
```

### Production
```
https://yourdomain.com/handler/callback
```

Add these URLs to:
- Google Cloud Console → Credentials → Authorized redirect URIs
- GitHub OAuth App → Authorization callback URL
- Neon Auth → Configuration → Allowed Callback URLs

## Step 6: Test OAuth Flow

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the sign-in page
3. Click on "Sign in with Google" or "Sign in with GitHub"
4. Complete the OAuth flow
5. Verify that you're redirected back and logged in

## Troubleshooting

### "Redirect URI mismatch" Error

**Problem**: The callback URL doesn't match what's configured in the OAuth provider.

**Solution**: 
- Check that the callback URL in your OAuth provider settings matches exactly
- Make sure you're using the correct protocol (http vs https)
- Verify the port number matches

### "Invalid client" Error

**Problem**: The OAuth credentials are incorrect or not configured.

**Solution**:
- Double-check your Client ID and Client Secret
- Make sure you copied the entire key without extra spaces
- Verify the credentials are for the correct environment (dev vs prod)

### OAuth Button Not Appearing

**Problem**: The OAuth buttons don't show up on the sign-in page.

**Solution**:
- Check that all three Stack Auth environment variables are set
- Restart your development server after adding environment variables
- Check the browser console for errors

### Account Linking Issues

**Problem**: OAuth login creates a new account instead of linking to existing account.

**Solution**:
- This happens when the email from OAuth doesn't match an existing account
- Make sure the email address is verified in your OAuth provider
- Check that email verification is enabled in Neon Auth settings

## Account Linking

When a user signs in with OAuth and their email matches an existing account:

1. The OAuth provider is automatically linked to the existing account
2. The user can sign in with either password or OAuth in the future
3. Profile information (name, avatar) is updated from the OAuth provider

## Security Considerations

### Client vs Server Keys

- **Publishable Client Key**: Safe to expose in client-side code
- **Secret Server Key**: Must NEVER be exposed to the client
- Always use environment variables, never hardcode keys

### Callback URL Security

- Only add trusted callback URLs to your OAuth provider settings
- Use HTTPS in production
- Validate the state parameter to prevent CSRF attacks (handled by Stack Auth)

### Token Storage

- OAuth tokens are managed by Stack Auth
- Session tokens are stored in secure, httpOnly cookies
- Never store OAuth tokens in localStorage or sessionStorage

## Advanced Configuration

### Custom OAuth Scopes

To request additional permissions from OAuth providers:

1. Go to Neon Console → Auth → Configuration
2. Find your OAuth provider
3. Click **Advanced Settings**
4. Add custom scopes (e.g., `repo` for GitHub, `email` for Google)

### Profile Customization

To customize which profile fields are synced:

1. Go to Neon Console → Auth → Configuration
2. Click **Profile Settings**
3. Select which fields to sync from OAuth providers

## Next Steps

- [Email Service Setup](EMAIL_SERVICE.md) - Configure password reset emails
- [Rate Limiting Configuration](RATE_LIMITING.md) - Configure rate limits
- [Security Best Practices](SECURITY_BEST_PRACTICES.md) - Production security checklist
