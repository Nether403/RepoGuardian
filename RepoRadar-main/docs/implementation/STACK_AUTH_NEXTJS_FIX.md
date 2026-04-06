# Stack Auth Next.js Compatibility Fix

## Problem

The app was crashing on navigation with errors:
```
Could not resolve "next/navigation"
Could not resolve "next/link"
Could not resolve "next/headers"
```

**Root Cause**: Even though you selected **React** mode when setting up Neon Auth with Stack Auth, the `@stackframe/stack` npm package has internal dependencies on Next.js modules. This is because Stack Auth's codebase includes both React and Next.js implementations in the same package, and Vite tries to optimize all of it.

## Solution

Created mock implementations of Next.js modules and configured Vite to use them, plus updated Stack Auth server configuration to use React-compatible settings.

### 1. Created Mock Files

**`client/src/lib/next-navigation-mock.ts`**
- Mocks `redirect()`, `notFound()`, `useRouter()`, `usePathname()`, `useSearchParams()`, `useParams()`
- Uses Wouter for routing functionality
- Maintains Stack Auth's expected behavior

**`client/src/lib/next-link-mock.tsx`**
- Mocks Next.js `Link` component
- Wraps Wouter's `Link` component
- Provides compatible API

**`client/src/lib/next-headers-mock.ts`**
- Mocks server-side Next.js functions
- Provides no-op implementations for `headers()`, `cookies()`, `draftMode()`
- These are server-only functions not needed in client

### 2. Updated Vite Configuration

Added to `vite.config.ts`:

```typescript
resolve: {
  alias: {
    // ... existing aliases
    "next/navigation": path.resolve(import.meta.dirname, "client/src/lib/next-navigation-mock.ts"),
    "next/link": path.resolve(import.meta.dirname, "client/src/lib/next-link-mock.tsx"),
    "next/headers": path.resolve(import.meta.dirname, "client/src/lib/next-headers-mock.ts"),
  },
},
optimizeDeps: {
  exclude: ['@stackframe/stack-sc', '@stackframe/stack'],
  esbuildOptions: {
    alias: {
      'next/navigation': path.resolve(import.meta.dirname, "client/src/lib/next-navigation-mock.ts"),
      'next/link': path.resolve(import.meta.dirname, "client/src/lib/next-link-mock.tsx"),
      'next/headers': path.resolve(import.meta.dirname, "client/src/lib/next-headers-mock.ts"),
    },
  },
},
```

### 3. Updated Stack Auth Server Configuration

Changed `server/auth/oauthService.ts`:

```typescript
// Before (Next.js specific):
tokenStore: 'nextjs-cookie'

// After (React compatible):
tokenStore: 'cookie'
```

## How It Works

1. When Stack Auth tries to import Next.js modules, Vite redirects to our mocks
2. Mocks provide compatible APIs using Wouter (our actual router)
3. Stack Auth functions normally without knowing it's not in Next.js
4. Server-side Next.js functions are stubbed out (not needed in client)

## Testing

After applying this fix:
1. Restart the dev server: `npm run dev`
2. Navigate between pages - should work without crashes
3. Stack Auth authentication flows should work normally

## Additional Notes

- The `JobMetricsData` export error during shutdown is unrelated and happens during graceful shutdown
- This is a clean solution that doesn't modify Stack Auth's code
- All Stack Auth features should work as expected
- If Stack Auth updates break compatibility, only the mock files need updating

## Alternative Approaches Considered

1. **Switching to Next.js**: Too disruptive, would require complete rewrite
2. **Removing Stack Auth**: Would lose authentication features
3. **Patching node_modules**: Fragile and breaks on updates
4. **Using module resolution plugins**: More complex, harder to maintain

The mock approach is clean, maintainable, and doesn't interfere with Stack Auth's functionality.
