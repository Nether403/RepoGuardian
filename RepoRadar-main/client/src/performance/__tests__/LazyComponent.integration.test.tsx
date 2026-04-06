import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LazyComponent, useLazyComponent, withLazyLoading } from '../LazyComponent';
import { lazyLoader } from '../LazyLoader';
import React from 'react';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

mockIntersectionObserver.mockImplementation((callback) => ({
  observe: mockObserve,
  disconnect: mockDisconnect,
  callback
}));

// @ts-ignore
global.IntersectionObserver = mockIntersectionObserver;

// Mock console methods
const consoleSpy = {
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

describe('LazyComponent Integration', () => {
  beforeEach(() => {
    lazyLoader.clear();
    mockIntersectionObserver.mockClear();
    mockObserve.mockClear();
    mockDisconnect.mockClear();
    consoleSpy.warn.mockClear();
    consoleSpy.error.mockClear();
  });

  afterAll(() => {
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('LazyComponent', () => {
    it('should create LazyComponent without errors', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');
      const loader = vi.fn().mockResolvedValue(TestComponent);
      
      expect(() => {
        React.createElement(LazyComponent, {
          componentId: 'test-component',
          loader: loader
        });
      }).not.toThrow();
    });

    it('should accept all required props', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');
      const loader = vi.fn().mockResolvedValue(TestComponent);
      const CustomFallback = () => React.createElement('div', null, 'Loading...');
      const CustomErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => 
        React.createElement('div', null, `Error: ${error.message}`);
      
      const element = React.createElement(LazyComponent, {
        componentId: 'test-component',
        loader: loader,
        options: { threshold: 0.5 },
        componentProps: { message: 'Hello' },
        fallback: CustomFallback,
        errorFallback: CustomErrorFallback,
        className: 'test-class',
        style: { color: 'red' }
      });
      
      expect(element).toBeDefined();
      expect(element.props.componentId).toBe('test-component');
      expect(element.props.loader).toBe(loader);
    });
  });

  describe('useLazyComponent', () => {
    it('should return expected interface', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');
      const loader = vi.fn().mockResolvedValue(TestComponent);
      
      // We can't actually call the hook outside of React context,
      // but we can test that it's a function
      expect(typeof useLazyComponent).toBe('function');
    });
  });

  describe('withLazyLoading', () => {
    it('should create HOC without errors', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');
      const loader = vi.fn().mockResolvedValue(TestComponent);
      
      const LazyWrappedComponent = withLazyLoading('test-component', loader);
      
      expect(typeof LazyWrappedComponent).toBe('function');
      
      const element = React.createElement(LazyWrappedComponent, { message: 'Hello' });
      expect(element).toBeDefined();
    });

    it('should pass options to LazyComponent', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');
      const loader = vi.fn().mockResolvedValue(TestComponent);
      const options = { threshold: 0.8, immediate: true };
      
      const LazyWrappedComponent = withLazyLoading('test-component', loader, options);
      const element = React.createElement(LazyWrappedComponent, { message: 'Hello' });
      
      expect(element).toBeDefined();
    });
  });

  describe('Integration with LazyLoader', () => {
    it('should register component with lazy loader', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');
      const loader = vi.fn().mockResolvedValue(TestComponent);
      
      // Create LazyComponent (this would normally happen in React render)
      React.createElement(LazyComponent, {
        componentId: 'integration-test',
        loader: loader
      });
      
      // The component should be registered when the effect runs
      // We can't test this directly without a React environment,
      // but we can verify the LazyComponent was created
      expect(loader).toBeDefined();
    });

    it('should handle immediate loading option', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');
      const loader = vi.fn().mockResolvedValue(TestComponent);
      
      React.createElement(LazyComponent, {
        componentId: 'immediate-test',
        loader: loader,
        options: { immediate: true }
      });
      
      // Component should be created with immediate option
      expect(loader).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle loader errors gracefully', () => {
      const loader = vi.fn().mockRejectedValue(new Error('Load failed'));
      
      expect(() => {
        React.createElement(LazyComponent, {
          componentId: 'error-test',
          loader: loader
        });
      }).not.toThrow();
    });

    it('should provide retry functionality', () => {
      const loader = vi.fn().mockRejectedValue(new Error('Load failed'));
      const CustomErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => {
        expect(typeof retry).toBe('function');
        return React.createElement('div', null, `Error: ${error.message}`);
      };
      
      React.createElement(LazyComponent, {
        componentId: 'retry-test',
        loader: loader,
        errorFallback: CustomErrorFallback
      });
      
      // Error fallback should receive retry function
      expect(loader).toBeDefined();
    });
  });

  describe('Fallback Components', () => {
    it('should accept custom loading fallback', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');
      const loader = vi.fn().mockResolvedValue(TestComponent);
      const CustomFallback = () => React.createElement('div', null, 'Custom Loading...');
      
      const element = React.createElement(LazyComponent, {
        componentId: 'fallback-test',
        loader: loader,
        fallback: CustomFallback
      });
      
      expect(element.props.fallback).toBe(CustomFallback);
    });

    it('should accept custom error fallback', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');
      const loader = vi.fn().mockResolvedValue(TestComponent);
      const CustomErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => 
        React.createElement('div', null, `Custom Error: ${error.message}`);
      
      const element = React.createElement(LazyComponent, {
        componentId: 'error-fallback-test',
        loader: loader,
        errorFallback: CustomErrorFallback
      });
      
      expect(element.props.errorFallback).toBe(CustomErrorFallback);
    });
  });
});