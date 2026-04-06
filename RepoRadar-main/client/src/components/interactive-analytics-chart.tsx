import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Area,
  AreaChart
} from 'recharts';
import { TrendingUp, BarChart3, Radar as RadarIcon, Calendar } from 'lucide-react';

interface AnalysisData {
  id: string;
  repositoryName: string;
  originality: number;
  completeness: number;
  marketability: number;
  monetization: number;
  usefulness: number;
  overallScore: number;
  createdAt: string;
}

interface InteractiveAnalyticsChartProps {
  data: AnalysisData[];
  title?: string;
}

export default function InteractiveAnalyticsChart({ 
  data, 
  title = "Repository Analysis Overview" 
}: InteractiveAnalyticsChartProps) {
  const [chartType, setChartType] = useState<'radar' | 'line' | 'bar' | 'area'>('radar');
  const [selectedMetric, setSelectedMetric] = useState<string>('overallScore');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Filter data based on time range
  const filteredData = useMemo(() => {
    if (timeRange === 'all') return data;
    
    const now = new Date();
    const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    return data.filter(item => new Date(item.createdAt) >= cutoff);
  }, [data, timeRange]);

  // Prepare radar chart data
  const radarData = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    const avgData = filteredData.reduce((acc, curr) => ({
      originality: acc.originality + curr.originality,
      completeness: acc.completeness + curr.completeness,
      marketability: acc.marketability + curr.marketability,
      monetization: acc.monetization + curr.monetization,
      usefulness: acc.usefulness + curr.usefulness,
    }), { originality: 0, completeness: 0, marketability: 0, monetization: 0, usefulness: 0 });

    const count = filteredData.length;
    return [
      { metric: 'Originality', value: avgData.originality / count, fullMark: 10 },
      { metric: 'Completeness', value: avgData.completeness / count, fullMark: 10 },
      { metric: 'Marketability', value: avgData.marketability / count, fullMark: 10 },
      { metric: 'Monetization', value: avgData.monetization / count, fullMark: 10 },
      { metric: 'Usefulness', value: avgData.usefulness / count, fullMark: 10 },
    ];
  }, [filteredData]);

  // Prepare trend data for line/area charts
  const trendData = useMemo(() => {
    return filteredData
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((item, index) => ({
        index: index + 1,
        date: new Date(item.createdAt).toLocaleDateString(),
        overallScore: item.overallScore,
        originality: item.originality,
        completeness: item.completeness,
        marketability: item.marketability,
        monetization: item.monetization,
        usefulness: item.usefulness,
        name: item.repositoryName.slice(0, 20),
      }));
  }, [filteredData]);

  // Prepare bar chart data (top repositories)
  const topRepositories = useMemo(() => {
    return filteredData
      .sort((a, b) => b[selectedMetric as keyof AnalysisData] as number - (a[selectedMetric as keyof AnalysisData] as number))
      .slice(0, 10)
      .map(item => ({
        name: item.repositoryName.split('/').pop()?.slice(0, 15) || 'Unknown',
        fullName: item.repositoryName,
        value: item[selectedMetric as keyof AnalysisData] as number,
        originality: item.originality,
        completeness: item.completeness,
        marketability: item.marketability,
        monetization: item.monetization,
        usefulness: item.usefulness,
      }));
  }, [filteredData, selectedMetric]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-white">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey}: {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (chartType) {
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--foreground))' }} />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 10]} 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
              />
              <Radar
                name="Average Score"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        );
      
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="overallScore" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Overall Score"
              />
              <Line 
                type="monotone" 
                dataKey="originality" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={1}
                strokeDasharray="5 5"
                name="Originality"
              />
              <Line 
                type="monotone" 
                dataKey="marketability" 
                stroke="hsl(var(--accent))" 
                strokeWidth={1}
                strokeDasharray="5 5"
                name="Marketability"
              />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topRepositories} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="overallScore"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      
      default:
        return null;
    }
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {title}
          </CardTitle>
          
          <div className="flex flex-wrap gap-2">
            {/* Chart Type Controls */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={chartType === 'radar' ? 'default' : 'outline'}
                onClick={() => setChartType('radar')}
                className="h-8"
              >
                <RadarIcon className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant={chartType === 'line' ? 'default' : 'outline'}
                onClick={() => setChartType('line')}
                className="h-8"
              >
                <TrendingUp className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant={chartType === 'bar' ? 'default' : 'outline'}
                onClick={() => setChartType('bar')}
                className="h-8"
              >
                <BarChart3 className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant={chartType === 'area' ? 'default' : 'outline'}
                onClick={() => setChartType('area')}
                className="h-8"
              >
                <Calendar className="w-3 h-3" />
              </Button>
            </div>

            {/* Time Range Controls */}
            <div className="flex gap-1">
              {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                <Button
                  key={range}
                  size="sm"
                  variant={timeRange === range ? 'default' : 'outline'}
                  onClick={() => setTimeRange(range)}
                  className="h-8 px-2"
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {filteredData.length} repositories analyzed
          </Badge>
          {filteredData.length > 0 && (
            <>
              <Badge variant="secondary">
                Avg Score: {(filteredData.reduce((sum, item) => sum + item.overallScore, 0) / filteredData.length).toFixed(1)}
              </Badge>
              <Badge variant="secondary">
                Best: {Math.max(...filteredData.map(item => item.overallScore)).toFixed(1)}
              </Badge>
            </>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No data available for the selected time range</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {chartType === 'bar' && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-400">Metric:</span>
                {(['overallScore', 'originality', 'completeness', 'marketability', 'monetization', 'usefulness'] as const).map((metric) => (
                  <Button
                    key={metric}
                    size="sm"
                    variant={selectedMetric === metric ? 'default' : 'outline'}
                    onClick={() => setSelectedMetric(metric)}
                    className="h-6 px-2 text-xs"
                  >
                    {metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Button>
                ))}
              </div>
            )}
            
            {renderChart()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}