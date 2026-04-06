# Frequently Asked Questions (FAQ)

## General Questions

### What is RepoRadar?

RepoRadar is an AI-powered platform for analyzing GitHub repositories. It uses Google's Gemini 2.5 Pro to evaluate repositories across five key metrics: originality, completeness, marketability, monetization potential, and usefulness.

### How accurate are the AI analyses?

Our AI analyses are based on comprehensive evaluation of repository data including:
- Code quality and structure
- Documentation completeness
- Community engagement
- Maintenance activity
- Technical innovation

While highly accurate, analyses should be used as one input in your decision-making process alongside your own evaluation.

### Is RepoRadar free?

Yes! We offer a free tier with:
- 10 analyses per month
- Basic search functionality
- Batch analysis (up to 3 repositories)
- PDF/CSV export

Pro and Enterprise tiers offer additional features and higher limits.

## Account & Authentication

### How do I create an account?

RepoRadar uses GitHub OAuth for authentication. Simply click "Sign In" and authorize with your GitHub account. No separate registration needed!

### Can I use RepoRadar without a GitHub account?

No, a GitHub account is required for authentication. This ensures secure access and helps us prevent abuse.

### How do I upgrade to Pro?

1. Click on your profile in the top-right
2. Select "Upgrade to Pro"
3. Choose your plan
4. Complete payment via Stripe
5. Enjoy unlimited analyses!

### Can I cancel my subscription anytime?

Yes, you can cancel your Pro subscription at any time from your profile settings. You'll retain Pro features until the end of your billing period.

## Features & Usage

### What are the 5 analysis metrics?

1. **Originality (0-100)**: Innovation and uniqueness of the project
2. **Completeness (0-100)**: Documentation, tests, and maturity
3. **Marketability (0-100)**: Adoption potential and growth
4. **Monetization (0-100)**: Revenue generation capability
5. **Usefulness (0-100)**: Practical value and problem-solving

### How long does an analysis take?

Most analyses complete in 10-30 seconds, depending on:
- Repository size
- API response times
- Current system load

Batch analyses process repositories in parallel for faster results.

### Can I analyze private repositories?

Currently, RepoRadar only analyzes public GitHub repositories. Private repository support is planned for Enterprise tier.

### What's the difference between "Find Similar by Metrics" and "Find Similar by Functionality"?

- **By Metrics**: Finds repositories with similar scores across the 5 metrics
- **By Functionality**: Uses AI to find repositories that solve similar problems or serve similar purposes, regardless of scores

### How many repositories can I compare at once?

You can compare 2-4 repositories side-by-side. This helps you evaluate competing solutions or similar projects.

### What file formats can I export to?

RepoRadar supports three export formats:
- **PDF**: Professional reports with charts and detailed analysis
- **CSV**: Spreadsheet-compatible data for further analysis
- **JSON**: Machine-readable format for API integration (Pro/Enterprise)

## Technical Questions

### What programming languages are supported?

RepoRadar analyzes repositories in any programming language. Our advanced search supports filtering by 50+ languages including:
- JavaScript/TypeScript
- Python
- Java
- Go
- Rust
- C/C++
- Ruby
- PHP
- And many more...

### How often is repository data updated?

Repository data is fetched in real-time from GitHub's API during analysis. For cached results, data is refreshed every 24 hours.

### Does RepoRadar store my analyzed repositories?

Yes, analysis results are stored to:
- Provide quick access to past analyses
- Enable collections and bookmarks
- Generate analytics insights
- Avoid re-analyzing the same repository

You can delete your analysis history from your profile settings.

### What are the API rate limits?

**Free Tier:**
- 10 analyses per month
- 100 API requests per hour

**Pro Tier:**
- Unlimited analyses
- 1,000 API requests per hour

**Enterprise Tier:**
- Custom rate limits
- Dedicated API endpoints

### Can I self-host RepoRadar?

Yes! RepoRadar is open-source and can be self-hosted. See our [Installation Guide](../getting-started/installation.md) for details.

Requirements:
- Node.js 18+
- PostgreSQL database
- Google Gemini API key
- Optional: Redis for caching

## Billing & Payments

