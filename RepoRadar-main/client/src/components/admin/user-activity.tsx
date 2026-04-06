import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useLoadingState } from '@/hooks/useLoadingState';
import { SkeletonLoader } from '@/components/skeleton-loader';
import { Users, Activity, TrendingUp } from 'lucide-react';

interface UserActivityData {
  timestamp: string;
  period: {
    start: string;
    end: string;
  };
  activity: {
    activeSessions: number;
    uniqueUsers: number;
    avgEventsPerSession: number;
  };
  features: Array<{
    name: string;
    usage: number;
  }>;
  categories: Array<{
    name: string;
    usage: number;
  }>;
  sessions: Array<{
    sessionId: string;
    userId: string | null;
    firstSeen: string;
    lastSeen: string;
    eventCount: number;
  }>;
}

interface UserActivityProps {
  adminToken: string;
  compact?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1'];

export function UserActivity({ 
  adminToken, 
  compact = false,
  autoRefresh = true,
  refreshInterval = 30000 
}: UserActivityProps) {
  const [data, setData] = useState<UserActivityData | null>(null);
  const [timeRange, setTimeRange] = useState<string>('24h');
  const { isLoading, setLoading, setSuccess, setError: setLoadingError } = useLoadingState();
  const [error, setError] = useState<string | null>(null);

  const fetchUserActivity = async () => {
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
        `/api/admin/user-activity?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
        {
          headers: {
            'x-admin-token': adminToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user activity');
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
    fetchUserActivity();

    if (autoRefresh) {
      const interval = setInterval(fetchUserActivity, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [adminToken, timeRange, autoRefresh, refreshInterval]);

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Activity</CardTitle>
          <CardDescription>Active users and feature usage</CardDescription>
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
          <CardTitle>User Activity</CardTitle>
          <CardDescription>Active users and feature usage</CardDescription>
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

  const topFeatures = data.features.slice(0, compact ? 5 : 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>User Activity</CardTitle>
            <CardDescription>
              Active users and feature usage
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
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <Users className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Active Sessions</p>
              <p className="text-2xl font-bold">{data.activity.activeSessions}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <Activity className="h-5 w-5 text-purple-500 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Unique Users</p>
              <p className="text-2xl font-bold">{data.activity.uniqueUsers}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Avg Events/Session</p>
              <p className="text-2xl font-bold">{data.activity.avgEventsPerSession}</p>
            </div>
          </div>
        </div>

        {/* Feature Usage Chart */}
        {!compact && topFeatures.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Top Features</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topFeatures}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="usage" fill="#3b82f6" name="Usage Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category Distribution */}
        {!compact && data.categories.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold mb-4">Event Categories</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.categories}
                    dataKey="usage"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => entry.name}
                  >
                    {data.categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
              <div className="space-y-3">
                {data.categories.map((category, index) => (
                  <div key={category.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{category.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{category.usage}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Sessions */}
        {!compact && data.sessions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Recent Sessions</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Session ID</th>
                    <th className="text-left p-3 text-sm font-medium">User ID</th>
                    <th className="text-left p-3 text-sm font-medium">First Seen</th>
                    <th className="text-left p-3 text-sm font-medium">Last Seen</th>
                    <th className="text-right p-3 text-sm font-medium">Events</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.slice(0, 10).map((session) => (
                    <tr key={session.sessionId} className="border-t">
                      <td className="p-3 text-sm font-mono text-xs">
                        {session.sessionId.substring(0, 8)}...
                      </td>
                      <td className="p-3 text-sm">
                        {session.userId ? (
                          <span className="font-mono text-xs">{session.userId.substring(0, 8)}...</span>
                        ) : (
                          <span className="text-muted-foreground">Anonymous</span>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        {new Date(session.firstSeen).toLocaleString()}
                      </td>
                      <td className="p-3 text-sm">
                        {new Date(session.lastSeen).toLocaleString()}
                      </td>
                      <td className="p-3 text-sm text-right font-medium">
                        {session.eventCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Compact View - Top Features List */}
        {compact && topFeatures.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3">Top Features</h3>
            <div className="space-y-2">
              {topFeatures.map((feature) => (
                <div key={feature.name} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{feature.name}</span>
                  <span className="font-medium">{feature.usage}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
