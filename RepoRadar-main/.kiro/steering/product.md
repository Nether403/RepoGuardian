# Product Overview

RepoRadar is a high-performance, full-stack web application that provides AI-powered analysis of GitHub repositories.

## Core Purpose

Help users discover, analyze, and compare GitHub repositories based on key metrics:
- Originality
- Completeness
- Marketability
- Monetization potential
- Usefulness

## AI Infrastructure

RepoRadar uses a dual-AI system for maximum reliability:
- **Primary**: Google Gemini 2.5 Pro for fast, cost-effective analysis
- **Fallback**: OpenAI GPT-5 automatically takes over if Gemini encounters issues
- **Graceful Degradation**: Basic metric-based analysis if both AI services are unavailable

## Key Features

### Analysis
- AI-powered repository analysis using dual-AI system (Gemini 2.5 Pro + GPT-5 fallback)
- Batch analysis with progress tracking
- Find similar repositories
- Export results (PDF/CSV)

### User Experience
- Interactive onboarding
- Bookmarks and collections
- AI assistant with context-aware help
- Advanced search and filtering

### Enterprise
- API access with rate limiting
- Analytics dashboard
- Integration hub (GitHub, GitLab, Slack, Discord, Jira, CI/CD)
- Subscription management via Stripe
- Multi-instance deployment support

### Performance
- Database optimization with connection pooling
- Multi-layer caching (memory/Redis)
- Response compression (gzip/brotli)
- GitHub API optimization
- Frontend code splitting and lazy loading

## Target Users

Developers, teams, and organizations looking to evaluate and discover GitHub repositories for various purposes including technology selection, competitive analysis, and project discovery.
