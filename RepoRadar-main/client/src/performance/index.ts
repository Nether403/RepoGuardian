// Code splitting exports
export { CodeSplitter, codeSplitter } from './CodeSplitter';
export { createLazyRoute, preloadRoute, useRoutePreloader } from './LazyRoute';

// Lazy loading exports
export { LazyLoader, lazyLoader } from './LazyLoader';
export { LazyComponent, useLazyComponent, withLazyLoading } from './LazyComponent';

// Bundle optimization exports
export { BundleOptimizer, bundleOptimizer } from './BundleOptimizer';
export { ServiceWorkerManager, serviceWorkerManager } from './ServiceWorkerManager';

// Fallback management exports
export { FrontendFallbackManager, frontendFallbackManager } from './FrontendFallbackManager';
export { 
  createFallbackLazyRoute, 
  preloadRouteWithFallback, 
  useFallbackRoutePreloader,
  useRouteFallbackStats,
  FallbackStatsDisplay
} from './FallbackLazyRoute';
export { 
  FallbackLazyComponent, 
  useFallbackLazyComponent, 
  withFallbackLazyLoading,
  LazyLoadingFallbackStats
} from './FallbackLazyComponent';

// Interface exports
export type {
  ICodeSplitter,
  ILazyLoader,
  IBundleOptimizer,
  IFrontendFallbackManager,
  LazyLoadOptions,
  BundleAnalysis,
  ChunkInfo,
  UnusedCodeInfo,
  DependencyInfo,
  OptimizationRecommendation,
  TreeShakingConfig,
  CachingConfig
} from './interfaces';