import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLoadingState } from '@/hooks/useLoadingState';
import { SkeletonLoader } from '@/components/skeleton-loader';
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface LogEntry {
  id: string;
  eventName: string;
  eventCategory: string;
  properties: Record<string, unknown> | null;
  userId: string | null;
  sessionId: string;
  timestamp: string;
}

interface LogViewerData {
  timestamp: string;
  period: {
    start: string;
    end: string;
  };
  filters: {
    eventName: string | null;
    category: string | null;
    userId: string | null;
    sessionId: string | null;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  logs: LogEntry[];
}

interface LogViewerProps {
  adminToken: string;
}

export function LogViewer({ adminToken }: LogViewerProps) {
  const [data, setData] = useState<LogViewerData | null>(null);
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [eventName, setEventName] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [limit] = useState<number>(50);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const { isLoading, setLoading, setSuccess, setError: setLoadingError } = useLoadingState();
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
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
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });

      if (eventName.trim()) {
        params.append('eventName', eventName.trim());
      }

      if (category.trim()) {
        params.append('category', category.trim());
      }

      if (userId.trim()) {
        params.append('userId', userId.trim());
      }

      if (sessionId.trim()) {
        params.append('sessionId', sessionId.trim());
      }

      const response = await fetch(
        `/api/admin/logs?${params.toString()}`,
        {
          headers: {
            'x-admin-token': adminToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
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
    fetchLogs();
  }, [adminToken, timeRange, page]);

  const handleSearch = () => {
    setPage(0);
    fetchLogs();
  };

  const handleClearFilters = () => {
    setEventName('');
    setCategory('');
    setUserId('');
    setSessionId('');
    setPage(0);
  };

  const totalPages = data ? Math.ceil(data.pagination.total / data.pagination.limit) : 0;

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Log Viewer</CardTitle>
          <CardDescription>Search and filter analytics events</CardDescription>
        </CardHeader>
        <CardContent>
          <SkeletonLoader variant="table" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Log Viewer</CardTitle>
          <CardDescription>Search and filter analytics events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Log Viewer</CardTitle>
          <CardDescription>
            Search and filter analytics events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="log-time-range">Time Range</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger id="log-time-range">
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
              <Label htmlFor="log-event-name">Event Name</Label>
              <Input
                id="log-event-name"
                placeholder="Filter by event..."
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-category">Category</Label>
              <Input
                id="log-category"
                placeholder="Filter by category..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-user-id">User ID</Label>
              <Input
                id="log-user-id"
                placeholder="Filter by user..."
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-session-id">Session ID</Label>
              <Input
                id="log-session-id"
                placeholder="Filter by session..."
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={isLoading} className="flex-1">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button onClick={handleClearFilters} variant="outline">
              Clear Filters
            </Button>
            <Button onClick={fetchLogs} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Results Summary */}
          {data && (
            <div className="text-sm text-muted-foreground">
              Showing {data.pagination.offset + 1} - {Math.min(data.pagination.offset + data.pagination.limit, data.pagination.total)} of {data.pagination.total} logs
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Table */}
      {data && data.logs.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Timestamp</th>
                    <th className="text-left p-3 text-sm font-medium">Event</th>
                    <th className="text-left p-3 text-sm font-medium">Category</th>
                    <th className="text-left p-3 text-sm font-medium">Session</th>
                    <th className="text-left p-3 text-sm font-medium">User</th>
                    <th className="text-left p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr key={log.id} className="border-t hover:bg-muted/50">
                      <td className="p-3 text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 text-sm font-medium">{log.eventName}</td>
                      <td className="p-3 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {log.eventCategory}
                        </span>
                      </td>
                      <td className="p-3 text-sm font-mono text-xs">
                        {log.sessionId.substring(0, 8)}...
                      </td>
                      <td className="p-3 text-sm">
                        {log.userId ? (
                          <span className="font-mono text-xs">{log.userId.substring(0, 8)}...</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 0 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages - 1 || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {data && data.logs.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No logs found matching your filters
          </CardContent>
        </Card>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <Card className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl z-50 shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Log Details</CardTitle>
                <CardDescription>{selectedLog.eventName}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Event ID</Label>
                <p className="font-mono text-sm">{selectedLog.id}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Event Name</Label>
                <p className="text-sm font-medium">{selectedLog.eventName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <p className="text-sm">{selectedLog.eventCategory}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Timestamp</Label>
                <p className="text-sm">{new Date(selectedLog.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Session ID</Label>
                <p className="font-mono text-sm">{selectedLog.sessionId}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">User ID</Label>
                <p className="font-mono text-sm">{selectedLog.userId || 'Anonymous'}</p>
              </div>
              {selectedLog.properties && Object.keys(selectedLog.properties).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Properties</Label>
                  <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(selectedLog.properties, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overlay for modal */}
      {selectedLog && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
