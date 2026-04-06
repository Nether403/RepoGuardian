import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { LoadingSkeleton } from "@/components/skeleton-loader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export default function SubscriptionCancel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: subscription, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/subscription/status'],
  });

  const cancelSubscription = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to cancel subscription');
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription has been cancelled and will end at the end of the billing period.',
      });
      setLocation('/subscription');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-2xl mx-auto px-6">
          <LoadingSkeleton variant="card" count={1} />
        </div>
      </div>
    );
  }

  if (!subscription || subscription.tier === 'free' || subscription.status !== 'active') {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-2xl mx-auto px-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have an active subscription to cancel.
            </AlertDescription>
          </Alert>
          <Button onClick={() => setLocation('/subscription')} className="mt-4">
            Back to Subscription
          </Button>
        </div>
      </div>
    );
  }

  if (subscription.cancelAtPeriodEnd) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-2xl mx-auto px-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Already Cancelled</CardTitle>
              <CardDescription>
                Your subscription is set to cancel at the end of the billing period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your subscription will end on{' '}
                  {subscription.currentPeriodEnd && 
                    new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </AlertDescription>
              </Alert>
              <Button onClick={() => setLocation('/subscription')} className="mt-4">
                Back to Subscription
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-2xl mx-auto px-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-6 h-6 text-destructive" />
              <CardTitle>Cancel Subscription</CardTitle>
            </div>
            <CardDescription>
              We're sorry to see you go
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Cancelling your subscription will:
              </AlertDescription>
            </Alert>

            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Remove access to premium features at the end of your billing period</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Revert your account to the free tier with limited analyses</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Disable API access and advanced analytics</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Remove priority support</span>
              </li>
            </ul>

            {subscription.currentPeriodEnd && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You'll continue to have access to premium features until{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setLocation('/subscription')}
                className="flex-1"
              >
                Keep Subscription
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowConfirmDialog(true)}
                className="flex-1"
              >
                Cancel Subscription
              </Button>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel your subscription at the end of the current billing period.
                You can resubscribe at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => cancelSubscription.mutate()}
                disabled={cancelSubscription.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cancelSubscription.isPending ? 'Cancelling...' : 'Yes, Cancel Subscription'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
