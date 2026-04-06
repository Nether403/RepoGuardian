import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function PaymentSuccess() {
  const [location, setLocation] = useLocation();
  const [plan, setPlan] = useState<string>("");

  useEffect(() => {
    // Extract plan from query params
    const params = new URLSearchParams(location.split('?')[1]);
    const planParam = params.get('plan');
    setPlan(planParam || 'Pro');
  }, [location]);

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl mb-2">Payment Successful!</CardTitle>
            <CardDescription className="text-lg">
              Welcome to RepoAnalyzer {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-gradient-to-r from-[#FF6B35]/10 to-[#FF3333]/10 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Your subscription includes:</h3>
              <ul className="text-left space-y-2 max-w-md mx-auto">
                {plan.toLowerCase() === 'pro' ? (
                  <>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Unlimited repository analyses
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Advanced analysis metrics
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      PDF export with branding
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      API access (1000 calls/month)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Priority AI Assistant
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Everything in Pro, plus:
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Unlimited API access
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      White-label PDF exports
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Custom analysis criteria
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Bulk analysis (100+ repos)
                    </li>
                  </>
                )}
              </ul>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => setLocation("/")}
                className="w-full bg-gradient-to-r from-[#FF6B35] to-[#FF3333] hover:from-[#FF6B35]/90 hover:to-[#FF3333]/90"
                data-testid="button-start-analyzing"
              >
                Start Analyzing Repositories
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <Button
                onClick={() => setLocation("/profile")}
                variant="outline"
                className="w-full"
                data-testid="button-manage-subscription"
              >
                Manage Subscription
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>A confirmation email has been sent to your registered email address.</p>
              <p className="mt-1">Your subscription will automatically renew each month.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}