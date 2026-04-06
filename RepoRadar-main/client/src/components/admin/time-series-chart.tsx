import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLoadingState } from '@/hooks/useLoadingState';
import { SkeletonLoader } from '@/components/skeleton-loader';
import { RefreshCw } from 'lucide-react';

interface TimeSeriesData {
  timestamp: string;
  period: {
    start: string;
    end: string;
    interval: string;
  };
  filters: {
    eventName: string | null;
    category: string | null;
  };
  summary: {
    totalEvents: number;
    uniqueSessions: number;
    uniqueUsers: number;
  };
  timeSeries: Array<{
    period: string;
    count: number;
    uniqueSessions: number;
    uniqueUsers: number;
  }>;
}

interface TimeSeriesChartProps {
  adminToken: string;
}

export function TimeSeriesChart({ adminToken }: TimeSeriesChartProps) {
  const [data, setData] = useState<TimeSeriesData | null>(null);
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [interval, setInterval] = useState<string>('hour');
  const [eventName, setEventName] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const { isLoading, setLoading, setSuccess, setError: setLoadingError } = useLoadingState();
  const [error, setError] = useState<string | null>(null);

  const fetchTimeSeries = async () => {
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

      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        interval,
      });

      if (eventName.trim()) {
        params.append('eventName', eventName.trim());
      }

      if (category.trim()) {
        params.append('category', category.trim());
      }

      const response = await fetch(
        `/api/admin/analytics/time-series?${params.toString()}`,
        {
          headers: {
            'x-admin-token': adminToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch time series data');
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
    fetchTimeSeries();
  }, [adminToken, timeRange, interval]);

  const formatXAxis = (value: string) => {
    const date = new Date(value);
    
    switch (interval) {
      case 'hour':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case 'day':
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      case 'week':
      case 'month':
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      default:
        return date.toLocaleString();
    }
  };

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics Time Series</CardTitle>
          <CardDescription>Event trends over time</CardDescription>
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
          <CardTitle>Analytics Time Series</CardTitle>
          <CardDescription>Event trends over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analytics Time Series</CardTitle>
        <CardDescription>
          Event trends over time with customizable filters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="time-range">Time Range</Label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger id="time-range">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">Interval</Label>
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger id="interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Hourly</SelectItem>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-name">Event Name</Label>
            <Input
              id="event-name"
              placeholder="Filter by event..."
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="Filter by category..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={fetchTimeSeries} disabled={isLoading} className="w-full">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Apply Filters'}
        </Button>

        {data && (
          <>
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{data.summary.totalEvents.toLocaleString()}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Unique Sessions</p>
                <p className="text-2xl font-bold">{data.summary.uniqueSessions.toLocaleString()}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Unique Users</p>
                <p className="text-2xl font-bold">{data.summary.uniqueUsers.toLocaleString()}</p>
              </div>
            </div>

            {/* Active Filters */}
            {(data.filters.eventName || data.filters.category) && (
              <div className="flex gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Active Filters:</span>
                {data.filters.eventName && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    Event: {data.filters.eventName}
                  </span>
                )}
                {data.filters.category && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                    Category: {data.filters.category}
                  </span>
                )}
              </div>
            )}

            {/* Time Series Chart */}
            {data.timeSeries.length > 0 ? (
              <div>
                <h3 className="text-lg font-semibold mb-4">Event Trends</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={data.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="period" 
                      tickFormatter={formatXAxis}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      name="Total Events"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="uniqueSessions" 
                      stroke="#8b5cf6" 
                      name="Unique Sessions"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="uniqueUsers" 
                      stroke="#10b981" 
                      name="Unique Users"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No data available for the selected filters
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
