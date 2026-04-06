# Advanced Analytics - Quick Start Guide

## ✅ What's Working Now

Your Advanced Analytics dashboard (`/advanced-analytics`) is now **fully functional** with real data!

## How to Use

### 1. Sign In First
You must be signed in to view your real analytics data.

**Sign in at:** `/handler/sign-in`

If you're not signed in, you'll see:
- A blue banner prompting you to sign in
- Sample data showing what the dashboard will look like
- A link to the sign-in page

### 2. Access the Dashboard
Navigate to: **`/advanced-analytics`**

Or click: **Analytics → Advanced Analytics** in the navigation menu

### 3. What You'll See

#### If You Have Data:
- Real metrics from your repository analyses
- Actual trends and patterns
- Live language distribution
- Top performing repositories
- Metric comparisons over time

#### If Database Is Empty:
- Amber banner saying "Demo Mode"
- Sample data to show what it will look like
- Encouragement to analyze repositories

### 3. Generate Real Data

To populate the dashboard with real analytics:

1. Go to the main repository search
2. Analyze some repositories
3. Return to `/advanced-analytics`
4. Your data will automatically appear!

## Features Available

### ✅ Working with Real Data
- **Overview Cards**: Total analyses, average scores, trends, active repos, team members, API calls
- **Time Series Chart**: Analysis activity over time
- **Score Distribution**: Breakdown of scores across ranges
- **Language Stats**: Most analyzed programming languages with percentages
- **Metric Trends**: Originality, Completeness, Marketability, Monetization, Usefulness
- **Top Performers**: Highest scoring repositories
- **Radar Chart**: Visual metric comparison
- **Time Range Selector**: 7 days, 30 days, 90 days, 1 year
- **Export Function**: Download analytics as JSON

### 🚧 Coming Soon (Mock Data)
- **Predictions Tab**: Forecasting and growth projections
- **AI Insights Tab**: Smart recommendations and patterns
- **Activity Heatmap**: Hour-by-hour analysis patterns

## Time Range Selector

Use the dropdown in the top-right to change the time period:
- **Last 7 days** - Recent activity
- **Last 30 days** - Monthly overview (default)
- **Last 90 days** - Quarterly trends
- **Last year** - Annual patterns

## Export Data

Click the **Export** button to download your analytics as a JSON file.
Perfect for:
- Backup
- External analysis
- Reporting
- Data science projects

## Technical Details

### API Endpoint
```
GET /api/analytics/advanced?timeRange=30d
```

### Response Format
```typescript
{
  overview: { totalAnalyses, averageScore, trendsUp, ... },
  scoreDistribution: [...],
  timeSeriesData: [...],
  languageDistribution: [...],
  metricTrends: { originality, completeness, ... },
  topPerformers: [...],
  radarData: [...]
}
```

### Authentication
Requires authentication - users must be logged in to access.

## Performance

- **Fast**: Uses pre-aggregated data when available
- **Reliable**: Falls back to raw queries if needed
- **Scalable**: Designed for thousands of analyses

## Troubleshooting

### "Sign in to view your analytics" Message
- You're not currently signed in
- Go to `/handler/sign-in` to authenticate
- After signing in, return to `/advanced-analytics`

### "Demo Mode" Banner Won't Go Away
- You're signed in but haven't analyzed any repositories yet
- Analyze at least one repository through the main app
- Check that analyses are being saved to the database
- Verify the time range includes your analyses

### Charts Are Empty
- Select a different time range
- Ensure you have analyses in that period
- Check browser console for errors

### Slow Loading
- Normal for first load (aggregating data)
- Consider adding Redis caching for production
- Background jobs can pre-calculate daily stats

## What's Next?

The dashboard is ready to use! As you analyze more repositories:
- Trends will become more accurate
- Patterns will emerge
- Insights will be more valuable

Start analyzing repositories to see your analytics come to life! 🚀
