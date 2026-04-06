import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { LoadingSkeleton, CardSkeleton } from "@/components/skeleton-loader";
import { Link } from "wouter";
import { Header } from "@/components/layout/Header";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { CalendarDays, TrendingUp, Code, Star, GitBranch, Activity } from "lucide-react";

const COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

interface AnalyticsData {
  stats: {
    totalAnalyses: number;
    thisMonth: number;
    growth: number;
    avgScore: number;
    topLanguage: string;
    activeProjects: number;
  };
  activity: Array<{ date: string; count: number }>;
  languages: Array<{ name: string; value: number }>;
  scores: Array<{ name: string; score: number }>;
  trends: Array<{ month: string; originality: number; completeness: number; marketability: number; monetization: number; usefulness: number }>;
  performance: Array<{ title: string; description: string; value: string; unit: string }>;
  recentAnalyses: Array<{
    id: string;
    name: string;
    owner: string;
    language: string;
    score: number;
    date: string;
  }>;
}

export default function Analytics() {
  const { user, isAuthenticated } = useAuth();

  const { data: analyticsData, isLoading, error } = useQuery<AnalyticsData & { isEmpty?: boolean; message?: string }>({
    queryKey: ['/api/analytics/dashboard'],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="py-12 pt-32">
          <div className="max-w-7xl mx-auto px-6">
            <Card className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Analytics Dashboard</h2>
              <p className="text-muted-foreground mb-6">
                Sign in to view your analytics and insights
              </p>
              <Button asChild>
                <a href="/api/login">Sign In</a>
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="py-12 pt-32">
          <div className="max-w-7xl mx-auto px-6">
            {/* Header Skeleton */}
            <div className="mb-8">
              <div className="h-10 w-64 bg-gray-700 rounded animate-pulse mb-4"></div>
              <div className="h-4 w-96 bg-gray-700 rounded animate-pulse"></div>
            </div>
            
            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <LoadingSkeleton variant="card" count={6} />
            </div>
            
            {/* Charts Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <LoadingSkeleton variant="chart" count={4} />
            </div>
            
            {/* Table Skeleton */}
            <LoadingSkeleton variant="table" count={5} />
          </div>
        </div>
      </div>
    );
  }

  // Handle empty state
  if (analyticsData?.isEmpty) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="py-12 pt-32">
          <div className="max-w-7xl mx-auto px-6">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold gradient-text mb-4">
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground">
                Track your repository analysis patterns and insights
              </p>
            </div>

            {/* Empty State Card */}
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Analyses Yet</h2>
                <p className="text-muted-foreground mb-6">
                  {analyticsData.message || 'Start by analyzing your first repository to see insights and statistics here.'}
                </p>
                <Button asChild size="lg">
                  <Link href="/">
                    <Star className="w-4 h-4 mr-2" />
                    Analyze Your First Repository
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const stats = analyticsData?.stats || {
    totalAnalyses: 0,
    thisMonth: 0,
    growth: 0,
    avgScore: 0,
    topLanguage: 'N/A',
    activeProjects: 0
  };

  const activityData = analyticsData?.activity || [];
  const languageData = analyticsData?.languages || [];
  const scoreData = analyticsData?.scores || [];
  const trendData = analyticsData?.trends || [];
  const performanceData = analyticsData?.performance || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="py-12 pt-32">
        <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-4">
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track your repository analysis patterns and insights
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="p-4 hover:shadow-lg transition-all duration-300 card-lift" data-testid="stat-total-analyses">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalAnalyses}</div>
            <p className="text-xs text-muted-foreground">Analyses</p>
          </Card>

          <Card className="p-4 hover:shadow-lg transition-all duration-300 card-lift" data-testid="stat-this-month">
            <div className="flex items-center justify-between mb-2">
              <CalendarDays className="w-5 h-5 text-secondary" />
              <span className="text-xs text-muted-foreground">Month</span>
            </div>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground">This Month</p>
          </Card>

          <Card className="p-4 hover:shadow-lg transition-all duration-300 card-lift" data-testid="stat-growth">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-xs text-muted-foreground">Growth</span>
            </div>
            <div className="text-2xl font-bold text-green-500">+{stats.growth}%</div>
            <p className="text-xs text-muted-foreground">vs Last Month</p>
          </Card>

          <Card className="p-4 hover:shadow-lg transition-all duration-300 card-lift" data-testid="stat-avg-score">
            <div className="flex items-center justify-between mb-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Score</span>
            </div>
            <div className="text-2xl font-bold">{stats.avgScore.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </Card>

          <Card className="p-4 hover:shadow-lg transition-all duration-300 card-lift" data-testid="stat-top-language">
            <div className="flex items-center justify-between mb-2">
              <Code className="w-5 h-5 text-blue-500" />
              <span className="text-xs text-muted-foreground">Language</span>
            </div>
            <div className="text-lg font-bold">{stats.topLanguage}</div>
            <p className="text-xs text-muted-foreground">Most Analyzed</p>
          </Card>

          <Card className="p-4 hover:shadow-lg transition-all duration-300 card-lift" data-testid="stat-active-projects">
            <div className="flex items-center justify-between mb-2">
              <GitBranch className="w-5 h-5 text-orange-500" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <div className="text-2xl font-bold">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">Projects</p>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Activity Chart */}
          <Card className="p-6 hover:shadow-lg transition-all duration-300">
            <h3 className="text-lg font-semibold mb-4">Analysis Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="count" 
                  stroke="#8b5cf6" 
                  fillOpacity={1} 
                  fill="url(#colorActivity)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Language Distribution */}
          <Card className="p-6 hover:shadow-lg transition-all duration-300">
            <h3 className="text-lg font-semibold mb-4">Language Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={languageData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {languageData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Score Breakdown */}
          <Card className="p-6 hover:shadow-lg transition-all duration-300">
            <h3 className="text-lg font-semibold mb-4">Average Scores by Metric</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Bar dataKey="score" fill="#8b5cf6">
                  {scoreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Trend Analysis */}
          <Card className="p-6 hover:shadow-lg transition-all duration-300">
            <h3 className="text-lg font-semibold mb-4">Score Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="originality" stroke="#8b5cf6" strokeWidth={2} />
                <Line type="monotone" dataKey="completeness" stroke="#ec4899" strokeWidth={2} />
                <Line type="monotone" dataKey="marketability" stroke="#06b6d4" strokeWidth={2} />
                <Line type="monotone" dataKey="monetization" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="usefulness" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Recent Analyses Table */}
        <Card className="p-6 hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Recent Analyses</h3>
            <Button variant="outline" size="sm" asChild>
              <Link href="/analyses/recent">View All</Link>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Repository</th>
                  <th className="text-left p-2">Language</th>
                  <th className="text-left p-2">Score</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData?.recentAnalyses?.slice(0, 5).map((analysis: any) => (
                  <tr key={analysis.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-2">
                      <div className="font-medium">{analysis.name}</div>
                      <div className="text-xs text-muted-foreground">{analysis.owner}</div>
                    </td>
                    <td className="p-2">
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs">
                        {analysis.language}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center">
                        <Star className="w-4 h-4 text-yellow-500 mr-1" />
                        <span>{analysis.score.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="p-2 text-muted-foreground text-sm">
                      {new Date(analysis.date).toLocaleDateString()}
                    </td>
                    <td className="p-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/repository/${analysis.owner}/${analysis.name}`}>
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Performance Insights */}
        <Card className="p-6 mt-6 hover:shadow-lg transition-all duration-300">
          <h3 className="text-lg font-semibold mb-4">Performance Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {performanceData.map((insight: any, index: number) => (
              <div key={index} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 rounded-full bg-primary mr-2 pulse"></div>
                  <span className="font-medium">{insight.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{insight.description}</p>
                <div className="mt-2">
                  <span className="text-2xl font-bold gradient-text">{insight.value}</span>
                  <span className="text-sm text-muted-foreground ml-2">{insight.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}