### What payment methods do you accept?

We use Stripe for secure payment processing and accept:
- Credit cards (Visa, Mastercard, Amex, Discover)
- Debit cards
- Apple Pay
- Google Pay

### Is my payment information secure?

Yes! We never store your payment information. All payments are processed securely through Stripe, a PCI-compliant payment processor.

### Can I get a refund?

We offer a 14-day money-back guarantee for Pro subscriptions. Contact support within 14 days of your purchase for a full refund.

### Do you offer discounts for students or nonprofits?

Yes! We offer:
- 50% discount for students (with valid .edu email)
- 50% discount for registered nonprofits
- Custom pricing for educational institutions

Contact support with verification documents to apply.

### What's included in Enterprise pricing?

Enterprise plans are customized based on your needs and may include:
- API access with custom rate limits
- Dedicated support team
- SLA guarantees
- Custom integrations
- Team management features
- Advanced analytics
- On-premise deployment options

Contact sales for a custom quote.

## Troubleshooting

### Why is my analysis taking so long?

Long analysis times can be caused by:
- Large repository size
- High system load
- GitHub API rate limiting
- Network connectivity issues

Try again in a few minutes. If the issue persists, check our [Troubleshooting Guide](../troubleshooting/index.md).

### I'm getting "API rate limit exceeded" errors

This means you've reached your hourly API limit. Solutions:
- Wait for the rate limit to reset (shown in error message)
- Upgrade to Pro for higher limits
- Use batch analysis to analyze multiple repos efficiently

### My analysis results look incorrect

If you believe an analysis is inaccurate:
1. Re-run the analysis (repository may have been updated)
2. Check if the repository URL is correct
3. Verify the repository is public
4. Contact support with the repository URL and analysis ID

### The AI Assistant isn't responding

If the AI Assistant isn't working:
1. Check your internet connection
2. Refresh the page
3. Clear browser cache
4. Try a different browser
5. Check if Gemini API is configured (self-hosted)

### I can't sign in

Sign-in issues are usually caused by:
- Browser blocking third-party cookies
- GitHub OAuth not authorized
- Network/firewall restrictions

Solutions:
1. Enable third-party cookies for the site
2. Check GitHub OAuth settings
3. Try incognito/private browsing mode
4. Disable browser extensions temporarily

## Privacy & Security

### What data do you collect?

We collect:
- GitHub profile information (name, email, avatar)
- Analysis history and results
- Search queries and filters
- Usage analytics (anonymized)

We do NOT collect:
- Repository source code
- Private repository data
- Payment information (handled by Stripe)

### How is my data protected?

We implement industry-standard security measures:
- HTTPS encryption for all connections
- Secure session management
- Regular security audits
- Database encryption at rest
- SOC 2 compliant infrastructure

### Can I delete my data?

Yes! You can delete your data at any time:
1. Go to Profile → Settings
2. Click "Delete Account"
3. Confirm deletion

This permanently removes:
- Your account
- All analysis history
- Collections and bookmarks
- Personal information

### Do you share data with third parties?

We do not sell or share your personal data with third parties, except:
- GitHub (for authentication)
- Google (for AI analysis, anonymized)
- Stripe (for payment processing)
- Analytics providers (anonymized usage data)

See our Privacy Policy for full details.

## API & Integration

### How do I get API access?

API access is available for Pro and Enterprise tiers:
1. Upgrade to Pro or Enterprise
2. Generate API key from Profile → API Settings
3. Use the key in your API requests

See [API Documentation](../API_DOCUMENTATION.md) for details.

### What can I do with the API?

The API allows you to:
- Analyze repositories programmatically
- Search and filter repositories
- Retrieve analysis results
- Manage collections
- Export data

### Are there API client libraries?

Official client libraries:
- JavaScript/TypeScript (npm: `@reporadar/client`)
- Python (pip: `reporadar`)

Community libraries:
- Ruby, Go, PHP (see GitHub)

### Can I integrate RepoRadar with my CI/CD pipeline?

Yes! Common integrations:
- GitHub Actions
- GitLab CI
- Jenkins
- CircleCI
- Travis CI

