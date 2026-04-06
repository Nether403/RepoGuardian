# Email Service Configuration Guide

This guide explains how to configure email service for password reset functionality in RepoRadar.

## Overview

RepoRadar uses email to send password reset links to users. The application supports Resend as the email service provider, which offers a simple API and generous free tier.

## Why Resend?

- **Simple API**: Easy to integrate and use
- **Generous Free Tier**: 3,000 emails/month for free
- **Reliable Delivery**: High deliverability rates
- **Developer-Friendly**: Great documentation and support
- **Custom Domains**: Use your own domain for emails

## Prerequisites

- A Resend account (free tier available)
- A verified domain (optional, but recommended for production)

## Step 1: Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Click **Sign Up** and create an account
3. Verify your email address

## Step 2: Get Your API Key

1. Log in to your Resend dashboard
2. Go to **API Keys** in the left sidebar
3. Click **Create API Key**
4. Give it a name (e.g., "RepoRadar Production")
5. Select the appropriate permissions:
   - **Sending access**: Required
   - **Domain access**: Optional
6. Copy the API key (you won't be able to see it again)

## Step 3: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Email Service Configuration
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=RepoRadar
PASSWORD_RESET_URL=https://yourdomain.com/reset-password
```

### Configuration Options

- **RESEND_API_KEY**: Your Resend API key (required)
- **EMAIL_FROM**: The email address to send from (required)
- **EMAIL_FROM_NAME**: The display name for the sender (optional, defaults to "RepoRadar")
- **PASSWORD_RESET_URL**: The base URL for password reset links (required)

## Step 4: Verify Your Domain (Production)

For production use, you should verify your domain to improve deliverability and remove the "via resend.com" label.

### Add Your Domain

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Click **Add**

### Configure DNS Records

Resend will provide DNS records to add to your domain:

1. **SPF Record**: Authorizes Resend to send emails on your behalf
2. **DKIM Record**: Adds a digital signature to your emails
3. **DMARC Record**: Specifies how to handle authentication failures

Add these records to your DNS provider (e.g., Cloudflare, Namecheap, GoDaddy).

### Verify Domain

1. After adding DNS records, click **Verify** in Resend dashboard
2. Wait for DNS propagation (can take up to 48 hours)
3. Once verified, you can send emails from your domain

## Step 5: Test Email Sending

### Development Testing

In development, you can use Resend's test mode:

```bash
# Use a test API key
RESEND_API_KEY=re_test_your_test_key_here
EMAIL_FROM=onboarding@resend.dev
```

Test emails will be sent to your Resend dashboard instead of actual recipients.

### Production Testing

1. Start your application
2. Go to the login page
3. Click "Forgot Password"
4. Enter your email address
5. Check your inbox for the password reset email

## Email Templates

RepoRadar uses the following email templates:

### Password Reset Email

**Subject**: Reset your RepoRadar password

**Content**:
```
Hi there,

You requested to reset your password for RepoRadar.

Click the link below to reset your password:
[Reset Password Button]

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

Thanks,
The RepoRadar Team
```

### Customizing Templates

To customize email templates, edit the email service file:

```typescript
// server/utils/emailService.ts

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<void> {
  // Customize the email content here
}
```

## Troubleshooting

### Emails Not Being Sent

**Problem**: Password reset emails are not being sent.

**Solution**:
- Check that `RESEND_API_KEY` is set correctly
- Verify the API key has sending permissions
- Check the server logs for error messages
- Make sure the email address is valid

### Emails Going to Spam

**Problem**: Password reset emails are landing in spam folders.

**Solution**:
- Verify your domain in Resend
- Add SPF, DKIM, and DMARC records
- Use a professional email address (not gmail.com)
- Avoid spam trigger words in email content

### "Invalid API Key" Error

**Problem**: Getting an "Invalid API Key" error.

**Solution**:
- Make sure you copied the entire API key
- Check for extra spaces or newlines
- Verify the API key hasn't been revoked
- Create a new API key if needed

### Domain Verification Failing

**Problem**: Domain verification is not completing.

**Solution**:
- Wait for DNS propagation (up to 48 hours)
- Verify DNS records are added correctly
- Use a DNS checker tool to confirm records
- Contact your DNS provider if issues persist

## Rate Limits

### Resend Rate Limits

- **Free Tier**: 3,000 emails/month, 100 emails/day
- **Paid Plans**: Higher limits available

### Application Rate Limits

RepoRadar implements its own rate limiting for password reset:

- **3 requests per hour per email address**
- Prevents abuse and spam
- Configurable via environment variables

## Security Considerations

### API Key Security

- **Never commit API keys to version control**
- Use environment variables
- Rotate keys regularly
- Use different keys for dev/staging/production

### Email Content Security

- Don't include sensitive information in emails
- Use time-limited tokens (1 hour expiration)
- Include a warning about phishing
- Provide a way to report suspicious emails

### Domain Security

- Use DMARC to prevent email spoofing
- Monitor email delivery reports
- Set up alerts for authentication failures

## Monitoring

### Email Delivery Monitoring

Resend provides delivery analytics:

1. Go to **Logs** in Resend dashboard
2. View sent, delivered, bounced, and complained emails
3. Set up webhooks for real-time notifications

### Application Monitoring

Monitor password reset metrics:

- Number of reset requests
- Success/failure rates
- Token expiration rates
- Email delivery failures

## Alternative Email Providers

While RepoRadar is configured for Resend, you can use other providers:

### SendGrid

```bash
SENDGRID_API_KEY=your_sendgrid_key
```

### AWS SES

```bash
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY=your_access_key
AWS_SES_SECRET_KEY=your_secret_key
```

To use alternative providers, modify `server/utils/emailService.ts`.

## Cost Considerations

### Resend Pricing

- **Free**: 3,000 emails/month
- **Pro**: $20/month for 50,000 emails
- **Enterprise**: Custom pricing

### Optimization Tips

- Implement rate limiting to prevent abuse
- Monitor usage regularly
- Set up alerts for unusual activity
- Consider email batching for bulk operations

## Next Steps

- [OAuth Setup Guide](OAUTH_SETUP.md) - Configure social login
- [Rate Limiting Configuration](RATE_LIMITING.md) - Configure rate limits
- [Security Best Practices](SECURITY_BEST_PRACTICES.md) - Production security checklist
