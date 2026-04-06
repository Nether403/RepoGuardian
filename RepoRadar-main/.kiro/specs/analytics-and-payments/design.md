# Design Document

## Overview

This design document outlines the implementation approach for fixing analytics issues and integrating Stripe payment processing in RepoRadar. The enhancements will resolve data display problems in the Analytics Dashboard, fix authorization errors in Advanced Analytics, add repository reanalysis functionality, and implement a complete payment system for subscription management.

### Goals
- Fix Analytics Dashboard to display actual user data
- Resolve Advanced Analytics authorization errors
- Implement repository reanalysis with cache clearing
- Integrate Stripe for payment processing
- Create subscription management UI
- Enforce subscription tier limits

### Non-Goals
- Custom payment gateway implementation
- Cryptocurrency payment support
- Invoice generation system (handled by Stripe)
- Tax calculation (handled by Stripe Tax)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Analytics   │  │ Subscription │  │  Reanalyze   │      │
│  │  Dashboard   │  │     UI       │  │    Button    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Analytics   │  │  Subscription│  │  Repository  │      │
│  │  Endpoints   │  │  Endpoints   │  │  Endpoints   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Service Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Analytics   │  │    Stripe    │  │  Analysis    │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Stripe    │  │    Cache     │      │
│  │   Database   │  │     API      │  │   (Redis)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Analytics Service (Enhanced)

**Location:** `server/analytics.ts` (existing, needs fixes)

**Interface:**
```typescript
interface AnalyticsService {
  getUserAnalytics(userId: string): Promise<AnalyticsDashboardData>;
  getAdvancedAnalytics(userId: string, timeRange: string): Promise<AdvancedAnalyticsData>;
  trackEvent(event: AnalyticsEvent): Promise<void>;
}

interface AnalyticsDashboardData {
  stats: {
    totalAnalyses: number;
    thisMonth: number;
    growth: number;
    avgScore: number;
    topLanguage: string;
    activeProjects: number;
  };
  activity: Array<{ date: string; count: number }>;
  languages: Array<{ name: string; value: number }>;
  scores: Array<{ name: string; score: number }>;
  trends: Array<MonthlyTrend>;
  performance: Array<PerformanceInsight>;
  recentAnalyses: Array<RecentAnalysis>;
}
```

**Issues to Fix:**
- Analytics endpoint returns empty data for authenticated users
- getUserAnalyses() not properly filtering by userId
- Date calculations for monthly trends incorrect
- Missing error handling for database queries

### 2. Repository Reanalysis Service

**Location:** `server/reanalysis.ts` (new)

**Interface:**
```typescript
interface ReanalysisService {
  reanalyzeRepository(repositoryId: string, userId: string): Promise<Analysis>;
  clearRepositoryCache(repositoryId: string): Promise<void>;
  canReanalyze(repositoryId: string, userId: string): Promise<boolean>;
}
```

**Implementation Details:**
- Clear cached analysis from database
- Invalidate Redis cache if present
- Trigger new analysis with fresh GitHub data
- Update lastAnalyzed timestamp
- Rate limit reanalysis requests (1 per repository per hour)

### 3. Stripe Integration Service

**Location:** `server/stripe.ts` (existing, needs enhancement)

**Interface:**
```typescript
interface StripeService {
  createCheckoutSession(userId: string, priceId: string): Promise<CheckoutSession>;
  createCustomerPortalSession(customerId: string): Promise<PortalSession>;
  handleWebhook(event: Stripe.Event): Promise<void>;
  getSubscriptionStatus(userId: string): Promise<SubscriptionStatus>;
  cancelSubscription(subscriptionId: string): Promise<void>;
}

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled' | 'past_due';
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}
```

**Stripe Products:**
```typescript
const STRIPE_PRODUCTS = {
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      '1000 API calls per hour',
      '100 analyses per day',
      'Advanced analytics',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: [
      'Unlimited API calls',
      'Unlimited analyses',
      'Custom integrations',
      'Dedicated support',
    ],
  },
};
```

### 4. Subscription Tier Enforcement Middleware

**Location:** `server/middleware/subscriptionTier.ts` (new)

