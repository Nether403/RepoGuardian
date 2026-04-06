/**
 * Interface for code splitting functionality
 */
export interface ICodeSplitter {
  /**
   * Dynamically load a component chunk
   * @param chunkName - Name of the chunk to load
   * @returns Promise that resolves to the loaded component
   */
  loadChunk<T = any>(chunkName: string): Promise<T>;

  /**
   * Preload a component chunk
   * @param chunkName - Name of the chunk to preload
   * @returns Promise that resolves when chunk is preloaded
   */
  preloadChunk(chunkName: string): Promise<void>;

  /**
   * Get loading status of a chunk
   * @param chunkName - Name of the chunk
   * @returns Loading status
   */
  getChunkStatus(chunkName: string): 'loading' | 'loaded' | 'error' | 'idle';

  /**
   * Get all loaded chunks
   * @returns Array of loaded chunk names
   */
  getLoadedChunks(): string[];
}

/**
 * Interface for lazy loading functionality
 */
export interface ILazyLoader {
  /**
   * Register a component for lazy loading
   * @param componentId - Unique identifier for the component
   * @param loader - Function that returns the component
   * @param options - Lazy loading options
   */
  register<T = any>(
    componentId: string,
    loader: () => Promise<T>,
    options?: LazyLoadOptions
  ): void;

  /**
   * Load a component when it enters the viewport
   * @param componentId - Component identifier
   * @param element - DOM element to observe
   */
  observeElement(componentId: string, element: HTMLElement): void;

  /**
   * Manually trigger loading of a component
   * @param componentId - Component identifier
   */
  loadComponent<T = any>(componentId: string): Promise<T>;

  /**
   * Unregister a component
   * @param componentId - Component identifier
   */
  unregister(componentId: string): void;
}

/**
 * Interface for bundle optimization
 */
export interface IBundleOptimizer {
  /**
   * Analyze bundle size and composition
   * @returns Bundle analysis data
   */
  analyzeBundles(): Promise<BundleAnalysis>;

  /**
   * Get optimization recommendations
   * @returns Array of optimization suggestions
   */
  getOptimizationRecommendations(): OptimizationRecommendation[];

  /**
   * Apply tree shaking optimizations
   * @param config - Tree shaking configuration
   */
  applyTreeShaking(config: TreeShakingConfig): void;

  /**
   * Configure asset caching
   * @param config - Caching configuration
   */
  configureCaching(config: CachingConfig): void;
}

/**
 * Options for lazy loading
 */
export interface LazyLoadOptions {
  /** Threshold for intersection observer (0-1) */
  threshold?: number;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Whether to load immediately on registration */
  immediate?: boolean;
  /** Fallback component to show while loading */
  fallback?: React.ComponentType;
}

/**
 * Bundle analysis data
 */
export interface BundleAnalysis {
  /** Total bundle size in bytes */
  totalSize: number;
  /** Individual chunk sizes */
  chunks: ChunkInfo[];
  /** Unused code analysis */
  unusedCode: UnusedCodeInfo[];
  /** Dependency analysis */
  dependencies: DependencyInfo[];
}

/**
 * Information about a code chunk
 */
export interface ChunkInfo {
  /** Chunk name */
  name: string;
  /** Size in bytes */
  size: number;
  /** Gzipped size in bytes */
  gzipSize: number;
  /** Modules included in chunk */
  modules: string[];
}

/**
 * Information about unused code
 */
export interface UnusedCodeInfo {
  /** File path */
  file: string;
  /** Unused exports */
  unusedExports: string[];
  /** Estimated size savings */
  sizeSavings: number;
}

/**
 * Information about dependencies
 */
export interface DependencyInfo {
  /** Package name */
  name: string;
  /** Size in bytes */
  size: number;
  /** Whether it's used */
  used: boolean;
  /** Import path */
  importPath: string;
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  /** Type of optimization */
  type: 'tree-shaking' | 'code-splitting' | 'lazy-loading' | 'caching';
  /** Description of the recommendation */
  description: string;
  /** Estimated size savings */
  estimatedSavings: number;
  /** Priority level */
  priority: 'high' | 'medium' | 'low';
}

/**
 * Tree shaking configuration
 */
export interface TreeShakingConfig {
  /** Enable aggressive tree shaking */
  aggressive?: boolean;
  /** Modules to exclude from tree shaking */
  exclude?: string[];
  /** Side effects configuration */
  sideEffects?: boolean | string[];
}

/**
 * Caching configuration
 */
export interface CachingConfig {
  /** Cache duration for static assets */
  staticAssetsCacheDuration?: number;
  /** Cache duration for JavaScript bundles */
  jsBundlesCacheDuration?: number;
  /** Cache duration for CSS files */
  cssCacheDuration?: number;
  /** Enable service worker caching */
  serviceWorkerEnabled?: boolean;
}

/**
 * Interface for frontend fallback management
 */
export interface IFrontendFallbackManager {
  /**
   * Register synchronous fallback components for code splitting
   * @param components - Map of chunk names to synchronous components
   */
  registerSynchronousComponents(components: Record<string, React.ComponentType<any>>): void;

  /**
   * Register immediate fallback components for lazy loading
   * @param componentId - Component identifier
   * @param component - Fallback component
   */
  registerImmediateComponents(componentId: string, component: React.ComponentType<any>): void;

  /**
   * Load chunk with synchronous fallback strategy
   * @param chunkName - Name of the chunk to load
   * @returns Promise that resolves to the loaded component
   */
  loadChunkWithFallback<T = any>(chunkName: string): Promise<T>;

  /**
   * Load component with immediate rendering fallback strategy
   * @param componentId - Component identifier
   * @returns Promise that resolves to the loaded component
   */
  loadComponentWithFallback<T = any>(componentId: string): Promise<T>;

  /**
   * Create a fallback-enabled code splitter wrapper
   * @returns Code splitter with fallback capabilities
   */
  createFallbackCodeSplitter(): ICodeSplitter;

  /**
   * Create a fallback-enabled lazy loader wrapper
   * @returns Lazy loader with fallback capabilities
   */
  createFallbackLazyLoader(): ILazyLoader;

  /**
   * Get fallback statistics
   * @returns Statistics about fallback usage
   */
  getFallbackStats(): {
    totalEvents: number;
    codeSplittingFallbacks: number;
    lazyLoadingFallbacks: number;
    retryAttempts: number;
    successfulFallbacks: number;
  };

  /**
   * Check if fallback is available for a component
   * @param type - Type of fallback
   * @param componentId - Component identifier
   * @returns Whether fallback is available
   */
  hasFallback(type: 'code-splitting' | 'lazy-loading', componentId: string): boolean;
}