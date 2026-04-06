# Installation Guide

## Prerequisites

Before installing RepoRadar, ensure you have:

- **Node.js** 18 or higher
- **npm** or **yarn** package manager
- **PostgreSQL** database (we recommend [Neon](https://neon.tech) for serverless PostgreSQL)
- **Google Gemini API key** (get one at [Google AI Studio](https://makersuite.google.com/app/apikey))

### Optional Services
- **Redis** for caching (optional, falls back to memory cache)
- **Stripe** account for payment processing (optional)
- **GitHub Personal Access Token** for higher API rate limits (optional)

## Quick Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd reporadar
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure the required variables:

```env
# Required
DATABASE_URL=postgresql://user:password@host:5432/database
GEMINI_API_KEY=your_gemini_api_key_here

# Optional but recommended
GITHUB_TOKEN=your_github_token_here
REDIS_URL=redis://localhost:6379

# Optional for payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Environment
NODE_ENV=development
PORT=5000
```

### 4. Set Up the Database

Push the database schema:

```bash
npm run db:push
```

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Production Deployment

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm run start
```

### Docker Deployment

Build and run with Docker:

```bash
npm run deploy:docker
```

For multi-instance deployment with load balancing:

```bash
docker-compose up -d
```

See [Multi-Instance Deployment Guide](../MULTI_INSTANCE_DEPLOYMENT.md) for details.

## Verification

After installation, verify everything is working:

1. **Health Check**: Visit `http://localhost:5000/health`
2. **Configuration**: Run `npm run config:validate`
3. **Database**: Check connection with `npm run health:check`

## Troubleshooting

### Database Connection Issues

If you see database connection errors:

1. Verify `DATABASE_URL` is correct
2. Ensure PostgreSQL is running
3. Check firewall settings
4. For Neon, verify your IP is allowed

### Gemini API Issues

If AI features aren't working:

1. Verify `GEMINI_API_KEY` is set correctly
2. Check API quota at [Google AI Studio](https://makersuite.google.com)
3. Ensure you're using Gemini 2.5 Pro model

### Port Already in Use

If port 5000 is already in use:

```bash
# Change PORT in .env
PORT=3000
```

## Next Steps

- [Quick Start Guide](./quick-start.md) - Learn the basics
- [Configuration Guide](../PERFORMANCE_CONFIGURATION.md) - Optimize performance
- [API Documentation](../API_DOCUMENTATION.md) - Integrate with your apps

## Getting Help

- Check [FAQ](../faq/index.md) for common questions
- See [Troubleshooting Guide](../troubleshooting/index.md) for solutions
- Review [Documentation](../README.md) for detailed guides
