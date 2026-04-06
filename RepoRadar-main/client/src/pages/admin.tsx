import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { HealthMetrics } from '@/components/admin/health-metrics';
import { SystemMetrics } from '@/components/admin/system-metrics';
import { UserActivity } from '@/components/admin/user-activity';
import { TimeSeriesChart } from '@/components/admin/time-series-chart';
import { LogViewer } from '@/components/admin/log-viewer';
import { DataExport } from '@/components/admin/data-export';
import { FeatureFlagsAdmin } from '@/components/admin/feature-flags';
import { useLoadingState } from '@/hooks/useLoadingState';
import { SkeletonLoader } from '@/components/skeleton-loader';

export default function AdminDashboard() {
  const [adminToken, setAdminToken] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const { toast } = useToast();
  const { isLoading, setLoading, setSuccess, setError: setLoadingError } = useLoadingState();

  // Check if admin token is stored in localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token');
    if (storedToken) {
      setAdminToken(storedToken);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async () => {
    if (!adminToken.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an admin token',
        variant: 'destructive',
      });
      return;
    }

    setLoading();
    try {
      // Test the token by making a request to the health metrics endpoint
      const response = await fetch('/api/admin/health-metrics', {
        headers: {
          'x-admin-token': adminToken,
        },
      });

      if (response.ok) {
        localStorage.setItem('admin_token', adminToken);
        setIsAuthenticated(true);
        toast({
          title: 'Success',
          description: 'Successfully authenticated as admin',
        });
      } else {
        toast({
          title: 'Authentication Failed',
          description: 'Invalid admin token',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to authenticate',
        variant: 'destructive',
      });
    } finally {
      setSuccess();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setAdminToken('');
    setIsAuthenticated(false);
    toast({
      title: 'Logged Out',
      description: 'Successfully logged out from admin dashboard',
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Admin Dashboard Login</CardTitle>
            <CardDescription>
              Enter your admin token to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-token">Admin Token</Label>
              <Input
                id="admin-token"
                type="password"
                placeholder="Enter admin token"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLogin();
                  }
                }}
              />
            </div>
            <Button 
              onClick={handleLogin} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Authenticating...' : 'Login'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor system health, user activity, and analytics
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="flags">Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <HealthMetrics adminToken={adminToken} />
          <div className="grid gap-6 md:grid-cols-2">
            <SystemMetrics adminToken={adminToken} compact />
            <UserActivity adminToken={adminToken} compact />
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <SystemMetrics adminToken={adminToken} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserActivity adminToken={adminToken} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <TimeSeriesChart adminToken={adminToken} />
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <LogViewer adminToken={adminToken} />
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <DataExport adminToken={adminToken} />
        </TabsContent>

        <TabsContent value="flags" className="space-y-6">
          <FeatureFlagsAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}
