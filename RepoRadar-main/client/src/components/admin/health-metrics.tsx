import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useLoadingState } from '@/hooks/useLoadingState';
import { SkeletonLoader } from '@/components/skeleton-loader';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'up' | 'down' | 'not_implemented';
  responseTime: number;
  details?: string;
}

interface HealthMetricsData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: HealthCheck;
    cache: HealthCheck;
    api: HealthCheck;
  };
}

interface HealthMetricsProps {
  adminToken: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function HealthMetrics({ 
  adminToken, 
  autoRefresh = true, 
  refreshInterval = 30000 
}: HealthMetricsProps) {
  const [data, setData] = useState<HealthMetricsData | null>(null);
  const { isLoading, setLoading, setSuccess, setError: setLoadingError } = useLoadingState();
  const [error, setError] = useState<string | null>(null);

  const fetchHealthMetrics = async () => {
    try {
      setLoading();
      setError(null);
      
      const response = await fetch('/api/admin/health-metrics', {
        headers: {
          'x-admin-token': adminToken,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch health metrics');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoadingError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setSuccess();
    }
  };

  useEffect(() => {
    fetchHealthMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchHealthMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [adminToken, autoRefresh, refreshInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
      case 'not_implemented':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return <Badge className="bg-green-500">Healthy</Badge>;
      case 'degraded':
      case 'not_implemented':
        return <Badge className="bg-yellow-500">Degraded</Badge>;
      case 'unhealthy':
      case 'down':
        return <Badge variant="destructive">Unhealthy</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Real-time system health status</CardDescription>
        </CardHeader>
        <CardContent>
          <SkeletonLoader variant="card" count={3} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Real-time system health status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>System Health</CardTitle>
            <CardDescription>
              Real-time system health status • Last updated: {new Date(data.timestamp).toLocaleTimeString()}
            </CardDescription>
          </div>
          {getStatusBadge(data.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Database Health */}
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            {getStatusIcon(data.checks.database.status)}
            <div className="flex-1">
              <h3 className="font-semibold">Database</h3>
              <p className="text-sm text-muted-foreground">
                Response: {data.checks.database.responseTime}ms
              </p>
              {data.checks.database.details && (
                <p className="text-xs text-muted-foreground mt-1">
                  {data.checks.database.details}
                </p>
              )}
            </div>
          </div>

          {/* Cache Health */}
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            {getStatusIcon(data.checks.cache.status)}
            <div className="flex-1">
              <h3 className="font-semibold">Cache</h3>
              <p className="text-sm text-muted-foreground">
                Response: {data.checks.cache.responseTime}ms
              </p>
              {data.checks.cache.details && (
                <p className="text-xs text-muted-foreground mt-1">
                  {data.checks.cache.details}
                </p>
              )}
            </div>
          </div>

          {/* API Health */}
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            {getStatusIcon(data.checks.api.status)}
            <div className="flex-1">
              <h3 className="font-semibold">API</h3>
              <p className="text-sm text-muted-foreground">
                Response: {data.checks.api.responseTime}ms
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
