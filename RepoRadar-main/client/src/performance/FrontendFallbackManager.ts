import { ICodeSplitter, ILazyLoader } from './interfaces';
import { codeSplitter } from './CodeSplitter';
import { lazyLoader } from './LazyLoader';

/**
 * Configuration for frontend fallback strategies
 */
export interface FrontendFallbackConfig {
  /** Enable synchronous loading fallback for code splitting */
  enableCodeSplittingFallback: boolean;
  /** Enable immediate rendering fallback for lazy loading */
  enableLazyLoadingFallback: boolean;
  /** Maximum retry attempts for failed loads */
  maxRetryAttempts: number;
  /** Delay between retry attempts in milliseconds */
  retryDelay: number;
  /** Enable fallback logging */
  enableLogging: boolean;
}

/**
 * Fallback strategy types
 */
export type FallbackStrategy = 'synchronous' | 'immediate' | 'retry' | 'error';

/**
 * Fallback event data
 */
export interface FallbackEvent {
  type: 'code-splitting' | 'lazy-loading';
  strategy: FallbackStrategy;
  componentId: string;
  error: Error;
  timestamp: Date;
  retryAttempt?: number;
}

/**
 * Synchronous component loader for fallback scenarios
 */
export interface SynchronousLoader {
  [key: string]: React.ComponentType<any>;
}

/**
 * Manager for frontend loading fallback strategies
 */
export class FrontendFallbackManager {
  private config: FrontendFallbackConfig;
  private codeSplitter: ICodeSplitter;
  private lazyLoader: ILazyLoader;
  private fallbackEvents: FallbackEvent[] = [];
  private retryAttempts = new Map<string, number>();
  private synchronousComponents: SynchronousLoader = {};
  private immediateComponents = new Map<string, React.ComponentType<any>>();

  constructor(
    config: Partial<FrontendFallbackConfig> = {},
    codeSplitterInstance: ICodeSplitter = codeSplitter,
    lazyLoaderInstance: ILazyLoader = lazyLoader
  ) {
    this.config = {
      enableCodeSplittingFallback: true,
      enableLazyLoadingFallback: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      enableLogging: true,
      ...config
    };
    
    this.codeSplitter = codeSplitterInstance;
    this.lazyLoader = lazyLoaderInstance;
  }

  /**
   * Register synchronous fallback components for code splitting
   */
  registerSynchronousComponents(components: SynchronousLoader): void {
    this.synchronousComponents = { ...this.synchronousComponents, ...components };
    
    if (this.config.enableLogging) {
      console.log('Registered synchronous fallback components:', Object.keys(components));
    }
  }

  /**
   * Register immediate fallback components for lazy loading
   */
  registerImmediateComponents(componentId: string, component: React.ComponentType<any>): void {
    this.immediateComponents.set(componentId, component);
    
    if (this.config.enableLogging) {
      console.log(`Registered immediate fallback component: ${componentId}`);
    }
  }

  /**
   * Load chunk with synchronous fallback strategy
   */
  async loadChunkWithFallback<T = any>(chunkName: string): Promise<T> {
    const attemptKey = `chunk-${chunkName}`;
    const currentAttempts = this.retryAttempts.get(attemptKey) || 0;

    try {
      // Try normal code splitting first
      const chunk = await this.codeSplitter.loadChunk<T>(chunkName);
      
      // Reset retry attempts on success
      this.retryAttempts.delete(attemptKey);
      
      return chunk;
    } catch (error) {
      const fallbackError = error instanceof Error ? error : new Error('Code splitting failed');
      
      // Log the fallback event
      this.logFallbackEvent({
        type: 'code-splitting',
        strategy: 'synchronous',
        componentId: chunkName,
        error: fallbackError,
        timestamp: new Date(),
        retryAttempt: currentAttempts
      });

      // Try synchronous fallback if enabled and available
      if (this.config.enableCodeSplittingFallback && this.synchronousComponents[chunkName]) {
        if (this.config.enableLogging) {
          console.warn(`Code splitting failed for ${chunkName}, using synchronous fallback:`, fallbackError);
        }
        
        return this.synchronousComponents[chunkName] as T;
      }

      // Try retry strategy if we haven't exceeded max attempts
      if (currentAttempts < this.config.maxRetryAttempts) {
        this.retryAttempts.set(attemptKey, currentAttempts + 1);
        
        if (this.config.enableLogging) {
          console.warn(`Retrying code splitting for ${chunkName} (attempt ${currentAttempts + 1}/${this.config.maxRetryAttempts})`);
        }

        // Wait before retrying
        await this.delay(this.config.retryDelay * Math.pow(2, currentAttempts));
        
        return this.loadChunkWithFallback<T>(chunkName);
      }

      // All fallback strategies failed
      if (this.config.enableLogging) {
        console.error(`All fallback strategies failed for chunk ${chunkName}:`, fallbackError);
      }
      
      throw fallbackError;
    }
  }

