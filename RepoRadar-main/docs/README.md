# RepoRadar Documentation

Welcome to the comprehensive documentation for RepoRadar - an AI-powered GitHub repository analysis platform.

## 📚 Documentation Overview

### Quick Access

- **New to RepoRadar?** Start with [Getting Started](./getting-started/index.md)
- **Need quick answers?** Check the [Quick Reference](./QUICK_REFERENCE.md)
- **Have questions?** See the [FAQ](./faq/index.md)
- **Having issues?** Visit [Troubleshooting](./troubleshooting/index.md)
- **Using the API?** Read [API Documentation](./API_DOCUMENTATION.md)

### AI Assistant

The fastest way to get help is using our **AI Assistant** (bottom-right corner of every page). It knows everything about RepoRadar and can answer questions instantly!

Learn more: [AI Assistant Knowledge Base](./AI_ASSISTANT_KNOWLEDGE_BASE.md)

## 📖 Documentation Sections

### 🚀 Getting Started

Perfect for new users and self-hosters.

- **[Overview](./getting-started/index.md)** - What is RepoRadar and why use it
- **[Installation](./getting-started/installation.md)** - Setup guide for self-hosting
- **[Quick Start](./getting-started/quick-start.md)** - Your first analysis in 5 minutes

**Start here:** [Getting Started →](./getting-started/index.md)

### ✨ Features

Comprehensive guides for all RepoRadar features.

- **[Features Overview](./features/index.md)** - All features at a glance
- **[Repository Analysis](./features/repository-analysis.md)** - Understanding the 5 metrics
- **[Batch Analysis](./features/batch-analysis.md)** - Analyzing multiple repositories
- **[Similar Repositories](./features/similar-repositories.md)** - Discovery and alternatives
- **[Analytics Dashboard](./features/analytics-dashboard.md)** - Usage tracking (Pro)
- **[Subscription](./features/subscription.md)** - Plans and billing

**Explore features:** [Features →](./features/index.md)

### 🔧 API Reference

For developers integrating RepoRadar.

- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference
- **[Authentication](./api-reference/authentication.md)** - API keys and auth
- **[Repositories](./api-reference/repositories.md)** - Repository endpoints
- **[Analytics](./api-reference/analytics.md)** - Analytics endpoints

**For developers:** [API Documentation →](./API_DOCUMENTATION.md)

### ❓ FAQ

Answers to frequently asked questions.

- **[FAQ](./faq/index.md)** - Comprehensive Q&A covering:
  - General questions
  - Account & authentication
  - Features & usage
  - Technical questions
  - Billing & payments
  - Troubleshooting
  - API & integration
  - Privacy & security

**Common questions:** [FAQ →](./faq/index.md)

### 🔍 Troubleshooting

Solutions to common issues.

- **[Troubleshooting Guide](./troubleshooting/index.md)** - Quick fixes
- **[Common Issues](./troubleshooting/common-issues.md)** - Detailed solutions for:
  - Analysis problems
  - Authentication issues
  - Search & discovery
  - Performance issues
  - Export problems
  - Subscription & billing
  - Database issues (self-hosted)
  - API issues

**Need help?** [Troubleshooting →](./troubleshooting/index.md)

### 📋 Quick Reference

Cheat sheet for common tasks.

- **[Quick Reference](./QUICK_REFERENCE.md)** - Quick answers including:
  - Common tasks
  - Keyboard shortcuts
  - URL formats
  - Score interpretation
  - Troubleshooting quick fixes
  - API examples
  - Best practices

**Quick lookup:** [Quick Reference →](./QUICK_REFERENCE.md)

### ⚙️ Technical Guides

Advanced configuration and deployment.

- **[Performance Configuration](./PERFORMANCE_CONFIGURATION.md)** - Optimization guide
- **[Security Best Practices](./SECURITY_BEST_PRACTICES.md)** - Security hardening
- **[Multi-Instance Deployment](./MULTI_INSTANCE_DEPLOYMENT.md)** - Scaling guide
- **[Rate Limiting](./RATE_LIMITING.md)** - API rate limits
- **[Feature Flags](./FEATURE_FLAGS_GUIDE.md)** - Feature management
- **[Health Checks](./HEALTH_CHECK_GUIDE.md)** - Monitoring
- **[Analytics](./ANALYTICS_GUIDE.md)** - Analytics setup
- **[Error Handling](./ERROR_HANDLING_GUIDE.md)** - Error management