**Interface:**
```typescript
interface TierEnforcementMiddleware {
  checkTierAccess(feature: string): RequestHandler;
  checkRateLimit(limitType: 'api' | 'analysis'): RequestHandler;
}

const TIER_LIMITS = {
  free: {
    apiCallsPerHour: 100,
    analysesPerDay: 10,
    features: ['basic_analytics'],
  },
  pro: {
    apiCallsPerHour: 1000,
    analysesPerDay: 100,
    features: ['basic_analytics', 'advanced_analytics', 'export'],
  },
  enterprise: {
    apiCallsPerHour: -1, // unlimited
    analysesPerDay: -1, // unlimited
    features: ['all'],
  },
};
```

### 5. Subscription Management UI

**Location:** `client/src/pages/subscription.tsx` (new)

**Interface:**
```typescript
interface SubscriptionPageProps {
  currentTier: string;
  subscriptionStatus: SubscriptionStatus;
  availablePlans: Plan[];
}

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  priceId: string;
}
```

**Components:**
- Current subscription card
- Plan comparison table
- Upgrade/downgrade buttons
- Billing history
- Cancel subscription flow

## Data Models

### Enhanced Repository Schema

```typescript
export const repositories = pgTable("repositories", {
  // ... existing fields
  lastAnalyzed: timestamp("last_analyzed"),
  analysisCount: integer("analysis_count").default(0),
  lastReanalyzedBy: varchar("last_reanalyzed_by").references(() => users.id),
  reanalysisLockedUntil: timestamp("reanalysis_locked_until"),
});
```

### Subscription Events Table

```typescript
export const subscriptionEvents = pgTable("subscription_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventType: varchar("event_type").notNull(), // subscription_created, updated, cancelled, payment_succeeded, payment_failed
  stripeEventId: varchar("stripe_event_id").unique(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_subscription_events_user").on(table.userId),
  index("idx_subscription_events_type").on(table.eventType),
]);
```

## Error Handling

### Analytics Errors

**Common Issues:**
1. Empty data returned for authenticated users
2. Authorization failures
3. Database query errors
4. Date calculation errors

**Solutions:**
```typescript
// Fix: Ensure userId is properly extracted from session
const getUserId = (req: AuthenticatedRequest): string => {
  return req.user?.claims?.sub || req.session?.user?.id;
};

// Fix: Add proper error handling
try {
  const analyses = await storage.getUserAnalyses(userId);
  if (!analyses || analyses.length === 0) {
    return res.json(getEmptyAnalyticsData());
  }
  // ... process data
} catch (error) {
  console.error('Analytics error:', error);
  return res.status(500).json({ 
    error: 'Failed to fetch analytics',
    message: error.message 
  });
}
```

### Stripe Webhook Errors

**Error Scenarios:**
- Invalid signature
- Duplicate events
- Processing failures
- Database update failures

**Error Handling Strategy:**
```typescript
app.post('/api/stripe/webhook', async (req, res) => {
  let event: Stripe.Event;
  
  try {
    // Verify signature
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature']!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Check for duplicate events
  const existingEvent = await storage.getSubscriptionEvent(event.id);
  if (existingEvent) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    await handleStripeEvent(event);
    await storage.createSubscriptionEvent(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 200 to prevent Stripe retries for unrecoverable errors
    res.json({ received: true, error: error.message });
  }
});
```

## Testing Strategy

### Unit Tests

**Analytics Service Tests:**
- Test getUserAnalytics with valid userId
- Test empty data handling
- Test date range calculations
- Test aggregation logic

**Reanalysis Service Tests:**
- Test cache clearing
- Test rate limiting
- Test concurrent reanalysis prevention
- Test error handling

**Stripe Service Tests:**
- Test checkout session creation
- Test webhook signature verification
- Test subscription status retrieval
- Test cancellation flow

### Integration Tests

**Analytics Flow Tests:**
- Complete analytics dashboard load
- Advanced analytics with authentication
- Data accuracy verification

**Payment Flow Tests:**
- Complete checkout flow (mocked Stripe)
- Webhook processing
- Subscription status updates
- Tier enforcement

