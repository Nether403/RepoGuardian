/**
 * Error handling wrappers for frontend performance optimization components
 * Provides consistent error handling and logging across all frontend performance features
 */

import React from 'react';
import {
  ICodeSplitter,
  ILazyLoader,
  IBundleOptimizer,
  LazyLoadOptions,
  BundleAnalysis,
  OptimizationRecommendation,
  TreeShakingConfig,
  CachingConfig,
} from './interfaces';
import {
  FrontendPerformanceErrorCategory,
  FrontendPerformanceErrorSeverity,
} from './FrontendErrorHandling';
import { getFrontendPerformanceErrorHandler, getFrontendPerformanceLogger } from './FrontendErrorHandling';

/**
 * Error handling wrapper for code splitter
 */
export class ErrorHandledCodeSplitter implements ICodeSplitter {
  private codeSplitter: ICodeSplitter;
  private errorHandler = getFrontendPerformanceErrorHandler();
  private logger = getFrontendPerformanceLogger();
  private componentName: string;

  constructor(codeSplitter: ICodeSplitter, componentName: string = 'CodeSplitter') {
    this.codeSplitter = codeSplitter;
    this.componentName = componentName;
  }

  async loadChunk<T = any>(chunkName: string): Promise<T> {
    const timer = this.logger.createTimer(FrontendPerformanceErrorCategory.CODE_SPLITTING, this.componentName, 'loadChunk');
    try {
      const chunk = await this.codeSplitter.loadChunk<T>(chunkName);
      await timer.end({ chunkName, success: true });
      return chunk;
    } catch (error) {
      await timer.endWithError(error as Error, { chunkName });
      await this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.CODE_SPLITTING,
        FrontendPerformanceErrorSeverity.HIGH,
        'loadChunk',
        this.componentName,
        error as Error,
        { chunkName }
      );
      
      // Log fallback activation
      await this.errorHandler.logFallbackActivation(
        FrontendPerformanceErrorCategory.CODE_SPLITTING,
        this.componentName,
        'loadChunk',
        `Failed to load chunk '${chunkName}', falling back to synchronous loading`,
        { chunkName, error: (error as Error).message }
      );
      
      throw error;
    }
  }

  async preloadChunk(chunkName: string): Promise<void> {
    const timer = this.logger.createTimer(FrontendPerformanceErrorCategory.CODE_SPLITTING, this.componentName, 'preloadChunk');
    try {
      await this.codeSplitter.preloadChunk(chunkName);
      await timer.end({ chunkName, success: true });
    } catch (error) {
      await timer.endWithError(error as Error, { chunkName });
      await this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.CODE_SPLITTING,
        FrontendPerformanceErrorSeverity.MEDIUM,
        'preloadChunk',
        this.componentName,
        error as Error,
        { chunkName }
      );
      // Don't throw for preload failures - they're not critical
    }
  }

  getChunkStatus(chunkName: string): 'loading' | 'loaded' | 'error' | 'idle' {
    try {
      return this.codeSplitter.getChunkStatus(chunkName);
    } catch (error) {
      this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.CODE_SPLITTING,
        FrontendPerformanceErrorSeverity.LOW,
        'getChunkStatus',
        this.componentName,
        error as Error,
        { chunkName }
      );
      return 'error';
    }
  }

  getLoadedChunks(): string[] {
    try {
      return this.codeSplitter.getLoadedChunks();
    } catch (error) {
      this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.CODE_SPLITTING,
        FrontendPerformanceErrorSeverity.LOW,
        'getLoadedChunks',
        this.componentName,
        error as Error
      );
      return [];
    }
  }
}

/**
 * Error handling wrapper for lazy loader
 */
export class ErrorHandledLazyLoader implements ILazyLoader {
  private lazyLoader: ILazyLoader;
  private errorHandler = getFrontendPerformanceErrorHandler();
  private logger = getFrontendPerformanceLogger();
  private componentName: string;

  constructor(lazyLoader: ILazyLoader, componentName: string = 'LazyLoader') {
    this.lazyLoader = lazyLoader;
    this.componentName = componentName;
  }

