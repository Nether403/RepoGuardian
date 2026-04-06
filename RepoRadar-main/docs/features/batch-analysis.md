# Batch Analysis

## Overview

Batch Analysis allows you to analyze multiple GitHub repositories simultaneously, saving time and enabling efficient comparison of multiple projects.

## Features

### Parallel Processing

- Analyze multiple repositories at once
- Real-time progress tracking
- Individual status indicators per repository
- Automatic retry on failures

### Capacity Limits

**Free Tier:**
- 3 repositories per batch
- 10 total analyses per month

**Pro Tier:**
- Unlimited repositories per batch
- Unlimited total analyses

**Enterprise Tier:**
- Custom batch sizes
- Priority processing
- Dedicated resources

## How to Use Batch Analysis

### Starting a Batch

1. Navigate to "Discover" → "Batch Analysis"
2. Add repository URLs one at a time:
   - Paste URL in the input field
   - Click "Add Repository" or press Enter
   - Repeat for each repository
3. Review your list (remove any if needed)
4. Click "Start Batch Analysis"
5. Monitor progress in real-time

### Supported URL Formats

- `https://github.com/owner/repo`
- `github.com/owner/repo`
- `owner/repo`

### Progress Tracking

Each repository shows:
- **Pending**: Waiting to start
- **Analyzing**: Currently processing
- **Complete**: Analysis finished successfully
- **Failed**: Error occurred (with reason)

### Viewing Results

Once complete:
- Click on any repository to view full analysis
- Compare results side-by-side
- Export all results together
- Save to collections (Pro)

## Export Options

### Batch PDF Export

Creates a comprehensive report with:
- Cover page with batch summary
- Individual analysis for each repository
- Comparison charts
- Metric averages across all repositories
- Timestamp and batch ID

**Best for:**
- Team presentations
- Decision documentation
- Stakeholder reports
- Archive records

### Batch CSV Export

Spreadsheet with all repositories:
- One row per repository
- All metric scores
- Repository metadata
- Summary text
- Analysis timestamps

**Best for:**
- Data analysis in Excel/Google Sheets
- Custom charts and visualizations
- Integration with other tools
- Quantitative comparison

### Individual Exports

Export each repository separately:
- Select specific repositories
- Choose PDF or CSV format
- Download individually or as ZIP

## Use Cases

### Technology Evaluation

Compare competing libraries or frameworks:

**Example: React State Management**
```
facebook/react
pmndrs/zustand
pmndrs/jotai
reduxjs/redux-toolkit
TanStack/query
```

Evaluate based on:
- Completeness of documentation
- Community adoption (marketability)
- Ease of use (usefulness)
- Innovation (originality)

### Competitive Analysis

Analyze competitors in your space:

**Example: Static Site Generators**
```
vercel/next.js
gatsbyjs/gatsby
11ty/eleventy
withastro/astro
facebook/docusaurus
```

Compare:
- Feature completeness
- Market positioning
- Monetization strategies
- Community strength

### Portfolio Review

Analyze your own projects:

**Example: Personal Projects**
```
yourusername/project1
yourusername/project2
yourusername/project3
```

Identify:
- Strengths to highlight
- Areas for improvement
- Documentation gaps
- Marketability potential

### Dependency Audit

Evaluate your project's dependencies:

**Example: Frontend Stack**
```
facebook/react
vitejs/vite
tailwindlabs/tailwindcss
radix-ui/primitives
tanstack/query
```

Assess:
- Maintenance status
- Community health
- Long-term viability
- Security posture

### Trending Analysis

Analyze trending repositories in your domain:

**Example: AI/ML Tools**
```
openai/gpt-4
anthropic/claude
google/gemini
meta/llama
stability-ai/stable-diffusion
```

Track:
- Innovation trends
- Market leaders
- Emerging technologies
- Community adoption

## Best Practices

### Batch Size

**Optimal batch sizes:**
- **3-5 repos**: Quick comparison
- **5-10 repos**: Comprehensive evaluation
- **10-20 repos**: Market analysis
- **20+ repos**: Large-scale audit (Pro only)

### Repository Selection

Choose repositories that:
- Serve similar purposes
- Target the same use case
- Compete in the same space
- Use similar technologies
- Are at similar maturity levels

### Timing

Consider:
- Each repository takes 10-30 seconds
- Batches process in parallel (up to 5 concurrent)
- Large batches may take several minutes
- Failed analyses can be retried individually

### Organization

After batch analysis:
- Create a collection for the batch (Pro)
- Export results immediately
- Add notes to individual analyses
- Tag repositories for easy filtering

## Troubleshooting

### Some Repositories Failed

**Common causes:**
- Invalid repository URL
- Repository doesn't exist
- Repository is private (requires Pro)
- Temporary GitHub API issues
- Rate limit exceeded

**Solutions:**
1. Verify repository URLs are correct
2. Check if repositories are public
3. Retry failed analyses individually
4. Wait a few minutes if rate limited
5. Contact support if issues persist

### Batch Taking Too Long

**Possible reasons:**
- Large number of repositories
- Large repository sizes
- High system load
- Network connectivity issues

**Solutions:**
1. Split into smaller batches
2. Try during off-peak hours
3. Check your internet connection
4. Upgrade to Pro for priority processing

### Can't Add More Repositories

**Reason:** You've reached your tier limit

**Solutions:**
- Free tier: Remove some repositories (max 3)
- Upgrade to Pro for unlimited batches
- Run multiple batches sequentially

## Advanced Features (Pro)

### Batch Templates

Save common batch configurations:
- Name your template
- Save repository lists
- Reuse for regular audits
- Share with team members

### Scheduled Batches

Automate regular analysis:
- Set schedule (daily, weekly, monthly)
- Monitor repository evolution
- Track metric changes over time
- Receive email reports

### Batch Comparison

Compare multiple batches:
- Track trends over time
- Identify improving/declining projects
- Visualize metric changes
- Export comparison reports

### Team Collaboration

Share batch results:
- Invite team members
- Add comments and notes
- Assign repositories for review
- Track team decisions

## API Integration

Automate batch analysis via API:

```javascript
// Start a batch analysis
const batch = await fetch('/api/batch-analysis', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    repositories: [
      'facebook/react',
      'vuejs/vue',
      'angular/angular'
    ]
  })
});

// Check batch status
const status = await fetch(`/api/batch-analysis/${batch.id}`);

// Get results
const results = await fetch(`/api/batch-analysis/${batch.id}/results`);
```

See [API Documentation](../API_DOCUMENTATION.md) for details.

## Keyboard Shortcuts

Speed up your workflow:
- `Ctrl/Cmd + Enter`: Start batch analysis
- `Ctrl/Cmd + A`: Select all repositories
- `Delete`: Remove selected repositories
- `Ctrl/Cmd + E`: Export results

## Related Features

- [Repository Analysis](./repository-analysis.md) - Single repository analysis
- [Compare](./compare.md) - Side-by-side comparison
- [Collections](./collections.md) - Organize results
- [Analytics Dashboard](./analytics-dashboard.md) - Track usage

## Need Help?

- Use the AI Assistant (bottom-right corner)
- Check the [FAQ](../faq/index.md)
- Review [Troubleshooting](../troubleshooting/index.md)
- Contact support@reporadar.com
