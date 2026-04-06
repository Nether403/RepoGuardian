import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AnalysisChartProps {
  analysis: any;
}

export function AnalysisRadarChart({ analysis }: AnalysisChartProps) {
  const data = [
    { metric: 'Originality', score: analysis?.originality || 0, fullMark: 10 },
    { metric: 'Completeness', score: analysis?.completeness || 0, fullMark: 10 },
    { metric: 'Marketability', score: analysis?.marketability || 0, fullMark: 10 },
    { metric: 'Monetization', score: analysis?.monetization || 0, fullMark: 10 },
    { metric: 'Usefulness', score: analysis?.usefulness || 0, fullMark: 10 },
  ];

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <CardTitle className="text-xl">Analysis Radar</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={data}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="metric" stroke="#9CA3AF" />
            <PolarRadiusAxis angle={90} domain={[0, 10]} stroke="#9CA3AF" />
            <Radar 
              name="Score" 
              dataKey="score" 
              stroke="#FF6B35" 
              fill="#FF6B35" 
              fillOpacity={0.6} 
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function LanguageDistributionChart({ languages }: { languages: any }) {
  if (!languages || Object.keys(languages).length === 0) return null;

  const data = Object.entries(languages)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const dataWithPercentage = data.map(item => ({
    ...item,
    percentage: ((item.value / total) * 100).toFixed(1)
  }));

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <CardTitle className="text-xl">Language Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={dataWithPercentage}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
              labelStyle={{ color: '#9CA3AF' }}
              formatter={(value: any) => [`${value}%`, 'Percentage']}
            />
            <Bar dataKey="percentage" fill="#FF3333" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}