  register<T = any>(
    componentId: string,
    loader: () => Promise<T>,
    options?: LazyLoadOptions
  ): void {
    try {
      // Wrap the loader to add error handling
      const wrappedLoader = async (): Promise<T> => {
        const timer = this.logger.createTimer(FrontendPerformanceErrorCategory.LAZY_LOADING, this.componentName, 'load');
        try {
          const component = await loader();
          await timer.end({ componentId, success: true });
          return component;
        } catch (error) {
          await timer.endWithError(error as Error, { componentId });
          await this.errorHandler.handleError(
            FrontendPerformanceErrorCategory.LAZY_LOADING,
            FrontendPerformanceErrorSeverity.HIGH,
            'load',
            this.componentName,
            error as Error,
            { componentId }
          );
          
          // Log fallback activation
          await this.errorHandler.logFallbackActivation(
            FrontendPerformanceErrorCategory.LAZY_LOADING,
            this.componentName,
            'load',
            `Failed to lazy load component '${componentId}', falling back to immediate rendering`,
            { componentId, error: (error as Error).message }
          );
          
          throw error;
        }
      };

      this.lazyLoader.register(componentId, wrappedLoader, options);
      this.logger.info(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        this.componentName,
        'register',
        `Registered lazy loading for component: ${componentId}`,
        { componentId, options }
      );
    } catch (error) {
      this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        FrontendPerformanceErrorSeverity.MEDIUM,
        'register',
        this.componentName,
        error as Error,
        { componentId, options }
      );
      throw error;
    }
  }

  observeElement(componentId: string, element: HTMLElement): void {
    try {
      this.lazyLoader.observeElement(componentId, element);
      this.logger.debug(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        this.componentName,
        'observeElement',
        `Started observing element for component: ${componentId}`,
        { componentId }
      );
    } catch (error) {
      this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        FrontendPerformanceErrorSeverity.MEDIUM,
        'observeElement',
        this.componentName,
        error as Error,
        { componentId }
      );
      throw error;
    }
  }

  async loadComponent<T = any>(componentId: string): Promise<T> {
    const timer = this.logger.createTimer(FrontendPerformanceErrorCategory.LAZY_LOADING, this.componentName, 'loadComponent');
    try {
      const component = await this.lazyLoader.loadComponent<T>(componentId);
      await timer.end({ componentId, success: true });
      return component;
    } catch (error) {
      await timer.endWithError(error as Error, { componentId });
      await this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        FrontendPerformanceErrorSeverity.HIGH,
        'loadComponent',
        this.componentName,
        error as Error,
        { componentId }
      );
      
      // Log fallback activation
      await this.errorHandler.logFallbackActivation(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        this.componentName,
        'loadComponent',
        `Failed to load component '${componentId}', falling back to immediate rendering`,
        { componentId, error: (error as Error).message }
      );
      
      throw error;
    }
  }

  unregister(componentId: string): void {
    try {
      this.lazyLoader.unregister(componentId);
      this.logger.info(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        this.componentName,
        'unregister',
        `Unregistered lazy loading for component: ${componentId}`,
        { componentId }
      );
    } catch (error) {
      this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.LAZY_LOADING,
        FrontendPerformanceErrorSeverity.LOW,
        'unregister',
        this.componentName,
        error as Error,
        { componentId }
      );
      throw error;
    }
  }
}

/**
 * Error handling wrapper for bundle optimizer
 */
export class ErrorHandledBundleOptimizer implements IBundleOptimizer {
  private bundleOptimizer: IBundleOptimizer;
  private errorHandler = getFrontendPerformanceErrorHandler();
  private logger = getFrontendPerformanceLogger();
  private componentName: string;

  constructor(bundleOptimizer: IBundleOptimizer, componentName: string = 'BundleOptimizer') {
    this.bundleOptimizer = bundleOptimizer;
    this.componentName = componentName;
  }

