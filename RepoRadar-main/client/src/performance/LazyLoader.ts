import { ILazyLoader, LazyLoadOptions } from './interfaces';

/**
 * Implementation of lazy loading functionality with viewport intersection detection
 */
export class LazyLoader implements ILazyLoader {
  private components = new Map<string, () => Promise<any>>();
  private loadedComponents = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();
  private observers = new Map<string, IntersectionObserver>();
  private options = new Map<string, LazyLoadOptions>();

  /**
   * Register a component for lazy loading
   */
  register<T = any>(
    componentId: string,
    loader: () => Promise<T>,
    options: LazyLoadOptions = {}
  ): void {
    this.components.set(componentId, loader);
    this.options.set(componentId, {
      threshold: 0.1,
      rootMargin: '50px',
      immediate: false,
      ...options
    });

    // Load immediately if requested
    if (options.immediate) {
      this.loadComponent(componentId);
    }
  }

  /**
   * Load a component when it enters the viewport
   */
  observeElement(componentId: string, element: HTMLElement): void {
    if (!this.components.has(componentId)) {
      console.warn(`Component ${componentId} not registered for lazy loading`);
      return;
    }

    // Clean up existing observer if any
    if (this.observers.has(componentId)) {
      this.observers.get(componentId)?.disconnect();
    }

    const options = this.options.get(componentId)!;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadComponent(componentId);
            observer.disconnect();
            this.observers.delete(componentId);
          }
        });
      },
      {
        threshold: options.threshold,
        rootMargin: options.rootMargin
      }
    );

    observer.observe(element);
    this.observers.set(componentId, observer);
  }

  /**
   * Manually trigger loading of a component
   */
  async loadComponent<T = any>(componentId: string): Promise<T> {
    // Return cached component if available
    if (this.loadedComponents.has(componentId)) {
      return this.loadedComponents.get(componentId);
    }

    // Return existing loading promise if component is already being loaded
    if (this.loadingPromises.has(componentId)) {
      return this.loadingPromises.get(componentId);
    }

    const loader = this.components.get(componentId);
    if (!loader) {
      throw new Error(`Component ${componentId} not registered`);
    }

    const loadingPromise = loader().then(
      (component) => {
        this.loadedComponents.set(componentId, component);
        this.loadingPromises.delete(componentId);
        return component;
      },
      (error) => {
        this.loadingPromises.delete(componentId);
        console.error(`Failed to load component ${componentId}:`, error);
        throw error;
      }
    );

    this.loadingPromises.set(componentId, loadingPromise);
    return loadingPromise;
  }

  /**
   * Unregister a component
   */
  unregister(componentId: string): void {
    // Clean up observer
    if (this.observers.has(componentId)) {
      this.observers.get(componentId)?.disconnect();
      this.observers.delete(componentId);
    }

    // Clean up component data
    this.components.delete(componentId);
    this.loadedComponents.delete(componentId);
    this.loadingPromises.delete(componentId);
    this.options.delete(componentId);
  }

  /**
   * Get loading status of a component
   */
  getLoadingStatus(componentId: string): 'idle' | 'loading' | 'loaded' | 'error' {
    if (this.loadedComponents.has(componentId)) {
      return 'loaded';
    }
    if (this.loadingPromises.has(componentId)) {
      return 'loading';
    }
    if (this.components.has(componentId)) {
      return 'idle';
    }
    return 'error';
  }

  /**
   * Get all registered component IDs
   */
  getRegisteredComponents(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Get all loaded component IDs
   */
  getLoadedComponents(): string[] {
    return Array.from(this.loadedComponents.keys());
  }

  /**
   * Clear all registered components and observers
   */
  clear(): void {
    // Disconnect all observers
    this.observers.forEach(observer => observer.disconnect());
    
    // Clear all maps
    this.components.clear();
    this.loadedComponents.clear();
    this.loadingPromises.clear();
    this.observers.clear();
    this.options.clear();
  }
}

// Export singleton instance
export const lazyLoader = new LazyLoader();