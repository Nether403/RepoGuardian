import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { 
  FallbackLazyComponent,
  useFallbackLazyComponent,
  withFallbackLazyLoading,
  LazyLoadingFallbackStats
} from '../FallbackLazyComponent';
import { frontendFallbackManager } from '../FrontendFallbackManager';

// Mock the fallback manager
vi.mock('../FrontendFallbackManager', () => ({
  frontendFallbackManager: {
    registerImmediateComponents: vi.fn(),
    createFallbackLazyLoader: vi.fn(),
    loadComponentWithFallback: vi.fn(),
    hasFallback: vi.fn(),
    getFallbackStats: vi.fn()
  }
}));

// Test components
const TestComponent = (props: any) => <div>Test Component {props.testProp}</div>;
const ImmediateFallback = (props: any) => <div>Immediate Fallback {props.testProp}</div>;
const CustomLoading = () => <div>Custom Loading</div>;
const CustomError = ({ error, retry, useFallback }: any) => (
  <div>
    <div>Custom Error: {error.message}</div>
    <button onClick={retry}>Custom Retry</button>
    <button onClick={useFallback}>Custom Use Fallback</button>
  </div>
);

describe('FallbackLazyComponent', () => {
  const mockLoader = vi.fn();
  const mockLazyLoader = {
    register: vi.fn(),
    observeElement: vi.fn(),
    loadComponent: vi.fn(),
    unregister: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    (frontendFallbackManager.registerImmediateComponents as any).mockImplementation(() => {});
    (frontendFallbackManager.createFallbackLazyLoader as any).mockReturnValue(mockLazyLoader);
    (frontendFallbackManager.loadComponentWithFallback as any).mockResolvedValue(TestComponent);
    (frontendFallbackManager.hasFallback as any).mockReturnValue(false);
    (frontendFallbackManager.getFallbackStats as any).mockReturnValue({
      totalEvents: 0,
      codeSplittingFallbacks: 0,
      lazyLoadingFallbacks: 0,
      retryAttempts: 0,
      successfulFallbacks: 0
    });
    
    mockLoader.mockResolvedValue(TestComponent);
  });

  describe('FallbackLazyComponent', () => {
    it('should register immediate fallback when provided', () => {
      render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
          immediateFallback={ImmediateFallback}
        />
      );
      
      expect(frontendFallbackManager.registerImmediateComponents).toHaveBeenCalledWith(
        'test-component',
        ImmediateFallback
      );
    });

    it('should load component successfully', async () => {
      render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
          options={{ immediate: true }}
          componentProps={{ testProp: 'value' }}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Test Component value')).toBeInTheDocument();
      });
      
      expect(frontendFallbackManager.loadComponentWithFallback).toHaveBeenCalledWith('test-component');
    });

    it('should show custom loading component while loading', () => {
      render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
          fallback={CustomLoading}
        />
      );
      
      expect(screen.getByText('Custom Loading')).toBeInTheDocument();
    });

    it('should show default loading component when no custom fallback provided', () => {
      render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
        />
      );
      
      // Should show the default loading spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should handle loading errors with default error fallback', async () => {
      const error = new Error('Loading failed');
      (frontendFallbackManager.loadComponentWithFallback as any).mockRejectedValue(error);
      
      render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
          options={{ immediate: true }}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load component')).toBeInTheDocument();
        expect(screen.getByText('Loading failed')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should handle loading errors with custom error fallback', async () => {
      const error = new Error('Custom error');
      (frontendFallbackManager.loadComponentWithFallback as any).mockRejectedValue(error);
      
      render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
          options={{ immediate: true }}
          errorFallback={CustomError}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Custom Error: Custom error')).toBeInTheDocument();
        expect(screen.getByText('Custom Retry')).toBeInTheDocument();
        expect(screen.getByText('Custom Use Fallback')).toBeInTheDocument();
      });
    });

    it('should show use fallback button when fallback is available', async () => {
      const error = new Error('Loading failed');
      (frontendFallbackManager.loadComponentWithFallback as any).mockRejectedValue(error);
      (frontendFallbackManager.hasFallback as any).mockReturnValue(true);
      
      render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
          options={{ immediate: true }}
          immediateFallback={ImmediateFallback}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Use Fallback')).toBeInTheDocument();
      });
    });

    it('should switch to immediate fallback when requested', async () => {
      const error = new Error('Loading failed');
      (frontendFallbackManager.loadComponentWithFallback as any).mockRejectedValue(error);
      (frontendFallbackManager.hasFallback as any).mockReturnValue(true);
      
      render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
          options={{ immediate: true }}
          immediateFallback={ImmediateFallback}
          componentProps={{ testProp: 'fallback' }}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Use Fallback')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Use Fallback'));
      
      await waitFor(() => {
        expect(screen.getByText('Immediate Fallback fallback')).toBeInTheDocument();
      });
    });

    it('should automatically use fallback for immediate loading failures when available', async () => {
      const error = new Error('Loading failed');
      (frontendFallbackManager.loadComponentWithFallback as any).mockRejectedValue(error);
      (frontendFallbackManager.hasFallback as any).mockReturnValue(true);
      
      render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
          options={{ immediate: true }}
          immediateFallback={ImmediateFallback}
          componentProps={{ testProp: 'auto' }}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Immediate Fallback auto')).toBeInTheDocument();
      });
    });

    it('should handle retry functionality', async () => {
      const error = new Error('Loading failed');
      (frontendFallbackManager.loadComponentWithFallback as any)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(TestComponent);
      
      render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
          options={{ immediate: true }}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Retry'));
      
      await waitFor(() => {
        expect(screen.getByText('Test Component')).toBeInTheDocument();
      });
    });

    it('should apply custom className and style', () => {
      const { container } = render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
          className="custom-class"
          style={{ backgroundColor: 'red' }}
        />
      );
      
      const element = container.firstChild as HTMLElement;
      expect(element).toHaveClass('custom-class');
      expect(element).toHaveStyle({ backgroundColor: 'red' });
    });

    it('should clean up on unmount', () => {
      const { unmount } = render(
        <FallbackLazyComponent
          componentId="test-component"
          loader={mockLoader}
        />
      );
      
      unmount();
      
      expect(mockLazyLoader.unregister).toHaveBeenCalledWith('test-component');
    });
  });

  describe('useFallbackLazyComponent', () => {
    it('should return component loading state and functions', () => {
      const TestHookComponent = () => {
        const {
          loadedComponent,
          isLoading,
          error,
          useFallback,
          loadComponent,
          observeElement,
          retry,
          useFallbackComponent,
          hasFallback
        } = useFallbackLazyComponent('test-component', mockLoader);
        
        return (
          <div>
            <div>Loaded: {loadedComponent ? 'true' : 'false'}</div>
            <div>Loading: {isLoading ? 'true' : 'false'}</div>
            <div>Error: {error ? error.message : 'none'}</div>
            <div>Use Fallback: {useFallback ? 'true' : 'false'}</div>
            <div>Has Fallback: {hasFallback ? 'true' : 'false'}</div>
            <button onClick={loadComponent}>Load</button>
            <button onClick={retry}>Retry</button>
            <button onClick={useFallbackComponent}>Use Fallback</button>
          </div>
        );
      };
      
      render(<TestHookComponent />);
      
      expect(screen.getByText('Loaded: false')).toBeInTheDocument();
      expect(screen.getByText('Loading: false')).toBeInTheDocument();
      expect(screen.getByText('Error: none')).toBeInTheDocument();
      expect(screen.getByText('Use Fallback: false')).toBeInTheDocument();
      expect(screen.getByText('Has Fallback: false')).toBeInTheDocument();
    });

    it('should register immediate fallback when provided', () => {
      const TestHookComponent = () => {
        useFallbackLazyComponent('test-component', mockLoader, {}, ImmediateFallback);
        return <div>Test</div>;
      };
      
      render(<TestHookComponent />);
      
      expect(frontendFallbackManager.registerImmediateComponents).toHaveBeenCalledWith(
        'test-component',
        ImmediateFallback
      );
    });

    it('should handle component loading', async () => {
      const TestHookComponent = () => {
        const { loadedComponent, isLoading, loadComponent } = useFallbackLazyComponent(
          'test-component',
          mockLoader
        );
        
        React.useEffect(() => {
          loadComponent();
        }, [loadComponent]);
        
        return (
          <div>
            <div>Loaded: {loadedComponent ? 'true' : 'false'}</div>
            <div>Loading: {isLoading ? 'true' : 'false'}</div>
          </div>
        );
      };
      
      render(<TestHookComponent />);
      
      await waitFor(() => {
        expect(screen.getByText('Loaded: true')).toBeInTheDocument();
        expect(screen.getByText('Loading: false')).toBeInTheDocument();
      });
    });

    it('should handle loading errors', async () => {
      const error = new Error('Loading failed');
      (frontendFallbackManager.loadComponentWithFallback as any).mockRejectedValue(error);
      
      const TestHookComponent = () => {
        const { error: loadError, isLoading, loadComponent } = useFallbackLazyComponent(
          'test-component',
          mockLoader
        );
        
        React.useEffect(() => {
          loadComponent();
        }, [loadComponent]);
        
        return (
          <div>
            <div>Error: {loadError ? loadError.message : 'none'}</div>
            <div>Loading: {isLoading ? 'true' : 'false'}</div>
          </div>
        );
      };
      
      render(<TestHookComponent />);
      
      await waitFor(() => {
        expect(screen.getByText('Error: Loading failed')).toBeInTheDocument();
        expect(screen.getByText('Loading: false')).toBeInTheDocument();
      });
    });

    it('should return immediate fallback when useFallback is true', async () => {
      const error = new Error('Loading failed');
      (frontendFallbackManager.loadComponentWithFallback as any).mockRejectedValue(error);
      (frontendFallbackManager.hasFallback as any).mockReturnValue(true);
      
      const TestHookComponent = () => {
        const { 
          loadedComponent, 
          useFallback, 
          loadComponent, 
          useFallbackComponent 
        } = useFallbackLazyComponent('test-component', mockLoader, { immediate: true }, ImmediateFallback);
        
        React.useEffect(() => {
          loadComponent();
        }, [loadComponent]);
        
        return (
          <div>
            <div>Component: {loadedComponent === ImmediateFallback ? 'fallback' : 'original'}</div>
            <div>Use Fallback: {useFallback ? 'true' : 'false'}</div>
            <button onClick={useFallbackComponent}>Use Fallback</button>
          </div>
        );
      };
      
      render(<TestHookComponent />);
      
      await waitFor(() => {
        expect(screen.getByText('Component: fallback')).toBeInTheDocument();
        expect(screen.getByText('Use Fallback: true')).toBeInTheDocument();
      });
    });
  });

  describe('withFallbackLazyLoading', () => {
    it('should create a higher-order component with fallback support', () => {
      const WrappedComponent = withFallbackLazyLoading(
        'test-component',
        mockLoader,
        {},
        ImmediateFallback
      );
      
      render(<WrappedComponent testProp="value" />);
      
      expect(frontendFallbackManager.registerImmediateComponents).toHaveBeenCalledWith(
        'test-component',
        ImmediateFallback
      );
    });

    it('should pass props to the wrapped component', async () => {
      const WrappedComponent = withFallbackLazyLoading(
        'test-component',
        mockLoader,
        { immediate: true }
      );
      
      render(<WrappedComponent testProp="wrapped" />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Component wrapped')).toBeInTheDocument();
      });
    });
  });

  describe('LazyLoadingFallbackStats', () => {
    it('should not render when no lazy loading fallbacks occurred', () => {
      (frontendFallbackManager.getFallbackStats as any).mockReturnValue({
        totalEvents: 5,
        codeSplittingFallbacks: 5,
        lazyLoadingFallbacks: 0,
        retryAttempts: 0,
        successfulFallbacks: 0
      });
      
      const { container } = render(<LazyLoadingFallbackStats />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should render lazy loading fallback statistics when events occurred', () => {
      (frontendFallbackManager.getFallbackStats as any).mockReturnValue({
        totalEvents: 5,
        codeSplittingFallbacks: 2,
        lazyLoadingFallbacks: 3,
        retryAttempts: 0,
        successfulFallbacks: 3
      });
      
      render(<LazyLoadingFallbackStats />);
      
      expect(screen.getByText('Lazy Loading Fallbacks')).toBeInTheDocument();
      expect(screen.getByText('3 components used fallback rendering')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      (frontendFallbackManager.getFallbackStats as any).mockReturnValue({
        totalEvents: 1,
        codeSplittingFallbacks: 0,
        lazyLoadingFallbacks: 1,
        retryAttempts: 0,
        successfulFallbacks: 1
      });
      
      render(<LazyLoadingFallbackStats className="custom-stats" />);
      
      const statsElement = screen.getByText('Lazy Loading Fallbacks').closest('div');
      expect(statsElement).toHaveClass('custom-stats');
    });

    it('should update stats periodically', async () => {
      vi.useFakeTimers();
      
      let fallbackCount = 1;
      (frontendFallbackManager.getFallbackStats as any).mockImplementation(() => ({
        totalEvents: fallbackCount,
        codeSplittingFallbacks: 0,
        lazyLoadingFallbacks: fallbackCount++,
        retryAttempts: 0,
        successfulFallbacks: 1
      }));
      
      render(<LazyLoadingFallbackStats />);
      
      expect(screen.getByText('1 components used fallback rendering')).toBeInTheDocument();
      
      // Fast forward 5 seconds
      vi.advanceTimersByTime(5000);
      
      await waitFor(() => {
        expect(screen.getByText('2 components used fallback rendering')).toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });
});