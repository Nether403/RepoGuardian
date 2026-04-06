import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLoadingState } from '@/hooks/useLoadingState';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';

interface DataExportProps {
  adminToken: string;
}

export function DataExport({ adminToken }: DataExportProps) {
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [eventName, setEventName] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const { toast } = useToast();
  const { isLoading, setLoading, setSuccess, setError: setLoadingError } = useLoadingState();

  const handleExport = async () => {
    try {
      setLoading();

      // Calculate date range
      let start: Date;
      let end: Date;

      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        end = new Date();
        start = new Date();
        
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
          case '90d':
            start.setDate(start.getDate() - 90);
            break;
        }
      }

      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        format,
      });

      if (eventName.trim()) {
        params.append('eventName', eventName.trim());
      }

      if (category.trim()) {
        params.append('category', category.trim());
      }

      const response = await fetch(
        `/api/admin/export?${params.toString()}`,
        {
          headers: {
            'x-admin-token': adminToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      // Get the filename from Content-Disposition header or create one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `analytics-export-${Date.now()}.${format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export Successful',
        description: `Data exported as ${filename}`,
      });
    } catch (err) {
      toast({
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSuccess();
    }
  };

  const handleClearFilters = () => {
    setEventName('');
    setCategory('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Export</CardTitle>
        <CardDescription>
          Export analytics data in CSV or JSON format
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Format */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card 
            className={`cursor-pointer transition-all ${format === 'json' ? 'border-blue-500 bg-blue-50' : ''}`}
            onClick={() => setFormat('json')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <FileJson className="h-8 w-8 text-blue-500" />
              <div>
                <h3 className="font-semibold">JSON Format</h3>
                <p className="text-sm text-muted-foreground">
                  Structured data with full event properties
                </p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all ${format === 'csv' ? 'border-green-500 bg-green-50' : ''}`}
            onClick={() => setFormat('csv')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <FileSpreadsheet className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold">CSV Format</h3>
                <p className="text-sm text-muted-foreground">
                  Spreadsheet-compatible tabular data
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Date Range Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Date Range</h3>
          
          <div className="space-y-2">
            <Label htmlFor="export-time-range">Quick Select</Label>
            <Select 
              value={timeRange} 
              onValueChange={setTimeRange}
              disabled={!!(startDate && endDate)}
            >
              <SelectTrigger id="export-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            or
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="export-start-date">Start Date</Label>
              <Input
                id="export-start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="export-end-date">End Date</Label>
              <Input
                id="export-end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Filters (Optional)</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="export-event-name">Event Name</Label>
              <Input
                id="export-event-name"
                placeholder="Filter by event..."
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="export-category">Category</Label>
              <Input
                id="export-category"
                placeholder="Filter by category..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          {(eventName || category) && (
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          )}
        </div>

        {/* Export Button */}
        <div className="pt-4 border-t">
          <Button 
            onClick={handleExport} 
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            <Download className="h-5 w-5 mr-2" />
            {isLoading ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
          </Button>
        </div>

        {/* Export Info */}
        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">Export Information</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Exports include all event data within the selected date range</li>
            <li>• JSON format includes full event properties and metadata</li>
            <li>• CSV format provides a simplified tabular view</li>
            <li>• Large exports may take a few moments to generate</li>
            <li>• Filters help reduce export size for specific analysis</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
