import Stripe from "stripe";

// Graceful degradation for missing Stripe configuration
const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY;

if (!STRIPE_ENABLED) {
  console.warn('Stripe not configured - payment features will be disabled');
}

export const stripe = STRIPE_ENABLED 
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-08-27.basil",
    })
  : null;

export const isStripeEnabled = () => STRIPE_ENABLED;

// Subscription plans configuration
export const SUBSCRIPTION_PLANS = {
  pro: {
    name: "Pro",
    price: 1900, // $19.00 in cents
    currency: "usd",
    interval: "month",
    features: {
      analysisLimit: -1, // unlimited
      apiCalls: 1000,
      pdfExport: true,
      prioritySupport: false,
      customCriteria: false,
      bulkAnalysis: false,
    }
  },
  enterprise: {
    name: "Enterprise", 
    price: 9900, // $99.00 in cents
    currency: "usd",
    interval: "month",
    features: {
      analysisLimit: -1, // unlimited
      apiCalls: -1, // unlimited
      pdfExport: true,
      prioritySupport: true,
      customCriteria: true,
      bulkAnalysis: true,
    }
  }
} as const;

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export function getSubscriptionLimits(tier: SubscriptionTier) {
  switch (tier) {
    case 'free':
      return {
        analysisLimit: 5, // per day
        apiCalls: 0,
        pdfExport: false,
        prioritySupport: false,
        customCriteria: false,
        bulkAnalysis: false,
      };
    case 'pro':
      return SUBSCRIPTION_PLANS.pro.features;
    case 'enterprise':
      return SUBSCRIPTION_PLANS.enterprise.features;
    default:
      return getSubscriptionLimits('free');
  }
}

export async function createOrRetrieveStripeCustomer(email: string, userId: string) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    // Try to find existing customer
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        userId: userId,
      },
    });

    return customer;
  } catch (error) {
    console.error("Error creating/retrieving Stripe customer:", error);
    throw error;
  }
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  priceId: string
): Promise<Stripe.Checkout.Session> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    // Create or retrieve customer
    const customer = await createOrRetrieveStripeCustomer(email, userId);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/subscription`,
      metadata: {
        userId,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

export async function createCustomerPortalSession(
  customerId: string
): Promise<Stripe.BillingPortal.Session> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL}/subscription`,
    });

    return session;
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    throw error;
  }
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export async function getSubscriptionStatus(
  subscriptionId: string
): Promise<SubscriptionStatus> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Determine tier based on price
    let tier: SubscriptionTier = 'free';
    if (subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id;
      if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
        tier = 'pro';
      } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
        tier = 'enterprise';
      }
    }

    return {
      tier,
      status: subscription.status as SubscriptionStatus['status'],
      currentPeriodEnd: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : null,
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end || false,
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw error;
  }
}

export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    if (immediately) {
      // Cancel immediately
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      return subscription;
    } else {
      // Cancel at period end
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return subscription;
    }
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }
}

export async function createSubscription(customerId: string, planType: keyof typeof SUBSCRIPTION_PLANS) {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const plan = SUBSCRIPTION_PLANS[planType];
    
    // Create a price for this subscription
    const price = await stripe.prices.create({
      unit_amount: plan.price,
      currency: plan.currency,
      recurring: {
        interval: plan.interval,
      },
      product_data: {
        name: `RepoAnalyzer ${plan.name} Plan`,
      },
    });

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: price.id,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    return subscription;
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}