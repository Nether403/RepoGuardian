# Similar Repositories

## Overview

The Similar Repositories feature uses AI to discover related projects based on metrics, functionality, or technology stack. It helps you find alternatives, inspiration, and complementary tools.

## Two Search Methods

### 1. Find Similar by Metrics

Discovers repositories with similar scores across the five metrics.

**How it works:**
- Compares originality, completeness, marketability, monetization, and usefulness scores
- Calculates similarity using weighted distance algorithm
- Returns repositories with closest metric profiles
- Ranks by overall similarity score

**Best for:**
- Finding alternatives at similar quality levels
- Discovering projects with similar strengths
- Identifying competitors with comparable metrics
- Benchmarking against similar projects

**Example use case:**
If you analyze a well-documented (high completeness) but niche (lower marketability) project, you'll find other well-documented niche projects.

### 2. Find Similar by Functionality

Uses AI to find repositories that solve similar problems or serve similar purposes.

**How it works:**
- Analyzes repository description, README, and topics
- Uses Google Gemini 2.5 Pro to understand functionality
- Identifies projects with similar use cases
- Considers technology stack and architecture
- Provides similarity scores and reasoning

**Best for:**
- Finding alternative solutions to the same problem
- Discovering projects in the same domain
- Identifying complementary tools
- Exploring different approaches to similar challenges

**Example use case:**
If you analyze a React state management library, you'll find other state management solutions regardless of their metric scores.

## How to Use

### From Analysis Results

1. Open any analyzed repository
2. Scroll to the "Similar Repositories" section
3. Choose your search method:
   - Click "Find Similar by Metrics"
   - Or click "Find Similar by Functionality"
4. Review the results
5. Click on any repository to analyze it

### From Repository Card

1. Hover over any repository card
2. Click the "Find Similar" button
3. Choose your search method
4. Explore the results

### From Collections (Pro)

1. Open a collection
2. Select a repository
3. Click "Find Similar"
4. Add similar repositories to the collection

## Understanding Results

### Similarity Scores

**By Metrics:**
- 90-100: Nearly identical metric profile
- 80-89: Very similar scores
- 70-79: Similar overall pattern
- 60-69: Moderately similar
- Below 60: Some similarities

**By Functionality:**
- 90-100: Solves the exact same problem
- 80-89: Very similar functionality
- 70-79: Similar use cases
- 60-69: Related domain
- Below 60: Loosely related

### Result Details

Each similar repository shows:
- Repository name and description
- Similarity score
- Primary language
- Star count
- Key topics
- Reasoning (for functionality search)
- Quick analyze button

### AI Reasoning

For functionality searches, you'll see:
- **Why it's similar**: Explanation of functional overlap
- **Key similarities**: Specific features or approaches
- **Differences**: How it differs from the original
- **Use case alignment**: How well it matches your needs

## Use Cases

### Finding Alternatives

**Scenario:** You need alternatives to a library

1. Analyze the current library
2. Use "Find Similar by Functionality"
3. Compare alternatives
4. Evaluate based on your criteria

**Example:**
```
Original: lodash
Similar: ramda, underscore, lazy.js
Criteria: Bundle size, functional programming support
```

### Competitive Research

**Scenario:** Understand your competitive landscape

1. Analyze your project
2. Find similar by functionality
3. Analyze all competitors
4. Compare metrics and features

**Example:**
```
Your project: Custom CMS
Similar: strapi, directus, payload
Analysis: Feature completeness, marketability
```

### Technology Discovery

**Scenario:** Explore new tools in your domain

1. Analyze a tool you know
2. Find similar by functionality
3. Discover new projects
4. Evaluate for adoption

**Example:**
```
Known tool: webpack
Similar: vite, esbuild, parcel, rollup
Discovery: Modern build tools
```

### Learning and Inspiration

**Scenario:** Learn from similar projects

1. Analyze a well-built project
2. Find similar by metrics
3. Study their approaches
4. Apply learnings to your work

**Example:**
```
Reference: well-documented project
Similar: Other well-documented projects
Learning: Documentation best practices
```

### Complementary Tools

**Scenario:** Find tools that work well together

1. Analyze your main tool
2. Find similar by functionality
3. Identify complementary projects
4. Build your tech stack

**Example:**
```
Main tool: React
Similar: Next.js, Remix, Gatsby
Stack: React + Next.js + TanStack Query
```

## Advanced Features (Pro)

### Similarity Filters

Refine results by:
- Minimum star count
- Programming language
- Last update date
- License type
- Minimum similarity score

### Bulk Similar Search

Find similar repositories for multiple projects:
1. Select multiple repositories
2. Run bulk similarity search
3. Get aggregated results
4. Identify common alternatives

### Similarity Tracking

Monitor similar repositories over time:
- Track new similar projects
- Monitor metric changes
- Receive notifications
- Update collections automatically

### Custom Similarity Weights

Adjust what matters most:
- Prioritize specific metrics
- Weight functionality vs. metrics
- Focus on specific features
- Customize for your use case

## Best Practices

### Choosing Search Method

**Use "By Metrics" when:**
- You care about quality levels
- You want similar maturity
- You need comparable completeness
- You're benchmarking

**Use "By Functionality" when:**
- You need alternative solutions
- You're exploring a domain
- You want different approaches
- You're researching competitors

### Interpreting Results

Consider:
- **Similarity score**: How closely related
- **Star count**: Community adoption
- **Last update**: Maintenance status
- **Language**: Technology fit
- **Topics**: Domain relevance

### Combining Methods

For comprehensive research:
1. Start with functionality search
2. Analyze top results
3. Run metrics search on best candidates
4. Compare all options
5. Make informed decision

### Filtering Results

Focus on relevant projects:
- Set minimum star count
- Filter by language
- Check last update date
- Verify license compatibility
- Review documentation quality

## Limitations

Be aware that:
- Results are AI-generated suggestions
- Similarity is based on available data
- New projects may not appear
- Private repositories aren't included
- Results may include archived projects

## API Integration

Automate similarity search:

```javascript
// Find similar by metrics
const similar = await fetch('/api/repositories/similar/metrics', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    repositoryId: 'repo-id',
    limit: 10
  })
});

// Find similar by functionality
const functionalSimilar = await fetch('/api/repositories/similar/functionality', {
  method: 'POST',
  body: JSON.stringify({
    repositoryId: 'repo-id',
    limit: 10,
    filters: {
      minStars: 100,
      language: 'JavaScript'
    }
  })
});
```

See [API Documentation](../API_DOCUMENTATION.md) for details.

## Frequently Asked Questions

**Q: How many similar repositories are returned?**
A: Typically 5-10, depending on how many relevant matches exist.

**Q: Can I search for similar private repositories?**
A: Private repository similarity search is available for Enterprise tier.

**Q: How often are similarity results updated?**
A: Results are generated in real-time based on current data.

**Q: Can I save similar repositories?**
A: Yes! Add them to collections (Pro) or bookmark them.

**Q: Why don't I see any similar repositories?**
A: This can happen for very unique or niche projects. Try adjusting filters or using the other search method.

## Related Features

- [Repository Analysis](./repository-analysis.md) - Analyze repositories
- [Compare](./compare.md) - Side-by-side comparison
- [Advanced Search](./advanced-search.md) - Find repositories
- [Collections](./collections.md) - Organize discoveries

## Need Help?

- Use the AI Assistant (bottom-right corner)
- Check the [FAQ](../faq/index.md)
- Review [Troubleshooting](../troubleshooting/index.md)
- Contact support@reporadar.com
