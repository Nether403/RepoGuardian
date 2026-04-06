import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardNavigation, useFocusTrap } from '../use-keyboard-navigation';
import { createRef } from 'react';

describe('useKeyboardNavigation', () => {
  it('calls onEnter when Enter key is pressed', () => {
    const onEnter = vi.fn();
    const ref = createRef<HTMLDivElement>();
    
    // Create a div element and assign it to ref
    const div = document.createElement('div');
    Object.defineProperty(ref, 'current', {
      writable: true,
      value: div,
    });
    
    renderHook(() => useKeyboardNavigation(ref, { onEnter }));
    
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    div.dispatchEvent(event);
    
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('calls onEscape when Escape key is pressed', () => {
    const onEscape = vi.fn();
    const ref = createRef<HTMLDivElement>();
    
    const div = document.createElement('div');
    Object.defineProperty(ref, 'current', {
      writable: true,
      value: div,
    });
    
    renderHook(() => useKeyboardNavigation(ref, { onEscape }));
    
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    div.dispatchEvent(event);
    
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('calls onArrowDown when ArrowDown key is pressed', () => {
    const onArrowDown = vi.fn();
    const ref = createRef<HTMLDivElement>();
    
    const div = document.createElement('div');
    Object.defineProperty(ref, 'current', {
      writable: true,
      value: div,
    });
    
    renderHook(() => useKeyboardNavigation(ref, { onArrowDown }));
    
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    div.dispatchEvent(event);
    
    expect(onArrowDown).toHaveBeenCalledTimes(1);
  });

  it('does not call handlers when disabled', () => {
    const onEnter = vi.fn();
    const ref = createRef<HTMLDivElement>();
    
    const div = document.createElement('div');
    Object.defineProperty(ref, 'current', {
      writable: true,
      value: div,
    });
    
    renderHook(() => useKeyboardNavigation(ref, { onEnter, enabled: false }));
    
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    div.dispatchEvent(event);
    
    expect(onEnter).not.toHaveBeenCalled();
  });
});

describe('useFocusTrap', () => {
  it('traps focus within container', () => {
    const ref = createRef<HTMLDivElement>();
    
    const container = document.createElement('div');
    const button1 = document.createElement('button');
    const button2 = document.createElement('button');
    container.appendChild(button1);
    container.appendChild(button2);
    
    Object.defineProperty(ref, 'current', {
      writable: true,
      value: container,
    });
    
    renderHook(() => useFocusTrap(ref, true));
    
    // Focus should be on first element
    expect(document.activeElement).toBe(button1);
  });

  it('does not trap focus when disabled', () => {
    const ref = createRef<HTMLDivElement>();
    
    const container = document.createElement('div');
    const button = document.createElement('button');
    container.appendChild(button);
    
    Object.defineProperty(ref, 'current', {
      writable: true,
      value: container,
    });
    
    const previousActiveElement = document.activeElement;
    
    renderHook(() => useFocusTrap(ref, false));
    
    // Focus should not change
    expect(document.activeElement).toBe(previousActiveElement);
  });
});
