import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLoadingState } from '@/hooks/useLoadingState';
import { SkeletonLoader } from '@/components/skeleton-loader';
import { Activity, Cpu, HardDrive, Clock } from 'lucide-react';

interface SystemMetricsData {
  timestamp: string;
  period: {
    start: string;
    end: string;
  };
  metrics: {
    errorRate: number;
    totalEvents: number;
    errorEvents: number;
    errorsByHour: Array<{
      hour: string;
      count: number;
    }>;
  };
  resources: {
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    cpu: {
      user: number;
      system: number;
    };
    uptime: number;
  };
}

interface SystemMetricsProps {
  adminToken: string;
  compact?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function SystemMetrics({ 
  adminToken, 
  compact = false,
  autoRefresh = true,
  refreshInterval = 30000 
}: SystemMetricsProps) {
  const [data, setData] = useState<SystemMetricsData | null>(null);
  const [timeRange, setTimeRange] = useState<string>('24h');
  const { isLoading, setLoading, setSuccess, setError: setLoadingError } = useLoadingState();
  const [error, setError] = useState<string | null>(null);

  const fetchSystemMetrics = async () => {
    try {
      setLoading();
      setError(null);

      // Calculate date range based on selection
      const end = new Date();
      const start = new Date();
      
      switch (timeRange) {
        case '1h':
          start.setHours(start.getHours() - 1);
          break;
        case '6h':
          start.setHours(start.getHours() - 6);
          break;
        case '24h':
          start.setHours(start.getHours() - 24);
          break;
        case '7d':
          start.setDate(start.getDate() - 7);
          break;
        case '30d':
          start.setDate(start.getDate() - 30);
          break;
      }

      const response = await fetch(
        `/api/admin/system-metrics?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
        {
          headers: {
            'x-admin-token': adminToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch system metrics');
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
    fetchSystemMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchSystemMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [adminToken, timeRange, autoRefresh, refreshInterval]);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Metrics</CardTitle>
          <CardDescription>Performance and resource usage</CardDescription>
        </CardHeader>
        <CardContent>
          <SkeletonLoader variant="chart" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Metrics</CardTitle>
          <CardDescription>Performance and resource usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">{error}</div>
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
            <CardTitle>System Metrics</CardTitle>
            <CardDescription>
              Performance and resource usage
            </CardDescription>
          </div>
          {!compact && (
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <Activity className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Error Rate</p>
              <p className="text-2xl font-bold">{data.metrics.errorRate}%</p>
              <p className="text-xs text-muted-foreground">
                {data.metrics.errorEvents} / {data.metrics.totalEvents} events
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <HardDrive className="h-5 w-5 text-purple-500 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Memory Usage</p>
              <p className="text-2xl font-bold">{data.resources.memory.heapUsed}MB</p>
              <p className="text-xs text-muted-foreground">
                of {data.resources.memory.heapTotal}MB heap
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <Cpu className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">CPU Usage</p>
              <p className="text-2xl font-bold">
                {((data.resources.cpu.user + data.resources.cpu.system) / 1000000).toFixed(2)}s
              </p>
              <p className="text-xs text-muted-foreground">
                total CPU time
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="text-2xl font-bold">{formatUptime(data.resources.uptime)}</p>
              <p className="text-xs text-muted-foreground">
                since last restart
              </p>
            </div>
          </div>
        </div>

        {/* Error Rate Chart */}
        {!compact && data.metrics.errorsByHour.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Error Events Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.metrics.errorsByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#ef4444" 
                  name="Error Count"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Resource Details */}
        {!compact && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-3">Memory Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Heap Used:</span>
                  <span className="font-medium">{data.resources.memory.heapUsed} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Heap Total:</span>
                  <span className="font-medium">{data.resources.memory.heapTotal} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">External:</span>
                  <span className="font-medium">{data.resources.memory.external} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RSS:</span>
                  <span className="font-medium">{data.resources.memory.rss} MB</span>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-3">CPU Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User Time:</span>
                  <span className="font-medium">
                    {(data.resources.cpu.user / 1000000).toFixed(2)}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">System Time:</span>
                  <span className="font-medium">
                    {(data.resources.cpu.system / 1000000).toFixed(2)}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Time:</span>
                  <span className="font-medium">
                    {((data.resources.cpu.user + data.resources.cpu.system) / 1000000).toFixed(2)}s
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