  /**
   * Load component with immediate rendering fallback strategy
   */
  async loadComponentWithFallback<T = any>(componentId: string): Promise<T> {
    const attemptKey = `component-${componentId}`;
    const currentAttempts = this.retryAttempts.get(attemptKey) || 0;

    try {
      // Try normal lazy loading first
      const component = await this.lazyLoader.loadComponent<T>(componentId);
      
      // Reset retry attempts on success
      this.retryAttempts.delete(attemptKey);
      
      return component;
    } catch (error) {
      const fallbackError = error instanceof Error ? error : new Error('Lazy loading failed');
      
      // Log the fallback event
      this.logFallbackEvent({
        type: 'lazy-loading',
        strategy: 'immediate',
        componentId,
        error: fallbackError,
        timestamp: new Date(),
        retryAttempt: currentAttempts
      });

      // Try immediate rendering fallback if enabled and available
      if (this.config.enableLazyLoadingFallback && this.immediateComponents.has(componentId)) {
        if (this.config.enableLogging) {
          console.warn(`Lazy loading failed for ${componentId}, using immediate fallback:`, fallbackError);
        }
        
        return this.immediateComponents.get(componentId) as T;
      }

      // Try retry strategy if we haven't exceeded max attempts
      if (currentAttempts < this.config.maxRetryAttempts) {
        this.retryAttempts.set(attemptKey, currentAttempts + 1);
        
        if (this.config.enableLogging) {
          console.warn(`Retrying lazy loading for ${componentId} (attempt ${currentAttempts + 1}/${this.config.maxRetryAttempts})`);
        }

        // Wait before retrying
        await this.delay(this.config.retryDelay * Math.pow(2, currentAttempts));
        
        return this.loadComponentWithFallback<T>(componentId);
      }

      // All fallback strategies failed
      if (this.config.enableLogging) {
        console.error(`All fallback strategies failed for component ${componentId}:`, fallbackError);
      }
      
      throw fallbackError;
    }
  }

  /**
   * Create a fallback-enabled code splitter wrapper
   */
  createFallbackCodeSplitter(): ICodeSplitter {
    return {
      loadChunk: <T = any>(chunkName: string): Promise<T> => {
        return this.loadChunkWithFallback<T>(chunkName);
      },
      
      preloadChunk: async (chunkName: string): Promise<void> => {
        try {
          await this.codeSplitter.preloadChunk(chunkName);
        } catch (error) {
          // Preloading failures are not critical, just log them
          if (this.config.enableLogging) {
            console.warn(`Preloading failed for chunk ${chunkName}:`, error);
          }
        }
      },
      
      getChunkStatus: (chunkName: string) => {
        return this.codeSplitter.getChunkStatus(chunkName);
      },
      
      getLoadedChunks: () => {
        return this.codeSplitter.getLoadedChunks();
      }
    };
  }

  /**
   * Create a fallback-enabled lazy loader wrapper
   */
  createFallbackLazyLoader(): ILazyLoader {
    return {
      register: <T = any>(
        componentId: string,
        loader: () => Promise<T>,
        options = {}
      ): void => {
        // Wrap the loader with fallback functionality
        const fallbackLoader = async (): Promise<T> => {
          return this.loadComponentWithFallback<T>(componentId);
        };
        
        this.lazyLoader.register(componentId, fallbackLoader, options);
      },
      
      observeElement: (componentId: string, element: HTMLElement): void => {
        this.lazyLoader.observeElement(componentId, element);
      },
      
      loadComponent: <T = any>(componentId: string): Promise<T> => {
        return this.loadComponentWithFallback<T>(componentId);
      },
      
      unregister: (componentId: string): void => {
        this.lazyLoader.unregister(componentId);
        this.immediateComponents.delete(componentId);
        this.retryAttempts.delete(`component-${componentId}`);
      }
    };
  }

  /**
   * Get fallback statistics
   */
  getFallbackStats(): {
    totalEvents: number;
    codeSplittingFallbacks: number;
    lazyLoadingFallbacks: number;
    retryAttempts: number;
    successfulFallbacks: number;
  } {
    const codeSplittingFallbacks = this.fallbackEvents.filter(e => e.type === 'code-splitting').length;
    const lazyLoadingFallbacks = this.fallbackEvents.filter(e => e.type === 'lazy-loading').length;
    const retryAttempts = this.fallbackEvents.filter(e => e.strategy === 'retry').length;
    const successfulFallbacks = this.fallbackEvents.filter(e => 
      e.strategy === 'synchronous' || e.strategy === 'immediate'
    ).length;

    return {
      totalEvents: this.fallbackEvents.length,
      codeSplittingFallbacks,
      lazyLoadingFallbacks,
      retryAttempts,
      successfulFallbacks
    };
  }

  /**
   * Get recent fallback events
   */
  getRecentFallbackEvents(limit: number = 10): FallbackEvent[] {
    return this.fallbackEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Clear fallback event history
   */
  clearFallbackHistory(): void {
    this.fallbackEvents = [];
    this.retryAttempts.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FrontendFallbackConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableLogging) {
      console.log('Updated frontend fallback configuration:', this.config);
    }
  }

  /**
   * Check if fallback is available for a component
   */
  hasFallback(type: 'code-splitting' | 'lazy-loading', componentId: string): boolean {
    if (type === 'code-splitting') {
      return this.config.enableCodeSplittingFallback && !!this.synchronousComponents[componentId];
    } else {
      return this.config.enableLazyLoadingFallback && this.immediateComponents.has(componentId);
    }
  }

  /**
   * Log a fallback event
   */
  private logFallbackEvent(event: FallbackEvent): void {
    this.fallbackEvents.push(event);
    
    // Keep only the last 100 events to prevent memory leaks
    if (this.fallbackEvents.length > 100) {
      this.fallbackEvents = this.fallbackEvents.slice(-100);
    }
    
    if (this.config.enableLogging) {
      console.warn(`Fallback event: ${event.type} - ${event.strategy} for ${event.componentId}`, event);
    }
  }

  /**
   * Utility method to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const frontendFallbackManager = new FrontendFallbackManager();