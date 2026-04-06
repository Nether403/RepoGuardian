import React, { useState, useEffect } from 'react';

interface ChartDataPoint {
  timestamp: string;
  value: number;
  count: number;
}

interface ChartData {
  database: ChartDataPoint[];
  api: ChartDataPoint[];
  frontend: ChartDataPoint[];
}

/**
 * Real-time performance chart component
 */
export const PerformanceChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData>({ database: [], api: [], frontend: [] });
  const [selectedMetric, setSelectedMetric] = useState<'database' | 'api' | 'frontend'>('database');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChartData();
    const interval = setInterval(fetchChartData, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchChartData = async () => {
    try {
      const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 168;
      const response = await fetch(`/api/performance/dashboard/historical?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setChartData(data.data || { database: [], api: [], frontend: [] });
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMaxValue = (data: ChartDataPoint[]): number => {
    return Math.max(...data.map(d => d.value), 0);
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    if (timeRange === '1h' || timeRange === '6h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderChart = (data: ChartDataPoint[], color: string) => {
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No data available
        </div>
      );
    }

    const maxValue = getMaxValue(data);
    const width = 100 / Math.max(data.length - 1, 1);

    return (
      <div className="relative h-64">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
          <span>{Math.round(maxValue)}ms</span>
          <span>{Math.round(maxValue * 0.75)}ms</span>
          <span>{Math.round(maxValue * 0.5)}ms</span>
          <span>{Math.round(maxValue * 0.25)}ms</span>
          <span>0ms</span>
        </div>

        {/* Chart area */}
        <div className="ml-12 h-full relative">
          {/* Grid lines */}
          <div className="absolute inset-0">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <div
                key={ratio}
                className="absolute w-full border-t border-gray-200"
                style={{ top: `${ratio * 100}%` }}
              />
            ))}
          </div>

          {/* Chart line */}
          <svg className="absolute inset-0 w-full h-full">
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2"
              points={data.map((point, index) => {
                const x = (index / Math.max(data.length - 1, 1)) * 100;
                const y = 100 - (point.value / maxValue) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
            />
            {/* Data points */}
            {data.map((point, index) => {
              const x = (index / Math.max(data.length - 1, 1)) * 100;
              const y = 100 - (point.value / maxValue) * 100;
              return (
                <circle
                  key={index}
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="3"
                  fill={color}
                  className="hover:r-4 transition-all cursor-pointer"
                  title={`${point.value}ms at ${formatTimestamp(point.timestamp)}`}
                />
              );
            })}
          </svg>

          {/* X-axis labels */}
          <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-gray-500">
            {data.filter((_, index) => index % Math.ceil(data.length / 5) === 0).map((point, index) => (
              <span key={index}>{formatTimestamp(point.timestamp)}</span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const getMetricColor = (metric: string): string => {
    switch (metric) {
      case 'database': return '#3B82F6'; // Blue
      case 'api': return '#10B981'; // Green
      case 'frontend': return '#F59E0B'; // Yellow
      default: return '#6B7280'; // Gray
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Performance Trends</h3>
        
        <div className="flex space-x-4">
          {/* Metric selector */}
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as 'database' | 'api' | 'frontend')}
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          >
            <option value="database">Database</option>
            <option value="api">API</option>
            <option value="frontend">Frontend</option>
          </select>

          {/* Time range selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '1h' | '6h' | '24h' | '7d')}
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-4">
        {renderChart(chartData[selectedMetric], getMetricColor(selectedMetric))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center">
          <div 
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: getMetricColor(selectedMetric) }}
          ></div>
          <span className="text-gray-700 capitalize">{selectedMetric} Response Time</span>
        </div>
      </div>
    </div>
  );
};
