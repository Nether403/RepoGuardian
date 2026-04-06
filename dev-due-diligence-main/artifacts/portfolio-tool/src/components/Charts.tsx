import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { LanguageStat } from "@/lib/scoring";

export function ActivityChart({ data }: { data: { date: string, count: number }[] }) {
  if (!data || data.length === 0) return <div className="text-muted-foreground p-8 text-center">No recent activity found.</div>;

  return (
    <div className="w-full h-[300px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} 
            minTickGap={30}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} 
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "12px", color: "hsl(var(--foreground))" }}
            itemStyle={{ color: "hsl(var(--primary))", fontWeight: "bold" }}
            cursor={{ stroke: "hsl(var(--border))", strokeWidth: 2 }}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke="hsl(var(--primary))" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorCount)" 
            name="Contributions"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LanguageDistribution({ data }: { data: LanguageStat[] }) {
  if (!data || data.length === 0) return <div className="text-muted-foreground p-8 text-center">No language data available.</div>;

  return (
    <div className="w-full h-[300px] flex items-center justify-center mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} className="drop-shadow-md outline-none" />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "12px", color: "hsl(var(--foreground))" }}
            itemStyle={{ fontWeight: "bold" }}
            formatter={(value: number, name: string) => [`${value} repos`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute flex flex-col gap-2 w-full max-w-[120px] ml-auto right-4">
        {data.slice(0,4).map(lang => (
          <div key={lang.name} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lang.fill }} />
            <span className="text-foreground font-medium truncate">{lang.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
