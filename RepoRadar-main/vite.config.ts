import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  plugins: [
    react(),
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    },
  },
  define: {
    'import.meta.env.VITE_STACK_PROJECT_ID': JSON.stringify(process.env.NEXT_PUBLIC_STACK_PROJECT_ID),
    'import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY': JSON.stringify(process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY),
    // Polyfill global for gray-matter
    global: 'globalThis',
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      // Mock Next.js modules for Stack Auth compatibility
      "next/navigation": path.resolve(import.meta.dirname, "client/src/lib/next-navigation-mock.ts"),
      "next/link": path.resolve(import.meta.dirname, "client/src/lib/next-link-mock.tsx"),
      "next/headers": path.resolve(import.meta.dirname, "client/src/lib/next-headers-mock.ts"),
      // Polyfill Buffer for gray-matter
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    // Exclude Stack Auth server components from optimization
    exclude: ['@stackframe/stack-sc', '@stackframe/stack'],
    include: ['tiny-case', 'property-expr', 'toposort', 'normalize-wheel', 'buffer'],
    esbuildOptions: {
      // Resolve Next.js modules to our mocks during optimization
      alias: {
        'next/navigation': path.resolve(import.meta.dirname, "client/src/lib/next-navigation-mock.ts"),
        'next/link': path.resolve(import.meta.dirname, "client/src/lib/next-link-mock.tsx"),
        'next/headers': path.resolve(import.meta.dirname, "client/src/lib/next-headers-mock.ts"),
      },
      define: {
        global: 'globalThis',
      },
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['wouter'],
          'vendor-query': ['@tanstack/react-query'],
        },
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        }
      }
    },
    // Enable tree shaking
    minify: 'esbuild',
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging
    sourcemap: process.env.NODE_ENV !== 'production'
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
