import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Sparkles, Rocket, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";

const plans = [
  {
    name: "Free",
    icon: Sparkles,
    price: "$0",
    period: "forever",
    description: "Perfect for exploring and casual analysis",
    features: [
      { text: "5 repository analyses per day", included: true },
      { text: "Basic analysis metrics", included: true },
      { text: "Search and discovery", included: true },
      { text: "Compare up to 3 repositories", included: true },
      { text: "AI Assistant (limited)", included: true },
      { text: "PDF export", included: false },
      { text: "API access", included: false },
      { text: "Priority support", included: false },
      { text: "Custom analysis criteria", included: false },
      { text: "Bulk analysis", included: false },
    ],
    buttonText: "Current Plan",
    buttonVariant: "outline" as const,
    popular: false,
  },
  {
    name: "Pro",
    icon: Rocket,
    price: "$19",
    period: "/month",
    description: "For developers and teams who need more",
    features: [
      { text: "Unlimited repository analyses", included: true },
      { text: "Advanced analysis metrics", included: true },
      { text: "Search and discovery", included: true },
      { text: "Compare up to 10 repositories", included: true },
      { text: "Priority AI Assistant", included: true },
      { text: "PDF export with branding", included: true },
      { text: "API access (1000 calls/month)", included: true },
      { text: "Email support", included: true },
      { text: "Custom analysis criteria", included: false },
      { text: "Bulk analysis", included: false },
    ],
    buttonText: "Upgrade to Pro",
    buttonVariant: "default" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    icon: Building2,
    price: "$99",
    period: "/month",
    description: "For organizations with advanced needs",
    features: [
      { text: "Unlimited repository analyses", included: true },
      { text: "Advanced analysis metrics", included: true },
      { text: "Search and discovery", included: true },
      { text: "Unlimited comparisons", included: true },
      { text: "Priority AI Assistant", included: true },
      { text: "White-label PDF exports", included: true },
      { text: "Unlimited API access", included: true },
      { text: "Priority support", included: true },
      { text: "Custom analysis criteria", included: true },
      { text: "Bulk analysis (100+ repos)", included: true },
    ],
    buttonText: "Contact Sales",
    buttonVariant: "default" as const,
    popular: false,
  },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const handleUpgrade = (planName: string) => {
    if (planName === "Free") {
      return;
    }

    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to upgrade your plan",
        variant: "destructive",
      });
      window.location.href = "/api/login";
      return;
    }

    if (planName === "Enterprise") {
      toast({
        title: "Enterprise Plan",
        description: "Our team will contact you shortly to discuss your needs",
      });
      return;
    }

    // Navigate to checkout for Pro plan
    setLocation(`/checkout?plan=${planName.toLowerCase()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16 pt-36">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-[#FF6B35] to-[#FF3333] bg-clip-text text-transparent">
          Choose Your Plan
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Unlock the full potential of repository analysis with our flexible pricing plans
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className={`relative h-full flex flex-col ${plan.popular ? 'border-[#FF6B35] shadow-2xl scale-105' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-[#FF6B35] to-[#FF3333] text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}
              
              <CardHeader className="text-center pb-8 pt-8">
                <div className="mx-auto mb-4 p-3 rounded-full bg-gradient-to-r from-[#FF6B35]/10 to-[#FF3333]/10">
                  <plan.icon className="w-8 h-8 text-[#FF6B35]" />
                </div>
                <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                <CardDescription className="text-base">{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      )}
                      <span className={feature.included ? "" : "text-muted-foreground"}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter className="pt-6">
                <Button
                  onClick={() => handleUpgrade(plan.name)}
                  variant={plan.buttonVariant}
                  className="w-full"
                  disabled={plan.name === "Free" && user?.subscriptionTier === "free"}
                  data-testid={`button-upgrade-${plan.name.toLowerCase()}`}
                >
                  {plan.buttonText}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-16 text-center"
      >
        <div className="bg-gradient-to-r from-[#FF6B35]/10 to-[#FF3333]/10 rounded-lg p-8 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">All Plans Include</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-[#FF6B35] to-[#FF3333] rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-1">Secure & Private</h3>
              <p className="text-sm text-muted-foreground">Your data is encrypted and never shared</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-[#FF6B35] to-[#FF3333] rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-1">Cancel Anytime</h3>
              <p className="text-sm text-muted-foreground">No contracts or hidden fees</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-[#FF6B35] to-[#FF3333] rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-1">Regular Updates</h3>
              <p className="text-sm text-muted-foreground">New features added continuously</p>
            </div>
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}