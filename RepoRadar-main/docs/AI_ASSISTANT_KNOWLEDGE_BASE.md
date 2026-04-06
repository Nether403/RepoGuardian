# AI Assistant Knowledge Base

## Overview

The RepoRadar AI Assistant is powered by Google's Gemini 2.5 Pro and has comprehensive knowledge about all RepoRadar features, functionality, and usage.

## What the AI Assistant Knows

### Core Features

The AI assistant has detailed knowledge about:

1. **Repository Analysis**
   - All 5 metrics (Originality, Completeness, Marketability, Monetization, Usefulness)
   - Scoring system (0-100 scale)
   - Analysis process and timing
   - How to interpret results
   - Score explanations, strengths, weaknesses, recommendations

2. **Batch Analysis**
   - How to analyze multiple repositories
   - Capacity limits per tier (3 free, unlimited Pro)
   - Progress tracking
   - Export options
   - Use cases and best practices

3. **Similar Repositories**
   - Two search methods (by metrics, by functionality)
   - How similarity is calculated
   - Use cases for each method
   - Interpreting similarity scores

4. **Advanced Search**
   - All 15+ available filters
   - How to combine filters effectively
   - Common search patterns
   - Troubleshooting no results

5. **Collections & Organization (Pro)**
   - Creating and managing collections
   - Bookmarking repositories
   - Tagging and categorization
   - Team collaboration features

6. **Analytics Dashboard (Pro)**
   - Available metrics and visualizations
   - Tracking usage patterns
   - Understanding trends
   - Generating reports

7. **Export Features**
   - PDF export (professional reports)
   - CSV export (spreadsheet data)
   - JSON export (API integration)
   - Batch exports

### Navigation & UI

The AI assistant knows:

- **Navigation structure** (Discover, Workspace, Resources menus)
- **All menu items** and what they do
- **Keyboard shortcuts**
- **Interactive onboarding tour**
- **UI animations and interactions**
- **Mobile responsiveness**

### Subscription Tiers

Complete knowledge of:

- **Free tier** features and limits
- **Pro tier** ($9.99/month) features
- **Enterprise tier** custom features
- **Upgrade process**
- **Billing and payment**
- **Cancellation policy**

### Technical Details

The AI assistant understands:

- **Technology stack** (React, Node.js, PostgreSQL, etc.)
- **Self-hosting requirements**
- **Environment variables**
- **Performance optimization**
- **Caching strategies**
- **Database configuration**
- **API integration**

### Troubleshooting

Comprehensive knowledge of:

- **Common issues** and solutions
- **Error messages** and their meanings
- **Browser-specific problems**
- **Authentication issues**
- **Performance problems**
- **Self-hosting issues**

### API & Integration

The AI assistant knows:

- **API endpoints** and usage
- **Authentication** methods
- **Rate limits** per tier
- **Webhook configuration** (Enterprise)
- **CI/CD integration** examples
- **Code examples** in multiple languages

## How the AI Assistant Works

### Knowledge Source

The AI assistant's knowledge comes from a **comprehensive system prompt** embedded in the application code (`server/gemini.ts`). This prompt contains:

1. **Feature descriptions** - Detailed explanations of all features
2. **Usage instructions** - Step-by-step guides for common tasks
3. **Troubleshooting guides** - Solutions to common problems
4. **Technical specifications** - Architecture and implementation details
5. **Best practices** - Recommendations for optimal usage

### Real-Time Processing

When you ask a question:

1. Your question is sent to Google's Gemini 2.5 Pro API
2. The system prompt provides context about RepoRadar
3. Gemini generates a contextual, helpful response
4. The response is returned to you in seconds

### Context Awareness

The AI assistant is aware of:

- **Your current page** (if relevant to the question)
- **RepoRadar's features** and how they work
- **Common user workflows** and patterns
- **Troubleshooting steps** for issues
- **Documentation references** for detailed information

## What the AI Assistant Can Help With

### Feature Questions

**Examples:**
- "How do I analyze a repository?"
- "What does the Originality metric measure?"
- "How many repositories can I analyze in batch mode?"
- "What's the difference between Pro and Enterprise?"

### How-To Guides

**Examples:**
- "How do I create a collection?"
- "How do I export results to PDF?"
- "How do I use advanced search filters?"
- "How do I find similar repositories?"

### Troubleshooting

**Examples:**
- "My analysis is stuck, what should I do?"
- "I can't sign in, how do I fix this?"
- "Why am I getting a rate limit error?"
- "The export isn't working, help!"

### Comparisons

**Examples:**
- "What's the difference between finding similar by metrics vs functionality?"
- "Should I use batch analysis or compare feature?"
- "How is RepoRadar different from GitHub Insights?"

### Best Practices

