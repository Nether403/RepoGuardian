import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function SubscriptionSuccess() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Invalidate subscription status to fetch updated data
    queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12">
      <div className="max-w-md mx-auto px-6">
        <Card className="text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-2xl">Subscription Activated!</CardTitle>
            <CardDescription>
              Your payment was successful and your subscription is now active
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You now have access to all premium features. Start analyzing repositories with your new limits!
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setLocation('/subscription')} className="w-full">
                View Subscription Details
              </Button>
              <Button onClick={() => setLocation('/')} variant="outline" className="w-full">
                Start Analyzing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
