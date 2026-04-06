# Overview

RepoRadar is a full-stack web application that provides AI-powered analysis of GitHub repositories. The platform helps users discover, analyze, and compare repositories based on key metrics including originality, completeness, marketability, monetization potential, and usefulness. Built with modern web technologies, it leverages Google's Gemini 2.5 Pro AI for comprehensive repository insights and includes features like advanced analytics, code review, integrations, and developer tools.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite 6 as the build tool
- **Routing**: Wouter for client-side routing with support for both authenticated and public routes
- **UI Components**: Shadcn/ui component library built on Radix UI primitives with Tailwind CSS styling
- **State Management**: TanStack Query (React Query v5) for server state management and caching
- **Styling**: Tailwind CSS with custom CSS variables for theming, supporting both light and dark modes
- **Icons**: Lucide React icons and react-icons
- **Charts**: Recharts for data visualization including radar charts, bar charts, and line charts
- **Animations**: Framer Motion 11 and GSAP for animations

## Backend Architecture
- **Runtime**: Node.js with Express.js 4 framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM 0.39 for type-safe database operations
- **Authentication**: Custom password authentication with bcrypt, optional Stack Auth OAuth
- **Session Management**: Express sessions with PostgreSQL-backed store, optional Redis sessions
- **Background Jobs**: BullMQ with Redis for batch analysis and export jobs (optional)
- **Real-time**: Socket.io for notifications and job progress (optional)
- **Security**: Helmet for headers, CORS middleware, rate limiting (memory or Redis-backed)
- **API Design**: RESTful API with structured error handling, logging, and compression middleware

## AI Integration
- **Primary AI**: Google Gemini 2.5 Pro (@google/genai) for repository analysis
- **Fallback AI**: OpenAI as fallback provider
- **Analysis Engine**: Comprehensive repository evaluation across 5 key metrics with detailed scoring
- **AI Assistant**: Context-aware help system

## Data Storage
- **Primary Database**: PostgreSQL with Neon serverless connector
- **ORM**: Drizzle with drizzle-kit for schema management (db:push)
- **Session Storage**: PostgreSQL-backed session store with configurable TTL
- **Caching**: In-memory caching (optional Redis-backed)

## Authentication & Authorization
- **Password Auth**: bcrypt-based password hashing (BCRYPT_ROUNDS=12)
- **OAuth**: Optional Stack Auth integration (Google/GitHub providers)
- **Session Management**: Express sessions with secure HTTP-only cookies
- **Access Control**: Route-level authentication middleware
- **User Management**: Profile management with subscription tiers

## Payments
- **Stripe**: Payment processing for Pro and Enterprise subscriptions (optional)
- **PayPal**: Alternative payment processing option (optional)

## External Dependencies

- **GitHub API**: Repository data fetching and search functionality
- **Google Gemini AI**: Advanced AI analysis and natural language processing
- **Stripe**: Payment processing with webhook handling (optional)
- **PayPal**: Alternative payment processing (optional)
- **Neon Database**: Serverless PostgreSQL hosting
- **Recharts**: Data visualization and analytics dashboards

# Environment Configuration

## Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `SESSION_SECRET` - Secret for session signing
- `SESSION_ENCRYPTION_KEY` - 64-char hex key for session encryption
- `BCRYPT_ROUNDS` - Password hashing rounds (default: 12)
- `RATE_LIMIT_STORAGE` - Rate limiting backend: "memory", "redis", or "postgres"

## Optional Environment Variables
- `GEMINI_API_KEY` - Google Gemini AI API key
- `OPENAI_API_KEY` - OpenAI fallback API key
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` - Stripe payment keys
- `REDIS_URL` - Redis connection for sessions/caching/jobs
- `FORCE_HTTPS` - Enable HTTPS enforcement (default: false in dev)

## Development Setup
- Port: 5000 (serves both API and Vite dev server)
- CORS: Automatically includes Replit preview domains in development
- Workflow: `npm run dev` via cross-env sets NODE_ENV=development

# Key Files and Directories

- `client/src/` - React frontend source
- `client/src/pages/` - Page components (Home, Analyze, Search, Dashboard, etc.)
- `client/src/components/` - Reusable UI components
- `server/` - Express backend source
- `server/routes.ts` - API route definitions
- `server/middleware/cors.ts` - CORS configuration (includes Replit domains)
- `server/config/validation.ts` - Startup configuration validation
- `server/stripe.ts` - Stripe payment integration
- `server/advancedAnalytics.ts` - Advanced analytics queries
- `shared/schema.ts` - Drizzle database schema and types
- `docs/` - Project documentation

# Last Updated

March 29, 2026 - Dependencies updated to latest compatible versions, TypeScript type errors fixed in server analytics and middleware, CORS configured for Replit environment, Stripe API version updated to 2025-08-27.basil.