**Examples:**
- "What's the best way to evaluate competing libraries?"
- "How should I organize my repositories?"
- "What filters should I use to find quality projects?"

### Technical Questions

**Examples:**
- "How do I self-host RepoRadar?"
- "What are the API rate limits?"
- "How do I integrate with my CI/CD pipeline?"
- "What environment variables do I need?"

## Limitations

### What the AI Assistant Cannot Do

1. **Access your account data** - Cannot see your specific analyses, collections, or settings
2. **Perform actions** - Cannot analyze repositories, create collections, or modify settings for you
3. **Access external systems** - Cannot check GitHub, your database, or other services
4. **Provide real-time status** - Cannot check if services are currently down
5. **Make account changes** - Cannot upgrade subscriptions, change billing, or modify account settings

### When to Contact Support Instead

Contact support@reporadar.com for:

- **Account-specific issues** (billing, subscription, access)
- **Bug reports** (reproducible errors, unexpected behavior)
- **Feature requests** (suggestions for new features)
- **Enterprise inquiries** (custom pricing, SLA, contracts)
- **Security concerns** (vulnerabilities, data issues)
- **Persistent technical issues** (after trying AI assistant suggestions)

## Keeping the AI Assistant Updated

### How Knowledge is Maintained

The AI assistant's knowledge is maintained through:

1. **System prompt updates** - When new features are added
2. **Documentation sync** - Keeping prompt aligned with docs
3. **User feedback** - Improving responses based on common questions
4. **Testing** - Verifying accuracy of responses

### Current Version

- **Last Updated**: January 2025
- **Knowledge Base Version**: 2.0
- **Covers**: All features through Phase 3 implementation
- **Includes**: Full feature set, troubleshooting, API documentation

## Documentation vs AI Assistant

### When to Use the AI Assistant

Use the AI assistant for:

- **Quick questions** - Fast answers without searching
- **Clarifications** - Understanding specific features
- **Troubleshooting** - Immediate help with issues
- **How-to guidance** - Step-by-step instructions
- **Conversational help** - Natural language questions

### When to Use Documentation

Use the documentation for:

- **Comprehensive guides** - In-depth feature explanations
- **Reference material** - Complete API documentation
- **Code examples** - Detailed implementation samples
- **Visual guides** - Screenshots and diagrams
- **Offline access** - Reading without internet

### Best Approach

For optimal results:

1. **Start with AI Assistant** - Quick questions and immediate help
2. **Reference documentation** - For detailed guides and examples
3. **Contact support** - For account-specific or persistent issues

## Available Documentation

### Getting Started
- [Installation Guide](./getting-started/installation.md) - Setup and configuration
- [Quick Start](./getting-started/quick-start.md) - First analysis in 5 minutes
- [Overview](./getting-started/index.md) - Platform introduction

### Feature Guides
- [Repository Analysis](./features/repository-analysis.md) - Detailed metric explanations
- [Batch Analysis](./features/batch-analysis.md) - Multi-repository analysis
- [Similar Repositories](./features/similar-repositories.md) - Discovery features
- [Analytics Dashboard](./features/analytics-dashboard.md) - Usage tracking
- [Features Overview](./features/index.md) - All features

### Reference
- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Quick Reference](./QUICK_REFERENCE.md) - Cheat sheet
- [FAQ](./faq/index.md) - Common questions

### Troubleshooting
- [Common Issues](./troubleshooting/common-issues.md) - Detailed solutions
- [Troubleshooting Guide](./troubleshooting/index.md) - Quick fixes

### Technical Guides
- [Performance Configuration](./PERFORMANCE_CONFIGURATION.md) - Optimization
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md) - Security
- [Multi-Instance Deployment](./MULTI_INSTANCE_DEPLOYMENT.md) - Scaling
- [Rate Limiting](./RATE_LIMITING.md) - API limits
- [Feature Flags](./FEATURE_FLAGS_GUIDE.md) - Feature management

## Feedback

### Improving the AI Assistant

Help us improve by:

1. **Rating responses** - Thumbs up/down on answers
2. **Reporting issues** - When answers are incorrect
3. **Suggesting improvements** - What could be better
4. **Sharing use cases** - How you use the assistant

### Contact

- **General feedback**: feedback@reporadar.com
- **AI Assistant issues**: support@reporadar.com
- **Documentation issues**: docs@reporadar.com

## Summary

The RepoRadar AI Assistant is a powerful, context-aware helper that knows everything about the platform. It's powered by Google's Gemini 2.5 Pro and maintained through a comprehensive system prompt that's regularly updated.

**Use it for:**
- Quick answers
- How-to guidance
- Troubleshooting
- Feature explanations
- Best practices

**It's available 24/7** in the bottom-right corner of every page!

---

*For more information, see the [full documentation](./getting-started/index.md) or ask the AI Assistant directly!*
