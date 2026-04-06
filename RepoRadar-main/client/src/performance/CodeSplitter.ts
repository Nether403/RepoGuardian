import { ICodeSplitter } from './interfaces';

/**
 * Implementation of code splitting functionality
 */
export class CodeSplitter implements ICodeSplitter {
  private chunkCache = new Map<string, any>();
  private chunkStatus = new Map<string, 'loading' | 'loaded' | 'error' | 'idle'>();
  private loadingPromises = new Map<string, Promise<any>>();

  /**
   * Dynamically load a component chunk
   */
  async loadChunk<T = any>(chunkName: string): Promise<T> {
    // Return cached chunk if available
    if (this.chunkCache.has(chunkName)) {
      return this.chunkCache.get(chunkName);
    }

    // Return existing loading promise if chunk is already being loaded
    if (this.loadingPromises.has(chunkName)) {
      return this.loadingPromises.get(chunkName);
    }

    // Start loading the chunk
    this.chunkStatus.set(chunkName, 'loading');
    
    const loadingPromise = this.performChunkLoad<T>(chunkName).then(
      (chunk) => {
        this.chunkCache.set(chunkName, chunk);
        this.chunkStatus.set(chunkName, 'loaded');
        this.loadingPromises.delete(chunkName);
        return chunk;
      },
      (error) => {
        this.chunkStatus.set(chunkName, 'error');
        this.loadingPromises.delete(chunkName);
        console.error(`Failed to load chunk ${chunkName}:`, error);
        throw error;
      }
    );
    
    this.loadingPromises.set(chunkName, loadingPromise);
    return loadingPromise;
  }

  /**
   * Preload a component chunk without executing it
   */
  async preloadChunk(chunkName: string): Promise<void> {
    if (this.chunkCache.has(chunkName) || this.loadingPromises.has(chunkName)) {
      return;
    }

    try {
      await this.loadChunk(chunkName);
    } catch (error) {
      // Silently fail preloading - it's not critical
      console.warn(`Failed to preload chunk ${chunkName}:`, error);
    }
  }

  /**
   * Get loading status of a chunk
   */
  getChunkStatus(chunkName: string): 'loading' | 'loaded' | 'error' | 'idle' {
    return this.chunkStatus.get(chunkName) || 'idle';
  }

  /**
   * Get all loaded chunks
   */
  getLoadedChunks(): string[] {
    return Array.from(this.chunkCache.keys());
  }

  /**
   * Perform the actual chunk loading using dynamic imports
   */
  private async performChunkLoad<T>(chunkName: string): Promise<T> {
    // Map chunk names to their import paths
    const chunkMap: Record<string, () => Promise<any>> = {
      // Page components
      'landing': () => import('../pages/landing'),
      'home': () => import('../pages/home'),
      'search': () => import('../pages/search'),
      'analyze': () => import('../pages/analyze'),
      'batch-analyze': () => import('../pages/batch-analyze'),
      'repository-detail': () => import('../pages/repository-detail'),
      'compare': () => import('../pages/compare'),
      'profile': () => import('../pages/profile'),
      'discover': () => import('../pages/discover'),
      'docs': () => import('../pages/docs'),
      'pricing': () => import('../pages/pricing'),
      'checkout': () => import('../pages/checkout'),
      'payment-success': () => import('../pages/payment-success'),
      'collections': () => import('../pages/collections'),
      'analytics': () => import('../pages/analytics'),
      'teams': () => import('../pages/teams'),
      'developer': () => import('../pages/developer'),
      'advanced-analytics': () => import('../pages/advanced-analytics'),
      'integrations': () => import('../pages/integrations'),
      'code-review': () => import('../pages/code-review'),
      'not-found': () => import('../pages/not-found'),
    };

    const loader = chunkMap[chunkName];
    if (!loader) {
      throw new Error(`Unknown chunk: ${chunkName}`);
    }

    const module = await loader();
    return module.default || module;
  }

  /**
   * Clear chunk cache (useful for development/testing)
   */
  clearCache(): void {
    this.chunkCache.clear();
    this.chunkStatus.clear();
    this.loadingPromises.clear();
  }
}

// Export singleton instance
export const codeSplitter = new CodeSplitter();