See our [Integration Guide](../MONITORING_INTEGRATION_GUIDE.md) for examples.

## Integration & Automation

### Can I integrate RepoRadar with my CI/CD pipeline?

Yes! Use our API to automate repository analysis in your workflow:

**GitHub Actions Example:**
```yaml
name: Analyze Repository
on: [push]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - name: Analyze with RepoRadar
        run: |
          curl -X POST https://reporadar.com/api/analyze \
            -H "Authorization: Bearer ${{ secrets.REPORADAR_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"repository": "${{ github.repository }}"}'
```

See [API Documentation](../API_DOCUMENTATION.md) for more examples.

### What webhooks are available?

Enterprise tier includes webhooks for:
- Analysis completed
- Batch analysis finished
- New similar repository found
- Metric threshold alerts
- Subscription changes

### Can I use RepoRadar in my application?

Yes! Our API allows you to:
- Analyze repositories programmatically
- Retrieve analysis results
- Search and filter repositories
- Export data in JSON format
- Manage collections

API access requires Pro or Enterprise tier.

## Data & Privacy

### What happens to my data if I delete my account?

When you delete your account:
- All personal information is permanently removed
- Analysis history is deleted
- Collections and bookmarks are removed
- Subscriptions are cancelled
- API keys are revoked

This action cannot be undone.

### Do you train AI models on my data?

No. We use Google's Gemini API for analysis, but:
- We don't train models on your data
- Repository analyses are based on public GitHub data
- Your search queries and preferences are not shared
- Analysis results are stored only for your use

### Can I export all my data?

Yes! You can export:
- All analysis results (CSV/JSON)
- Collections and bookmarks
- Search history
- Account information

Go to Profile → Settings → Export Data

### Is my payment information secure?

Yes! We use Stripe for payment processing:
- PCI DSS compliant
- We never store card numbers
- Encrypted transmission
- Industry-standard security

### Do you comply with GDPR?

Yes, we are GDPR compliant:
- Right to access your data
- Right to deletion
- Right to data portability
- Right to rectification
- Transparent data practices

See our Privacy Policy for full details.

## Advanced Usage

### Can I analyze repositories in bulk via API?

Yes! Enterprise tier includes bulk analysis endpoints:

```javascript
POST /api/batch-analysis
{
  "repositories": ["owner/repo1", "owner/repo2", ...],
  "options": {
    "priority": "high",
    "webhook": "https://your-webhook.com"
  }
}
```

### How do I set up automated monitoring?

Pro and Enterprise tiers support scheduled analysis:

1. Create a collection of repositories to monitor
2. Set up scheduled analysis (daily, weekly, monthly)
3. Configure alerts for metric changes
4. Receive email reports

### Can I customize the analysis metrics?

Enterprise tier allows custom metric weights:
- Adjust importance of each metric
- Create custom scoring formulas
- Define threshold alerts
- Build custom reports

Contact sales for details.

### How do I use RepoRadar for competitive analysis?

Best practices:
1. Create a collection for competitors
2. Analyze all competitor repositories
3. Use Compare feature for side-by-side view
4. Set up monitoring for changes
5. Export regular reports
6. Track trends over time

### Can I white-label RepoRadar?

Enterprise tier includes white-labeling options:
- Custom branding
- Custom domain
- Remove RepoRadar branding
- Custom email templates
- Custom reports

Contact sales for pricing.

## Technical Questions

### What's the API rate limit?

**Free Tier:**
- 100 requests per hour
- 10 analyses per month

**Pro Tier:**
- 1,000 requests per hour
- Unlimited analyses

**Enterprise Tier:**
- Custom rate limits
- Dedicated endpoints
- Priority processing

### How do I handle rate limit errors?

Implement exponential backoff:

