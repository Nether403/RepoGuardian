# Stripe Setup Guide

This guide walks you through setting up Stripe for RepoRadar's subscription payment processing.

## Prerequisites

- A Stripe account (sign up at https://stripe.com)
- Access to your Stripe Dashboard

## Step 1: Get API Keys

### For Development (Test Mode)

1. Log in to your Stripe Dashboard
2. Click on **Developers** in the left sidebar
3. Click on **API keys**
4. Copy your **Publishable key** (starts with `pk_test_`)
5. Click **Reveal test key** and copy your **Secret key** (starts with `sk_test_`)
6. Add these to your `.env` file:

```bash
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### For Production (Live Mode)

1. Toggle to **Live mode** in the Stripe Dashboard
2. Follow the same steps as above
3. Use keys that start with `pk_live_` and `sk_live_`

⚠️ **Important**: Never commit live keys to version control!

## Step 2: Create Products and Prices

### Create Pro Plan

1. In Stripe Dashboard, go to **Products** → **Add product**
2. Fill in the details:
   - **Name**: RepoRadar Pro Plan
   - **Description**: Professional tier with advanced features
   - **Pricing model**: Standard pricing
   - **Price**: $19.00 USD
   - **Billing period**: Monthly
   - **Payment type**: Recurring
3. Click **Save product**
4. Copy the **Price ID** (starts with `price_`)
5. Add to `.env`:

```bash
STRIPE_PRO_PRICE_ID=price_your_pro_price_id
```

### Create Enterprise Plan

1. Repeat the above steps with:
   - **Name**: RepoRadar Enterprise Plan
   - **Description**: Enterprise tier with unlimited features
   - **Price**: $99.00 USD
   - **Billing period**: Monthly
2. Copy the **Price ID** and add to `.env`:

```bash
STRIPE_ENTERPRISE_PRICE_ID=price_your_enterprise_price_id
```

## Step 3: Configure Webhook Endpoint

Webhooks allow Stripe to notify your application about payment events.

### Local Development with Stripe CLI

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login to Stripe CLI:
   ```bash
   stripe login
   ```
3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3002/api/stripe/webhook
   ```
4. Copy the webhook signing secret (starts with `whsec_`)
5. Add to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

### Production Webhook Setup

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL:
   ```
   https://your-domain.com/api/stripe/webhook
   ```
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** and add to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret
   ```

## Step 4: Set Application URL

Add your application URL to `.env`:

```bash
# For development
APP_URL=http://localhost:3002

# For production
APP_URL=https://your-domain.com
```

This is used for Stripe checkout success/cancel redirects.

## Step 5: Verify Configuration

Run the configuration validation script:

```bash
npm run config:validate
```

This will check that all required Stripe environment variables are set.

You should see output like:

```
✅ Stripe Payments: Enabled

Stripe Configuration:
  Mode: Test
  Pro Price ID: ✓ Configured
  Enterprise Price ID: ✓ Configured
  Webhook Secret: ✓ Configured
  App URL: http://localhost:5000
```

## Testing Stripe Integration

### Install Stripe CLI

The Stripe CLI is essential for local webhook testing. Install it:

**macOS (Homebrew)**:
```bash
brew install stripe/stripe-cli/stripe
```

**Windows (Scoop)**:
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Linux**:
```bash
# Download from https://github.com/stripe/stripe-cli/releases/latest
```

**Login to Stripe CLI**:
```bash
stripe login
```

### Test Cards

Use these test card numbers in development:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`
- **Insufficient funds**: `4000 0000 0000 9995`

Use any future expiry date, any 3-digit CVC, and any postal code.

### Test Webhooks Locally

1. Start your development server:
   ```bash
   npm run dev
   ```

2. In another terminal, start Stripe CLI webhook forwarding:
   ```bash
   stripe listen --forward-to localhost:5000/api/stripe/webhook
   ```
   
   This will output a webhook signing secret (whsec_...). Add it to your `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. Trigger test webhooks:
   ```bash
   # Test subscription creation
   stripe trigger customer.subscription.created
   
   # Test subscription update
   stripe trigger customer.subscription.updated
   
   # Test subscription deletion
   stripe trigger customer.subscription.deleted
   
   # Test successful payment
   stripe trigger invoice.payment_succeeded
   
   # Test failed payment
   stripe trigger invoice.payment_failed
   ```

4. Check your server logs to verify webhooks were received and processed.

### Complete Integration Test

1. Start the server with Stripe CLI forwarding webhooks
2. Navigate to http://localhost:5000/subscription
3. Click "Upgrade to Pro"
4. Use test card `4242 4242 4242 4242`
5. Complete the checkout
6. Verify you're redirected to success page
7. Check that your subscription status updated in the database
8. Verify webhook events were logged in `subscriptionEvents` table

### Testing Subscription Lifecycle

```bash
# 1. Create a subscription
stripe trigger customer.subscription.created

# 2. Simulate successful payment
stripe trigger invoice.payment_succeeded

# 3. Update subscription (e.g., change plan)
stripe trigger customer.subscription.updated

# 4. Simulate payment failure
stripe trigger invoice.payment_failed

# 5. Cancel subscription
stripe trigger customer.subscription.deleted
```

### Verify Webhook Processing

Check the database to ensure events are being recorded:

```sql
-- View recent subscription events
SELECT * FROM subscription_events 
ORDER BY created_at DESC 
LIMIT 10;

-- Check user subscription status
SELECT id, email, subscription_tier, subscription_status, subscription_end_date 
FROM users 
WHERE stripe_customer_id IS NOT NULL;
```

## Subscription Plans Configuration

The application defines two subscription tiers:

### Free Tier (Default)
- 10 analyses per day
- 100 API calls per hour
- Basic analytics only

### Pro Tier ($19/month)
- 100 analyses per day
- 1,000 API calls per hour
- Advanced analytics
- PDF export
- Priority support

### Enterprise Tier ($99/month)
- Unlimited analyses
- Unlimited API calls
- All Pro features
- Custom integrations
- Dedicated support

## Security Best Practices

1. **Never expose secret keys**: Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` secure
2. **Use test mode for development**: Always use test keys during development
3. **Verify webhook signatures**: The application automatically verifies webhook signatures
4. **Use HTTPS in production**: Stripe requires HTTPS for webhook endpoints
5. **Rotate keys regularly**: Periodically rotate your API keys in production

## Troubleshooting

### Webhook signature verification fails

- Ensure `STRIPE_WEBHOOK_SECRET` matches your webhook endpoint secret
- Check that you're using the correct secret for test/live mode
- Verify the webhook endpoint URL is correct

### Checkout session creation fails

- Verify `STRIPE_SECRET_KEY` is set correctly
- Check that price IDs exist in your Stripe account
- Ensure you're using the correct mode (test/live)

### Subscription status not updating

- Check webhook endpoint is receiving events
- Verify webhook signature verification is passing
- Check server logs for webhook processing errors
- Ensure database connection is working

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