### 🔐 Setup Guides

Service-specific configuration.

- **[OAuth Setup](./OAUTH_SETUP.md)** - GitHub authentication
- **[Redis Setup](./REDIS_SETUP.md)** - Caching configuration
- **[Stripe Setup](./STRIPE_SETUP.md)** - Payment processing
- **[Email Service](./EMAIL_SERVICE.md)** - Email configuration

## 🎯 Common Use Cases

### For Developers

**Evaluating Libraries:**
1. Read [Repository Analysis](./features/repository-analysis.md)
2. Learn about the [5 metrics](./features/repository-analysis.md#the-five-metrics)
3. Use [Advanced Search](./features/index.md#advanced-search) to find options
4. [Compare](./features/index.md#compare-repositories) alternatives
5. Make informed decisions

**Building Tech Stack:**
1. Analyze your current tools
2. Use [Similar Repositories](./features/similar-repositories.md) to find alternatives
3. [Batch analyze](./features/batch-analysis.md) all options
4. Compare and choose

### For Teams

**Competitive Analysis:**
1. Create a [Collection](./features/index.md#collections) for competitors
2. [Batch analyze](./features/batch-analysis.md) all competitors
3. Use [Compare](./features/index.md#compare-repositories) feature
4. Track with [Analytics Dashboard](./features/analytics-dashboard.md)
5. Export reports

**Dependency Audits:**
1. List all dependencies
2. [Batch analyze](./features/batch-analysis.md) them
3. Check maintenance status
4. Identify risks
5. Plan updates

### For Organizations

**API Integration:**
1. Read [API Documentation](./API_DOCUMENTATION.md)
2. Get API key (Pro/Enterprise)
3. Integrate with CI/CD
4. Automate analysis
5. Monitor with webhooks (Enterprise)

**Team Collaboration:**
1. Upgrade to Enterprise
2. Set up team workspace
3. Share collections
4. Assign roles
5. Track team activity

## 🛠️ Self-Hosting

### Quick Setup

```bash
# Clone repository
git clone <repo-url>
cd reporadar

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Setup database
npm run db:push

# Start development server
npm run dev
```

**Full guide:** [Installation →](./getting-started/installation.md)

### Requirements

- Node.js 18+
- PostgreSQL database
- Google Gemini API key
- Optional: Redis for caching
- Optional: Stripe for payments

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
npm run start

# Or use Docker
npm run deploy:docker
```

**Deployment guide:** [Multi-Instance Deployment →](./MULTI_INSTANCE_DEPLOYMENT.md)

## 🤖 AI Assistant

### What It Knows

The AI Assistant has comprehensive knowledge about:

- All RepoRadar features and how to use them
- The 5 analysis metrics and scoring
- Navigation and UI
- Subscription tiers and billing
- Troubleshooting common issues
- API integration
- Self-hosting setup
- Best practices

**Learn more:** [AI Assistant Knowledge Base →](./AI_ASSISTANT_KNOWLEDGE_BASE.md)

### How to Use It

1. Click the AI icon in the bottom-right corner
2. Ask your question in natural language
3. Get instant, context-aware answers
4. Follow up with more questions

**Available 24/7** on every page!

## 📊 Feature Comparison

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| **Analyses/month** | 10 | Unlimited | Unlimited |
| **Batch analysis** | 3 repos | Unlimited | Unlimited |
| **Advanced search** | Basic | All filters | All filters |
| **Collections** | ❌ | ✅ | ✅ |
| **Analytics** | ❌ | ✅ | ✅ |
| **API access** | ❌ | ✅ | ✅ |
| **Webhooks** | ❌ | ❌ | ✅ |
| **Team features** | ❌ | ❌ | ✅ |
| **Support** | Community | Priority | Dedicated |
| **Price** | Free | $9.99/mo | Custom |

**Full comparison:** [Features →](./features/index.md#feature-comparison)

## 🔗 Quick Links

### Essential
- [Getting Started](./getting-started/index.md)
- [Quick Reference](./QUICK_REFERENCE.md)
- [FAQ](./faq/index.md)
- [Troubleshooting](./troubleshooting/index.md)

### Features
- [Repository Analysis](./features/repository-analysis.md)
- [Batch Analysis](./features/batch-analysis.md)
- [Similar Repositories](./features/similar-repositories.md)
- [All Features](./features/index.md)

### Technical
- [API Documentation](./API_DOCUMENTATION.md)
- [Performance Configuration](./PERFORMANCE_CONFIGURATION.md)
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
- [Multi-Instance Deployment](./MULTI_INSTANCE_DEPLOYMENT.md)

### Setup
- [Installation](./getting-started/installation.md)
- [OAuth Setup](./OAUTH_SETUP.md)
- [Redis Setup](./REDIS_SETUP.md)
- [Stripe Setup](./STRIPE_SETUP.md)

## 💬 Getting Help

### Instant Help

**AI Assistant** (Recommended)
- Click icon in bottom-right corner
- Available 24/7
- Context-aware responses
- Instant answers

### Documentation

**Search the docs:**
- Use browser search (Ctrl/Cmd + F)
- Check the [Quick Reference](./QUICK_REFERENCE.md)
- Browse [FAQ](./faq/index.md)
- Review [Troubleshooting](./troubleshooting/index.md)

### Community Support

- **GitHub Issues**: Bug reports and feature requests
- **Discord Server**: Community discussions
- **Community Forum**: Q&A and help

### Direct Support

**Email Support:**
- support@reporadar.com
- Response times:
  - Free: 24-48 hours
  - Pro: 4-8 hours
  - Enterprise: 1-2 hours

**Sales Inquiries:**
- sales@reporadar.com (Enterprise)
- partnerships@reporadar.com (Partnerships)

## 🎓 Learning Path

### Beginner

1. Read [Getting Started](./getting-started/index.md)
2. Follow [Quick Start](./getting-started/quick-start.md)
3. Run your first analysis
4. Explore [Features Overview](./features/index.md)
5. Try [Batch Analysis](./features/batch-analysis.md)

### Intermediate

1. Master [Advanced Search](./features/index.md#advanced-search)
2. Use [Similar Repositories](./features/similar-repositories.md)
3. Create [Collections](./features/index.md#collections) (Pro)
4. Explore [Analytics Dashboard](./features/analytics-dashboard.md) (Pro)
5. Learn [Best Practices](./QUICK_REFERENCE.md#best-practices)

### Advanced

1. Read [API Documentation](./API_DOCUMENTATION.md)
2. Integrate with CI/CD
3. Set up [Self-Hosting](./getting-started/installation.md)
4. Configure [Performance](./PERFORMANCE_CONFIGURATION.md)
5. Implement [Security Best Practices](./SECURITY_BEST_PRACTICES.md)

## 📝 Contributing

### Documentation

Help improve the docs:
- Fix typos and errors
- Add examples
- Clarify explanations
- Suggest new guides

### Code

Contribute to RepoRadar:
- Fork the repository
- Create feature branches
- Submit pull requests
- Report bugs

See CONTRIBUTING.md for guidelines.

## 📄 License

RepoRadar is open source. See LICENSE file for details.

## 🔄 Updates

**Documentation Version:** 2.0  
**Last Updated:** January 2025  
**Covers:** All features through Phase 3 implementation

Check back regularly for updates!

## 🚀 Ready to Start?

Choose your path:

- **New User?** → [Getting Started](./getting-started/index.md)
- **Quick Start?** → [Quick Start Guide](./getting-started/quick-start.md)
- **Self-Hosting?** → [Installation Guide](./getting-started/installation.md)
- **Using API?** → [API Documentation](./API_DOCUMENTATION.md)
- **Have Questions?** → [FAQ](./faq/index.md) or **AI Assistant** (bottom-right)

---

**Need help?** The AI Assistant is always available in the bottom-right corner of every page!