```javascript
async function analyzeWithRetry(repo, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await analyze(repo);
    } catch (error) {
      if (error.code === 'RATE_LIMIT' && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

### Can I run RepoRadar on-premise?

Yes! Enterprise tier includes:
- On-premise deployment support
- Docker containers
- Kubernetes configurations
- Dedicated support
- Custom integrations

### What database does RepoRadar use?

- **Production**: PostgreSQL (Neon serverless recommended)
- **Caching**: Redis (optional, memory fallback)
- **ORM**: Drizzle for type-safe queries
- **Migrations**: Drizzle Kit

### How do I optimize performance for self-hosted instances?

Key optimizations:
1. Enable Redis caching
2. Configure database connection pooling
3. Enable response compression
4. Use CDN for static assets
5. Configure GitHub Personal Access Token
6. Monitor with health checks

See [Performance Configuration](../PERFORMANCE_CONFIGURATION.md) for details.

### Can I contribute to RepoRadar?

Yes! RepoRadar is open source:
- Fork the repository
- Create feature branches
- Submit pull requests
- Report bugs and issues
- Suggest features
- Improve documentation

See CONTRIBUTING.md for guidelines.

## Comparison Questions

### How is RepoRadar different from GitHub Insights?

**RepoRadar:**
- AI-powered qualitative analysis
- 5 comprehensive metrics
- Actionable recommendations
- Cross-repository comparison
- Discovery and search features

**GitHub Insights:**
- Quantitative metrics only
- Traffic and engagement data
- Single repository focus
- No AI analysis
- Limited to repository owners

Use both together for complete insights!

### How does RepoRadar compare to npm/PyPI stats?

**RepoRadar:**
- Analyzes repository quality
- Evaluates documentation and completeness
- Assesses marketability and usefulness
- Works for any language
- Provides recommendations

**Package Registries:**
- Download statistics
- Version history
- Dependency information
- Package-specific metrics
- Language-specific

RepoRadar complements package registry data.

### Is RepoRadar better than manual code review?

No, it's complementary:

**RepoRadar provides:**
- Quick initial assessment
- Objective metric-based evaluation
- Comparison across multiple projects
- Discovery of similar projects

**Manual review provides:**
- Deep code quality analysis
- Security vulnerability assessment
- Architecture evaluation
- Team fit assessment

Use RepoRadar for initial screening, then manual review for final decisions.

## Billing Questions

### Do you offer refunds?

Yes! We offer:
- 14-day money-back guarantee for Pro
- No questions asked
- Full refund to original payment method
- Contact support within 14 days

### Can I switch between plans?

Yes:
- Upgrade anytime (immediate effect)
- Downgrade at end of billing period
- Pro-rate charges for upgrades
- No penalties for changes

### Do you offer annual billing?

Yes! Annual billing includes:
- 2 months free (save 17%)
- Single annual payment
- Same features as monthly
- Cancel anytime with pro-rated refund

### What happens if my payment fails?

1. We'll retry payment 3 times
2. Email notification sent
3. 7-day grace period
4. Account downgraded to free tier
5. Data preserved for 30 days

Update payment method to restore access.

### Can I get an invoice for my subscription?

Yes! Invoices are:
- Automatically emailed after each payment
- Available in Profile → Billing
- Include all required tax information
- Customizable for business needs (Enterprise)

## Still Have Questions?

### Instant Help
- **AI Assistant**: Click the AI icon (bottom-right) for instant help - available 24/7

### Documentation
- **Getting Started**: [Installation](../getting-started/installation.md) and [Quick Start](../getting-started/quick-start.md)
- **Feature Guides**: [Repository Analysis](../features/repository-analysis.md), [Batch Analysis](../features/batch-analysis.md), [Similar Repositories](../features/similar-repositories.md)
- **API Reference**: [API Documentation](../API_DOCUMENTATION.md)
- **Troubleshooting**: [Common Issues](../troubleshooting/common-issues.md)

### Community Support
- **Discord**: Join our community server
- **GitHub**: Open issues and discussions
- **Forum**: Community Q&A

### Direct Support
- **Email**: support@reporadar.com
- **Response Time**:
  - Free: 24-48 hours
  - Pro: 4-8 hours  
  - Enterprise: 1-2 hours
- **Include**: Error messages, screenshots, repository URLs, steps to reproduce

### Sales Inquiries
- **Enterprise**: sales@reporadar.com
- **Partnerships**: partnerships@reporadar.com
- **Custom Solutions**: Contact sales team

---

*Last updated: January 2025*
*Have a question not answered here? Ask our AI Assistant or contact support!*
