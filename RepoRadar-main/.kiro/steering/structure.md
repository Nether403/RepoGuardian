# Project Structure

## Root Organization

```
/
├── client/          # Frontend React application
├── server/          # Backend Express application
├── shared/          # Shared code between client and server
├── config/          # Configuration files
├── docs/            # Documentation
├── scripts/         # Build and deployment scripts
├── tests/           # Integration and E2E tests
└── docker/          # Docker configuration
```

## Client Structure (`/client`)

```
client/
├── src/
│   ├── components/  # React components
│   ├── hooks/       # Custom React hooks
│   ├── lib/         # Utility functions
│   ├── pages/       # Page components
│   └── main.tsx     # Application entry point
├── public/          # Static assets
└── index.html       # HTML template
```

### Path Aliases
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

## Server Structure (`/server`)

```
server/
├── index.ts              # Server entry point
├── routes.ts             # API route definitions
├── db.ts                 # Database connection
├── storage.ts            # Database operations
├── gemini.ts             # AI integration
├── github.ts             # GitHub API integration
├── stripe.ts             # Payment processing
├── neonAuth.ts           # Authentication
├── health.ts             # Health check endpoints
├── analytics.ts          # Analytics service
├── admin.ts              # Admin dashboard
├── middleware/           # Express middleware
│   ├── rateLimiter.ts
│   ├── validation.ts
│   ├── pagination.ts
│   ├── analytics.ts
│   └── featureFlags.ts
├── jobs/                 # Background job processing
├── performance/          # Performance monitoring
├── monitoring/           # System monitoring
├── utils/                # Utility functions
└── __tests__/            # Server tests
```

## Shared Code (`/shared`)

```
shared/
├── schema.ts        # Database schema (Drizzle)
├── errors.ts        # Error definitions
├── featureFlags.ts  # Feature flag definitions
└── __tests__/       # Shared code tests
```

## Key Conventions

### File Naming
- React components: PascalCase (e.g., `RepositoryCard.tsx`)
- Utilities/services: camelCase (e.g., `errorHandler.ts`)
- Tests: `*.test.ts` or `*.test.tsx`
- Types: Defined inline or in same file as implementation

### Code Organization
- **Server routes**: Defined in `server/routes.ts`, organized by feature
- **Database schema**: Single source of truth in `shared/schema.ts`
- **API endpoints**: RESTful, prefixed with `/api`
- **Middleware**: Applied in order: auth → analytics → feature flags → rate limiting → validation

### Import Patterns
- Use path aliases for cleaner imports
- ES modules only (no CommonJS)
- Explicit file extensions in server code when needed

### Database
- **ORM**: Drizzle ORM with type-safe queries
- **Migrations**: Schema changes via `drizzle-kit push`
- **Relations**: Defined in schema with Drizzle relations
- **Indexes**: Defined in schema for performance

### API Design
- RESTful endpoints
- Consistent error responses
- Pagination for list endpoints
- Rate limiting per endpoint type
- Validation using Zod schemas

### Testing
- Unit tests alongside implementation
- Integration tests in `/tests`
- E2E tests in `/tests`
- Performance tests in `/tests`
- Test utilities in `server/__tests__` and `shared/__tests__`

### Performance
- Database connection pooling
- Multi-layer caching (memory/Redis)
- Response compression
- Code splitting and lazy loading
- Performance monitoring and alerting

### Deployment
- Single port (5000) for both API and client
- Environment-based configuration
- Docker support with multi-instance scaling
- Health check endpoints for orchestration
- Graceful shutdown handling

## Documentation

- **API docs**: `docs/API_DOCUMENTATION.md`
- **Feature guides**: `docs/*_GUIDE.md`
- **Quick starts**: `*_QUICK_START.md` in root
- **Implementation details**: `docs/PHASE_3_IMPLEMENTATION_GUIDE.md`
- **Performance**: `docs/PERFORMANCE_CONFIGURATION.md`
