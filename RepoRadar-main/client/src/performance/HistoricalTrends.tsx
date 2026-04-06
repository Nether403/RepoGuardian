import React, { useState, useEffect } from 'react';

interface TrendData {
  trend: 'improving' | 'stable' | 'degrading';
  changePercent: number;
  confidence: number;
}

interface TrendsData {
  database: TrendData;
  api: TrendData;
  frontend: TrendData;
}

/**
 * Historical trends component showing performance trend analysis
 */
export const HistoricalTrends: React.FC = () => {
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    fetchTrendsData();
  }, [timeRange]);

  const fetchTrendsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/performance/dashboard/trends?range=${timeRange}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setTrendsData(data);
    } catch (error) {
      console.error('Failed to fetch trends data:', error);
      // Fallback data for demo
      setTrendsData({
        database: { trend: 'stable', changePercent: 0, confidence: 0.8 },
        api: { trend: 'improving', changePercent: -5, confidence: 0.9 },
        frontend: { trend: 'degrading', changePercent: 10, confidence: 0.7 }
      });
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return (
          <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'degrading':
        return (
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        );
    }
  };

  const getTrendColor = (trend: string): string => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'degrading': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendBgColor = (trend: string): string => {
    switch (trend) {
      case 'improving': return 'bg-green-50 border-green-200';
      case 'degrading': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatChangePercent = (changePercent: number): string => {
    const abs = Math.abs(changePercent);
    const sign = changePercent > 0 ? '+' : changePercent < 0 ? '-' : '';
    return `${sign}${abs.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Performance Trends</h3>
        
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as '24h' | '7d' | '30d')}
          className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {trendsData && (
        <div className="space-y-4">
          {/* Database Trend */}
          <div className={`border rounded-lg p-4 ${getTrendBgColor(trendsData.database.trend)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getTrendIcon(trendsData.database.trend)}
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Database Performance</h4>
                  <p className="text-xs text-gray-600">Response time trend</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${getTrendColor(trendsData.database.trend)}`}>
                  {formatChangePercent(trendsData.database.changePercent)}
                </div>
                <div className={`text-xs ${getConfidenceColor(trendsData.database.confidence)}`}>
                  {Math.round(trendsData.database.confidence * 100)}% confidence
                </div>
              </div>
            </div>
            <div className="mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                trendsData.database.trend === 'improving' ? 'bg-green-100 text-green-800' :
                trendsData.database.trend === 'degrading' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {trendsData.database.trend.toUpperCase()}
              </span>
            </div>
          </div>

          {/* API Trend */}
          <div className={`border rounded-lg p-4 ${getTrendBgColor(trendsData.api.trend)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getTrendIcon(trendsData.api.trend)}
                <div>
                  <h4 className="text-sm font-medium text-gray-900">API Performance</h4>
                  <p className="text-xs text-gray-600">Response time trend</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${getTrendColor(trendsData.api.trend)}`}>
                  {formatChangePercent(trendsData.api.changePercent)}
                </div>
                <div className={`text-xs ${getConfidenceColor(trendsData.api.confidence)}`}>
                  {Math.round(trendsData.api.confidence * 100)}% confidence
                </div>
              </div>
            </div>
            <div className="mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                trendsData.api.trend === 'improving' ? 'bg-green-100 text-green-800' :
                trendsData.api.trend === 'degrading' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {trendsData.api.trend.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Frontend Trend */}
          <div className={`border rounded-lg p-4 ${getTrendBgColor(trendsData.frontend.trend)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getTrendIcon(trendsData.frontend.trend)}
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Frontend Performance</h4>
                  <p className="text-xs text-gray-600">Load time trend</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${getTrendColor(trendsData.frontend.trend)}`}>
                  {formatChangePercent(trendsData.frontend.changePercent)}
                </div>
                <div className={`text-xs ${getConfidenceColor(trendsData.frontend.confidence)}`}>
                  {Math.round(trendsData.frontend.confidence * 100)}% confidence
                </div>
              </div>
            </div>
            <div className="mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                trendsData.frontend.trend === 'improving' ? 'bg-green-100 text-green-800' :
                trendsData.frontend.trend === 'degrading' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {trendsData.frontend.trend.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Trends are calculated using linear regression analysis over the selected time period.
          Higher confidence indicates more reliable trend predictions.
        </p>
      </div>
    </div>
  );
};