### End-to-End Tests

**User Journey Tests:**
- View analytics dashboard
- Reanalyze repository
- Subscribe to pro plan
- Access premium features
- Cancel subscription


## Implementation Details

### Phase 1: Fix Analytics Dashboard

**Root Cause Analysis:**
The analytics dashboard shows no data because:
1. `getUserAnalyses()` may not be filtering correctly by userId
2. Session user ID extraction is inconsistent
3. Empty data handling is missing

**Fix Implementation:**
```typescript
// server/routes.ts - Fix analytics endpoint
app.get('/api/analytics/dashboard', isAuthenticated, async (req: AuthenticatedRequest, res) => {
  try {
    // Fix: Consistent userId extraction
    const userId = req.user?.claims?.sub || (req.session as any)?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const analyses = await storage.getUserAnalyses(userId);
    
    // Fix: Handle empty data gracefully
    if (!analyses || analyses.length === 0) {
      return res.json(getEmptyDashboardData());
    }

    // Calculate statistics with proper error handling
    const stats = calculateDashboardStats(analyses);
    res.json(stats);
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
```

### Phase 2: Fix Advanced Analytics Authorization

**Root Cause:**
The Advanced Analytics page returns "Unauthorized" because:
1. `isAuthenticated` middleware may not be properly checking session
2. Frontend is not sending credentials correctly

**Fix Implementation:**
```typescript
// Ensure credentials are included in fetch
const { data, error } = useQuery({
  queryKey: ["/api/analytics/advanced", timeRange],
  queryFn: async () => {
    const res = await fetch(`/api/analytics/advanced?timeRange=${timeRange}`, {
      credentials: "include", // This is correct
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch analytics: ${res.statusText}`);
    }
    return await res.json();
  },
});

// Fix middleware to properly check session
export const isAuthenticated: express.RequestHandler = async (req, res, next) => {
  try {
    const sessionUser = (req.session as any).user;
    
    if (sessionUser) {
      (req as any).user = {
        claims: {
          sub: sessionUser.id,
          email: sessionUser.email,
        }
      };
      return next();
    }
    
    return res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: "Unauthorized" });
  }
};
```

### Phase 3: Repository Reanalysis

**Implementation Steps:**
1. Add reanalysis button to repository detail page
2. Create reanalysis endpoint
3. Implement cache clearing logic
4. Add rate limiting

**Backend Implementation:**
```typescript
// server/routes.ts
app.post('/api/repositories/:id/reanalyze', 
  isAuthenticated, 
  analysisRateLimit,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id: repositoryId } = req.params;
      const userId = req.user.claims.sub;

      // Check if reanalysis is allowed (rate limit)
      const repository = await storage.getRepository(repositoryId);
      if (!repository) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      const now = new Date();
      if (repository.reanalysisLockedUntil && repository.reanalysisLockedUntil > now) {
        const waitMinutes = Math.ceil((repository.reanalysisLockedUntil.getTime() - now.getTime()) / 60000);
        return res.status(429).json({ 
          error: 'Reanalysis rate limit exceeded',
          retryAfter: waitMinutes 
        });
      }

      // Clear existing analysis
      await storage.deleteRepositoryAnalysis(repositoryId);

      // Trigger new analysis
      const analysis = await analyzeRepository(repository);
      await storage.createAnalysis({
        ...analysis,
        repositoryId,
        userId,
      });

      // Update repository
      await storage.updateRepository(repositoryId, {
        lastAnalyzed: now,
        lastReanalyzedBy: userId,
        reanalysisLockedUntil: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour
      });

      res.json({ analysis, repository });
    } catch (error) {
      console.error('Reanalysis error:', error);
      res.status(500).json({ error: 'Failed to reanalyze repository' });
    }
  }
);
```

**Frontend Implementation:**
```typescript
// Add to repository detail page
const reanalyzeRepository = useMutation({
  mutationFn: async (repositoryId: string) => {
    const res = await fetch(`/api/repositories/${repositoryId}/reanalyze`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Reanalysis failed');
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['repository']);
    toast({ title: 'Repository reanalyzed successfully' });
  },
});