  async analyzeBundles(): Promise<BundleAnalysis> {
    const timer = this.logger.createTimer(FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION, this.componentName, 'analyzeBundles');
    try {
      const analysis = await this.bundleOptimizer.analyzeBundles();
      await timer.end({ 
        totalSize: analysis.totalSize, 
        chunkCount: analysis.chunks.length,
        unusedCodeCount: analysis.unusedCode.length 
      });
      return analysis;
    } catch (error) {
      await timer.endWithError(error as Error);
      await this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION,
        FrontendPerformanceErrorSeverity.MEDIUM,
        'analyzeBundles',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  getOptimizationRecommendations(): OptimizationRecommendation[] {
    try {
      const recommendations = this.bundleOptimizer.getOptimizationRecommendations();
      this.logger.info(
        FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION,
        this.componentName,
        'getOptimizationRecommendations',
        `Generated ${recommendations.length} optimization recommendations`,
        { recommendationCount: recommendations.length }
      );
      return recommendations;
    } catch (error) {
      this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION,
        FrontendPerformanceErrorSeverity.LOW,
        'getOptimizationRecommendations',
        this.componentName,
        error as Error
      );
      throw error;
    }
  }

  applyTreeShaking(config: TreeShakingConfig): void {
    try {
      this.bundleOptimizer.applyTreeShaking(config);
      this.logger.info(
        FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION,
        this.componentName,
        'applyTreeShaking',
        'Tree shaking configuration applied',
        { config }
      );
    } catch (error) {
      this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.BUNDLE_OPTIMIZATION,
        FrontendPerformanceErrorSeverity.MEDIUM,
        'applyTreeShaking',
        this.componentName,
        error as Error,
        { config }
      );
      throw error;
    }
  }

  configureCaching(config: CachingConfig): void {
    try {
      this.bundleOptimizer.configureCaching(config);
      this.logger.info(
        FrontendPerformanceErrorCategory.CACHING,
        this.componentName,
        'configureCaching',
        'Caching configuration applied',
        { config }
      );
    } catch (error) {
      this.errorHandler.handleError(
        FrontendPerformanceErrorCategory.CACHING,
        FrontendPerformanceErrorSeverity.MEDIUM,
        'configureCaching',
        this.componentName,
        error as Error,
        { config }
      );
      throw error;
    }
  }
}

/**
 * Higher-order component for error handling in React components
 */
export function withPerformanceErrorHandling<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string,
  category: FrontendPerformanceErrorCategory = FrontendPerformanceErrorCategory.FALLBACK
): React.ComponentType<P> {
  const errorHandler = getFrontendPerformanceErrorHandler();
  const logger = getFrontendPerformanceLogger();

  return class ErrorHandledComponent extends React.Component<P, { hasError: boolean; error?: Error }> {
    constructor(props: P) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      await errorHandler.handleError(
        category,
        FrontendPerformanceErrorSeverity.HIGH,
        'render',
        componentName,
        error,
        { errorInfo, componentStack: errorInfo.componentStack }
      );

      await errorHandler.logFallbackActivation(
        category,
        componentName,
        'render',
        `Component crashed during render, showing error boundary`,
        { error: error.message, componentStack: errorInfo.componentStack }
      );
    }

    render() {
      if (this.state.hasError) {
        return React.createElement('div', {
          style: {
            padding: '20px',
            border: '1px solid #ff6b6b',
            borderRadius: '4px',
            backgroundColor: '#ffe0e0',
            color: '#d63031',
            margin: '10px 0',
          },
        }, [
          React.createElement('h3', { key: 'title' }, 'Performance Component Error'),
          React.createElement('p', { key: 'message' }, 
            `The ${componentName} component encountered an error and has been disabled.`
          ),
          React.createElement('details', { key: 'details' }, [
            React.createElement('summary', { key: 'summary' }, 'Error Details'),
            React.createElement('pre', { 
              key: 'error',
              style: { fontSize: '12px', overflow: 'auto' }
            }, this.state.error?.message || 'Unknown error'),
          ]),
        ]);
      }

      return React.createElement(WrappedComponent, this.props);
    }
  };
}

/**
 * Factory functions for creating error-handled components
 */
export function createErrorHandledCodeSplitter(codeSplitter: ICodeSplitter, componentName?: string): ICodeSplitter {
  return new ErrorHandledCodeSplitter(codeSplitter, componentName);
}

export function createErrorHandledLazyLoader(lazyLoader: ILazyLoader, componentName?: string): ILazyLoader {
  return new ErrorHandledLazyLoader(lazyLoader, componentName);
}

export function createErrorHandledBundleOptimizer(bundleOptimizer: IBundleOptimizer, componentName?: string): IBundleOptimizer {
  return new ErrorHandledBundleOptimizer(bundleOptimizer, componentName);
}