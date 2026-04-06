import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertCircle, 
  Download, 
  Receipt, 
  CheckCircle, 
  XCircle,
  Clock
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LoadingSkeleton } from "@/components/skeleton-loader";
import { useAuth } from "@/hooks/useAuth";

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  created: number;
  invoicePdf: string | null;
  hostedInvoiceUrl: string | null;
  periodStart: number;
  periodEnd: number;
}

export default function SubscriptionBilling() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: invoices, isLoading, error } = useQuery<Invoice[]>({
    queryKey: ['/api/subscription/invoices'],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-4xl mx-auto px-6">
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Billing History</h2>
            <p className="text-muted-foreground mb-6">
              Sign in to view your billing history
            </p>
            <Button asChild>
              <a href="/api/login">Sign In</a>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-8">
            <div className="h-10 w-64 bg-gray-700 rounded animate-pulse mb-4"></div>
            <div className="h-4 w-96 bg-gray-700 rounded animate-pulse"></div>
          </div>
          <LoadingSkeleton variant="table" count={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-4xl mx-auto px-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load billing history. Please try again later.
            </AlertDescription>
          </Alert>
          <Button onClick={() => setLocation('/subscription')} className="mt-4">
            Back to Subscription
          </Button>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'open':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'void':
      case 'uncollectible':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Receipt className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: Invoice['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-4">
            Billing History
          </h1>
          <p className="text-muted-foreground">
            View and download your past invoices
          </p>
        </div>

        {/* Back Button */}
        <Button 
          variant="outline" 
          onClick={() => setLocation('/subscription')}
          className="mb-6"
        >
          Back to Subscription
        </Button>

        {/* Invoices */}
        {!invoices || invoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Invoices Yet</h3>
              <p className="text-muted-foreground">
                Your billing history will appear here once you have a paid subscription.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Invoices
              </CardTitle>
              <CardDescription>
                All your past invoices and payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(invoice.status)}
                        <span className="text-sm font-medium">
                          {getStatusText(invoice.status)}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <div className="font-medium">
                          {formatAmount(invoice.amount, invoice.currency)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        {formatDate(invoice.created)}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {invoice.hostedInvoiceUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </a>
                        </Button>
                      )}
                      {invoice.invoicePdf && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={invoice.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            <Download className="w-4 h-4 mr-2" />
                            PDF
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you have questions about your billing or need assistance, please contact our support team.
            </p>
            <Button variant="outline" asChild>
              <a href="mailto:support@reporadar.com">
                Contact Support
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
