import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingSkeleton } from "@/components/skeleton-loader";
import { Link } from "wouter";
import { 
  Check, 
  X, 
  CreditCard, 
  Calendar, 
  AlertCircle,
  Zap,
  Crown,
  Sparkles
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
}

interface Plan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  price: number;
  interval: string;
  priceId?: string;
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'forever',
    icon: <Sparkles className="w-6 h-6" />,
    features: [
      '5 analyses per day',
      'Basic analytics',
      'Community support',
      'Public repositories only'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    interval: 'month',
    priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
    icon: <Zap className="w-6 h-6" />,
    popular: true,
    features: [
      'Unlimited analyses',
      '1,000 API calls/hour',
      'Advanced analytics',
      'PDF export',
      'Priority support',
      'Private repositories'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    interval: 'month',
    priceId: import.meta.env.VITE_STRIPE_ENTERPRISE_PRICE_ID,
    icon: <Crown className="w-6 h-6" />,
    features: [
      'Everything in Pro',
      'Unlimited API calls',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
      'Team collaboration',
      'Custom criteria'
    ]
  }
];

interface StripeConfig {
  enabled: boolean;
}

export default function SubscriptionPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading, error } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/subscription/status'],
    enabled: isAuthenticated,
  });

  const { data: stripeConfig } = useQuery<StripeConfig>({
    queryKey: ['/api/subscription/config'],
    enabled: isAuthenticated,
  });

  const createCheckout = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create checkout session');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="py-12">
          <div className="max-w-7xl mx-auto px-6">
            <Card className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Subscription Management</h2>
              <p className="text-muted-foreground mb-6">
                Sign in to manage your subscription
              </p>
              <Button asChild>
                <a href="/api/login">Sign In</a>
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-8">
              <div className="h-10 w-64 bg-gray-700 rounded animate-pulse mb-4"></div>
              <div className="h-4 w-96 bg-gray-700 rounded animate-pulse"></div>
            </div>
            <LoadingSkeleton variant="card" count={3} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="py-12">
          <div className="max-w-7xl mx-auto px-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load subscription information. Please try again later.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  const currentTier = subscription?.tier || 'free';
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const isStripeEnabled = stripeConfig?.enabled !== false;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="py-12 pt-32">
        <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-4">
            Subscription Management
          </h1>
          <p className="text-muted-foreground">
            Choose the plan that fits your needs
          </p>
        </div>

        {/* Stripe Unavailable Alert */}
        {!isStripeEnabled && (
          <Alert className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Payment processing is currently unavailable.</strong>
              <br />
              For enterprise plans or custom pricing, please contact our sales team at{' '}
              <a href="mailto:sales@reporadar.com" className="underline">
                sales@reporadar.com
              </a>
            </AlertDescription>
          </Alert>
        )}

        {/* Current Subscription Status */}
        {subscription && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Plan: {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}
              </CardTitle>
              <CardDescription>
                Status: {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {subscription.currentPeriodEnd && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on{' '}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {subscription.cancelAtPeriodEnd && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your subscription will be cancelled at the end of the billing period.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plan Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentTier;
            const canUpgrade = 
              (currentTier === 'free' && (plan.id === 'pro' || plan.id === 'enterprise')) ||
              (currentTier === 'pro' && plan.id === 'enterprise');

            return (
              <Card 
                key={plan.id}
                className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''} ${isCurrent ? 'ring-2 ring-primary' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-primary">{plan.icon}</div>
                    {isCurrent && (
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-semibold">
                        Current Plan
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-foreground">
                        ${plan.price}
                      </span>
                      <span className="text-muted-foreground">/{plan.interval}</span>
                    </div>
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.id === 'free' ? (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      disabled={isCurrent}
                    >
                      {isCurrent ? 'Current Plan' : 'Free Forever'}
                    </Button>
                  ) : !isStripeEnabled ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      asChild
                    >
                      <a href="mailto:sales@reporadar.com">
                        Contact Sales
                      </a>
                    </Button>
                  ) : canUpgrade ? (
                    <Button
                      className="w-full"
                      onClick={() => plan.priceId && createCheckout.mutate(plan.priceId)}
                      disabled={createCheckout.isPending}
                    >
                      {createCheckout.isPending ? 'Processing...' : `Upgrade to ${plan.name}`}
                    </Button>
                  ) : isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Contact Sales
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional Actions */}
        {isActive && currentTier !== 'free' && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Manage Subscription</CardTitle>
              <CardDescription>
                Update payment method, view invoices, or cancel your subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button variant="outline" asChild>
                  <Link href="/subscription/billing">
                    View Billing History
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/subscription/cancel">
                    Cancel Subscription
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
