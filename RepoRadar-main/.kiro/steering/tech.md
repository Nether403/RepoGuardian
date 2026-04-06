# Technology Stack

## Frontend

### Core
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 7
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query for server state and caching

### UI & Styling
- **Component Library**: Radix UI with shadcn/ui design system
- **Styling**: Tailwind CSS 3
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Performance
- Code splitting (route and component-based)
- Lazy loading with intersection observer
- Bundle optimization with tree shaking
- Service worker caching (optional)

## Backend

### Core
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript with ES modules
- **Session Management**: PostgreSQL-backed sessions

### Database
- **Primary**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM for type-safe operations
- **Migrations**: Drizzle Kit

### Caching & Jobs
- **Cache**: Redis (optional, with memory fallback)
- **Job Queue**: BullMQ for background processing
- **WebSockets**: Socket.io with Redis adapter

### AI & External Services
- **Primary AI Provider**: Google Gemini 2.5 Pro
- **Fallback AI Provider**: OpenAI GPT-5 (optional)
- **GitHub API**: Octokit
- **Payments**: Stripe
- **Authentication**: Replit OIDC with Passport.js

## Development Tools

### Code Quality
- **Linting**: ESLint with TypeScript plugin
- **Type Checking**: TypeScript strict mode enabled
- **Testing**: Vitest with Testing Library
- **Test Coverage**: >95% target

### Build & Deploy
- **Build**: esbuild for server, Vite for client
- **Containerization**: Docker with multi-instance support
- **Load Balancing**: Nginx (for multi-instance deployments)

## Common Commands

### Development
```bash
npm run dev              # Start development server
npm run check            # TypeScript type checking
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
```

### Database
```bash
npm run db:push          # Push schema changes to database
```

### Testing
```bash
npm run test             # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:ui          # Run tests with UI
npm run test:performance # Run performance benchmarks
npm run test:e2e         # Run end-to-end tests
```

### Build & Deploy
```bash
npm run build            # Build for production
npm run start            # Start production server
npm run deploy           # Deploy (Linux/macOS)
npm run deploy:windows   # Deploy (Windows)
npm run deploy:docker    # Deploy with Docker
```

### Configuration & Monitoring
```bash
npm run config:validate  # Validate configuration
npm run config:summary   # View configuration summary
npm run health:check     # Check server health
npm run lighthouse       # Run Lighthouse audit
```

## Environment Variables

Key environment variables (see `.env.example` for full list):
- `DATABASE_URL` - PostgreSQL connection string (required)
- `GEMINI_API_KEY` - Google Gemini API key (required for primary AI)
- `OPENAI_API_KEY` - OpenAI API key (optional, for AI fallback)
- `GITHUB_TOKEN` - GitHub API token (optional, for higher rate limits)
- `REDIS_URL` - Redis connection string (optional)
- `STRIPE_SECRET_KEY` - Stripe secret key (optional)
- `NODE_ENV` - Environment (development/staging/production)

## Performance Configuration

All performance settings can be configured via environment variables:
- Database pooling and query monitoring
- Cache configuration (memory/Redis/hybrid)
- Compression settings (gzip/brotli)
- GitHub API optimization
- Frontend performance features

See `docs/PERFORMANCE_CONFIGURATION.md` for detailed configuration options.
