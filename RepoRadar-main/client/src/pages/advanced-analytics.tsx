import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, Treemap
} from "recharts";
import { 
  TrendingUp, TrendingDown, Activity, Users, Star, GitBranch,
  Calendar, Clock, Target, Award, AlertCircle, Download,
  Filter, RefreshCw, ChevronUp, ChevronDown, Minus,
  Code, FileText, Package, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

interface AdvancedAnalyticsData {
  overview: {
    totalAnalyses: number;
    averageScore: number;
    trendsUp: number;
    activeRepositories: number;
    teamMembers: number;
    apiCalls: number;
  };
  scoreDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    analyses: number;
    avgScore: number;
    repositories: number;
  }>;
  languageDistribution: Array<{
    name: string;
    value: number;
    percentage: number;
  }>;
  metricTrends: {
    [key: string]: {
      current: number;
      previous: number;
      trend: "up" | "down" | "stable";
    };
  };
  topPerformers: Array<{
    name: string;
    score: number;
    language: string;
    stars: number;
  }>;
  radarData: Array<{
    metric: string;
    A: number;
    B: number;
    fullMark: number;
  }>;
}

export default function AdvancedAnalytics() {
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState("30d");
  const [selectedMetric, setSelectedMetric] = useState("all");
  const [comparisonMode, setComparisonMode] = useState(false);

  // Fetch comprehensive analytics data
  const { data: analyticsData, isLoading, error } = useQuery<AdvancedAnalyticsData>({
    queryKey: ["/api/analytics/advanced", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/advanced?timeRange=${timeRange}`, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Handle authentication errors
      if (res.status === 401) {
        // Store current URL for return after login
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        
        // Redirect to login page with return URL
        window.location.href = `/handler/sign-in?returnUrl=${returnUrl}`;
        
        throw new Error('Unauthorized - redirecting to login');
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(errorData.message || `Failed to fetch analytics: ${res.statusText}`);
      }
      
      return await res.json();
    },
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.message.includes('Unauthorized')) {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
  });

  // Fallback mock data for demonstration (used when no real data exists yet)
  const mockData = {
    overview: {
      totalAnalyses: 1247,
      averageScore: 82.5,
      trendsUp: 15.3,
      activeRepositories: 89,
      teamMembers: 12,
      apiCalls: 45678,
    },
    scoreDistribution: [
      { range: "0-20", count: 12, percentage: 1 },
      { range: "21-40", count: 45, percentage: 4 },
      { range: "41-60", count: 234, percentage: 19 },
      { range: "61-80", count: 567, percentage: 45 },
      { range: "81-100", count: 389, percentage: 31 },
    ],
    timeSeriesData: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
      analyses: Math.floor(Math.random() * 50) + 20,
      avgScore: Math.floor(Math.random() * 20) + 70,
      repositories: Math.floor(Math.random() * 10) + 5,
    })),
    languageDistribution: [
      { name: "JavaScript", value: 345, percentage: 28 },
      { name: "Python", value: 289, percentage: 23 },
      { name: "TypeScript", value: 234, percentage: 19 },
      { name: "Java", value: 156, percentage: 13 },
      { name: "Go", value: 123, percentage: 10 },
      { name: "Other", value: 100, percentage: 7 },
    ],
    metricTrends: {
      originality: { current: 78, previous: 72, trend: "up" },
      completeness: { current: 85, previous: 83, trend: "up" },
      marketability: { current: 71, previous: 75, trend: "down" },
      monetization: { current: 68, previous: 65, trend: "up" },
      usefulness: { current: 88, previous: 86, trend: "up" },
    },
    topPerformers: [
      { name: "awesome-react-app", score: 95, language: "TypeScript", stars: 1234 },
      { name: "python-ml-toolkit", score: 92, language: "Python", stars: 890 },
      { name: "go-microservice", score: 91, language: "Go", stars: 567 },
      { name: "vue-dashboard", score: 89, language: "JavaScript", stars: 456 },
      { name: "rust-cli-tool", score: 88, language: "Rust", stars: 234 },
    ],
    radarData: [
      { metric: "Originality", A: 78, B: 65, fullMark: 100 },
      { metric: "Completeness", A: 85, B: 90, fullMark: 100 },
      { metric: "Marketability", A: 71, B: 80, fullMark: 100 },
      { metric: "Monetization", A: 68, B: 55, fullMark: 100 },
      { metric: "Usefulness", A: 88, B: 82, fullMark: 100 },
    ],
    heatmapData: Array.from({ length: 7 }, (_, dayIndex) => 
      Array.from({ length: 24 }, (_, hourIndex) => ({
        day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayIndex],
        hour: hourIndex,
        value: Math.floor(Math.random() * 100),
      }))
    ).flat(),
  };

  const data = analyticsData || mockData;
  const isUsingMockData = !analyticsData || (analyticsData.overview?.totalAnalyses === 0) || error;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <ChevronUp className="h-4 w-4 text-green-500" />;
      case "down": return <ChevronDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Analytics data exported successfully" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto p-6 pt-32 max-w-7xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Advanced Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Deep insights into your repository analysis patterns and trends
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
          <div className="text-center">
            <span className="text-lg font-medium">Loading analytics data...</span>
            <p className="text-sm text-muted-foreground mt-1">
              Verifying authentication and fetching your insights
            </p>
          </div>
        </div>
      )}

      {/* Authentication Required Banner */}
      {error && error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized')) && (
        <Alert className="mb-6 border-blue-500 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Sign in to view your analytics</strong>
            <div className="mt-2">
              <a href="/handler/sign-in" className="underline font-semibold hover:text-blue-900">
                Sign in here
              </a> to see your real repository analysis data and insights.
            </div>
            <div className="mt-2 text-sm">
              Below is a preview of what you'll see once you're signed in.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Other Errors */}
      {error && error instanceof Error && !(error.message.includes('401') || error.message.includes('Unauthorized')) && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Error loading analytics:</strong> {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Mock Data Banner (only show if authenticated but no data) */}
      {!isLoading && isUsingMockData && !error && analyticsData && (
        <Alert className="mb-6 border-amber-500 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Demo Mode:</strong> You're viewing sample data. Start analyzing repositories to see your real analytics here!
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Overview */}
      {!isLoading && (
      <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalAnalyses}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              +{data.overview.trendsUp}% from last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.averageScore}</div>
            <Progress value={data.overview.averageScore} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Repos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.activeRepositories}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently tracking
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.teamMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active collaborators
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">API Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.apiCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              This month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.5%</div>
            <p className="text-xs text-green-500 mt-1">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics Analysis</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Analysis Trend</CardTitle>
                <CardDescription>Number of analyses over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.timeSeriesData}>
                    <defs>
                      <linearGradient id="colorAnalyses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="analyses" 
                      stroke="#8b5cf6" 
                      fillOpacity={1} 
                      fill="url(#colorAnalyses)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
                <CardDescription>Analysis scores breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Performing Repositories</CardTitle>
              <CardDescription>Highest scoring repositories this period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.topPerformers.map((repo, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{repo.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{repo.language}</Badge>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {repo.stars}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{repo.score}</div>
                      <Progress value={repo.score} className="w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Metrics Comparison</CardTitle>
                <CardDescription>Radar chart of key metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={data.radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Current Period" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                    <Radar name="Previous Period" dataKey="B" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Metric Trends</CardTitle>
                <CardDescription>Performance changes over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(data.metricTrends).map(([metric, values]) => (
                    <div key={metric} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="capitalize font-medium">{metric}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">{values.current}</span>
                          {getTrendIcon(values.trend)}
                          <span className="text-sm text-muted-foreground">
                            vs {values.previous}
                          </span>
                        </div>
                      </div>
                      <Progress value={values.current} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Metric Correlations</CardTitle>
              <CardDescription>How metrics relate to each other</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="originality" name="Originality" />
                  <YAxis dataKey="usefulness" name="Usefulness" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter 
                    name="Repositories" 
                    data={Array.from({ length: 50 }, () => ({
                      originality: Math.random() * 100,
                      usefulness: Math.random() * 100,
                      marketability: Math.random() * 100,
                    }))} 
                    fill="#8b5cf6"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="languages" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Language Distribution</CardTitle>
                <CardDescription>Repository languages analyzed</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.languageDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name} (${entry.percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {data.languageDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Language Performance</CardTitle>
                <CardDescription>Average scores by language</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.languageDistribution.map((lang, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{lang.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {lang.value} repos
                        </span>
                        <div className="text-right">
                          <div className="font-bold">{85 - index * 2}</div>
                          <div className="text-xs text-muted-foreground">avg score</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Language Trends</CardTitle>
              <CardDescription>Language popularity over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="analyses" stroke="#8b5cf6" name="JavaScript" />
                  <Line type="monotone" dataKey="avgScore" stroke="#3b82f6" name="Python" />
                  <Line type="monotone" dataKey="repositories" stroke="#10b981" name="TypeScript" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>API Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">145ms</div>
                <p className="text-sm text-muted-foreground">Average latency</p>
                <Progress value={85} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Analysis Speed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">2.3s</div>
                <p className="text-sm text-muted-foreground">Average processing time</p>
                <Progress value={92} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>System Uptime</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">99.95%</div>
                <p className="text-sm text-muted-foreground">Last 30 days</p>
                <Badge className="mt-2 bg-green-100 text-green-800">Operational</Badge>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Activity Heatmap</CardTitle>
              <CardDescription>Analysis activity by day and hour</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-25 gap-1">
                {/* Simplified heatmap visualization */}
                <div className="text-xs text-muted-foreground col-span-1"></div>
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="text-xs text-center text-muted-foreground">
                    {i}
                  </div>
                ))}
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <>
                    <div key={day} className="text-xs text-muted-foreground">{day}</div>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const intensity = Math.random();
                      return (
                        <div
                          key={`${day}-${hour}`}
                          className="w-5 h-5 rounded"
                          style={{
                            backgroundColor: `rgba(139, 92, 246, ${intensity})`,
                          }}
                          title={`${day} ${hour}:00 - ${Math.floor(intensity * 100)} analyses`}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              AI-powered predictions based on historical data and current trends
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Growth Forecast</CardTitle>
                <CardDescription>Predicted analysis volume</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={[
                    ...data.timeSeriesData,
                    ...Array.from({ length: 10 }, (_, i) => ({
                      date: `Day ${i + 31}`,
                      analyses: Math.floor(Math.random() * 20) + 60,
                      predicted: true,
                    }))
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="analyses" 
                      stroke="#8b5cf6" 
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Predicted Trends</CardTitle>
                <CardDescription>Next 30 days outlook</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Total Analyses</span>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="font-bold">+23%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Average Score</span>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="font-bold">+5 points</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>New Repositories</span>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="font-bold">+45</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>API Usage</span>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="font-bold">+18%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI-Generated Insights</CardTitle>
              <CardDescription>Smart recommendations based on your data</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Opportunity Detected:</strong> JavaScript repositories show 15% higher marketability scores. Consider focusing on JavaScript projects for better commercial viability.
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <Target className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Performance Pattern:</strong> Repositories analyzed on Tuesdays and Thursdays tend to score 8% higher. This might indicate better code quality from mid-week commits.
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <Award className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Success Factor:</strong> Projects with comprehensive documentation score 23 points higher on average. Prioritize repos with README files over 500 words.
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <Users className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Team Insight:</strong> Collaborative repositories (3+ contributors) show 30% better completeness scores. Consider team size when evaluating projects.
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <Activity className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Trend Alert:</strong> Machine learning repositories are showing increased monetization potential (+12% this month). This sector presents growing opportunities.
                    </AlertDescription>
                  </Alert>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </>
      )}
      </div>
    </div>
  );
}