<Button onClick={() => reanalyzeRepository.mutate(repository.id)}>
  <RefreshCw className="mr-2 h-4 w-4" />
  Reanalyze
</Button>
```

### Phase 4: Stripe Integration

**Setup Steps:**
1. Create Stripe account and get API keys
2. Create products and prices in Stripe Dashboard
3. Configure webhook endpoint
4. Implement checkout flow

**Checkout Implementation:**
```typescript
// server/stripe.ts
export async function createCheckoutSession(
  userId: string, 
  priceId: string
): Promise<Stripe.Checkout.Session> {
  const user = await storage.getUser(userId);
  
  // Create or retrieve customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId },
    });
    customerId = customer.id;
    await storage.updateUserStripeCustomerId(userId, customerId);
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/subscription`,
    metadata: { userId },
  });

  return session;
}
```

### Phase 5: Subscription Management UI

**Component Structure:**
```typescript
// client/src/pages/subscription.tsx
export default function SubscriptionPage() {
  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => fetch('/api/subscription/status', { credentials: 'include' }).then(r => r.json()),
  });

  const createCheckout = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      });
      const { url } = await res.json();
      window.location.href = url;
    },
  });

  return (
    <div className="container mx-auto p-6">
      <h1>Subscription Management</h1>
      
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan: {subscription?.tier}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Status: {subscription?.status}</p>
          {subscription?.currentPeriodEnd && (
            <p>Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div className="grid md:grid-cols-3 gap-6 mt-6">
        {PLANS.map(plan => (
          <PlanCard 
            key={plan.id}
            plan={plan}
            current={subscription?.tier === plan.id}
            onSelect={() => createCheckout.mutate(plan.priceId)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Phase 6: Tier Enforcement

**Middleware Implementation:**
```typescript
// server/middleware/subscriptionTier.ts
export const checkTierLimit = (limitType: 'api' | 'analysis') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    
    const tier = user.subscriptionTier || 'free';
    const limits = TIER_LIMITS[tier];
    
    if (limitType === 'api') {
      const apiCalls = await rateLimiter.getCount(`api:${userId}:hour`);
      if (limits.apiCallsPerHour !== -1 && apiCalls >= limits.apiCallsPerHour) {
        return res.status(429).json({
          error: 'API rate limit exceeded',
          tier,
          limit: limits.apiCallsPerHour,
          upgrade: tier === 'free' ? 'pro' : 'enterprise',
        });
      }
    }
    
    if (limitType === 'analysis') {
      const analyses = await storage.getUserAnalysisCount(userId, 'day');
      if (limits.analysesPerDay !== -1 && analyses >= limits.analysesPerDay) {
        return res.status(429).json({
          error: 'Daily analysis limit exceeded',
          tier,
          limit: limits.analysesPerDay,
          upgrade: tier === 'free' ? 'pro' : 'enterprise',
        });
      }
    }
    
    next();
  };
};

// Apply to routes
app.post('/api/repositories/analyze', 
  isAuthenticated,
  checkTierLimit('analysis'),
  analyzeHandler
);
```

## Configuration

### Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# Application URLs
APP_URL=https://reporadar.com
```

### Stripe Products Setup

1. Create products in Stripe Dashboard:
   - Pro Plan: $29/month
   - Enterprise Plan: $99/month

2. Configure webhook endpoint:
   - URL: `https://reporadar.com/api/stripe/webhook`
   - Events: `customer.subscription.*`, `invoice.payment_*`

## Security Considerations

### Payment Security
- Never store credit card information
- Use Stripe Checkout (PCI compliant)
- Verify webhook signatures
- Use HTTPS for all payment flows

### Data Privacy
- Store minimal customer data
- Use Stripe Customer Portal for self-service
- Comply with data retention policies

## Monitoring

### Metrics to Track
- Analytics dashboard load times
- Reanalysis request rates
- Subscription conversion rates
- Payment success/failure rates
- Webhook processing times

### Alerts
- Failed webhook processing
- High reanalysis rate (potential abuse)
- Payment failures
- Subscription cancellations
