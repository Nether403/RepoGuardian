import React from 'react';

interface MetricsData {
  database: { avgResponseTime: number; status: string };
  api: { avgResponseTime: number; status: string };
  frontend: { avgLoadTime: number; status: string };
}

interface MetricsOverviewProps {
  data: MetricsData;
}

/**
 * Metrics overview component showing key performance indicators
 */
export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ data }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return (
          <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'critical':
        return (
          <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'good': return 'border-green-200 bg-green-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'critical': return 'border-red-200 bg-red-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getTextColor = (status: string): string => {
    switch (status) {
      case 'good': return 'text-green-800';
      case 'warning': return 'text-yellow-800';
      case 'critical': return 'text-red-800';
      default: return 'text-gray-800';
    }
  };

  const formatValue = (value: number, unit: string): string => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}s`;
    }
    return `${value}${unit}`;
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Database Metrics */}
        <div className={`bg-white rounded-lg border-2 ${getStatusColor(data.database.status)} p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Database Performance</h3>
              <div className="mt-2 flex items-baseline">
                <p className={`text-2xl font-semibold ${getTextColor(data.database.status)}`}>
                  {formatValue(data.database.avgResponseTime, 'ms')}
                </p>
                <p className="ml-2 text-sm text-gray-600">avg response time</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              {getStatusIcon(data.database.status)}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center text-sm">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                data.database.status === 'good' ? 'bg-green-100 text-green-800' :
                data.database.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {data.database.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* API Metrics */}
        <div className={`bg-white rounded-lg border-2 ${getStatusColor(data.api.status)} p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">API Performance</h3>
              <div className="mt-2 flex items-baseline">
                <p className={`text-2xl font-semibold ${getTextColor(data.api.status)}`}>
                  {formatValue(data.api.avgResponseTime, 'ms')}
                </p>
                <p className="ml-2 text-sm text-gray-600">avg response time</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              {getStatusIcon(data.api.status)}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center text-sm">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                data.api.status === 'good' ? 'bg-green-100 text-green-800' :
                data.api.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {data.api.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Frontend Metrics */}
        <div className={`bg-white rounded-lg border-2 ${getStatusColor(data.frontend.status)} p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Frontend Performance</h3>
              <div className="mt-2 flex items-baseline">
                <p className={`text-2xl font-semibold ${getTextColor(data.frontend.status)}`}>
                  {formatValue(data.frontend.avgLoadTime, 'ms')}
                </p>
                <p className="ml-2 text-sm text-gray-600">avg load time</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              {getStatusIcon(data.frontend.status)}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center text-sm">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                data.frontend.status === 'good' ? 'bg-green-100 text-green-800' :
                data.frontend.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {data.frontend.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
