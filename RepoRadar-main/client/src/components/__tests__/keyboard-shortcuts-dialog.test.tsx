import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KeyboardShortcutsDialog } from '../keyboard-shortcuts-dialog';
import { axe } from 'vitest-axe';

describe('KeyboardShortcutsDialog', () => {
  it('opens dialog when "?" key is pressed', async () => {
    render(<KeyboardShortcutsDialog />);
    
    // Dialog should not be visible initially
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    
    // Press "?" key
    fireEvent.keyDown(window, { key: '?' });
    
    // Dialog should now be visible
    await waitFor(() => {
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });
  });

  it('displays all shortcut categories', async () => {
    render(<KeyboardShortcutsDialog />);
    
    // Open dialog
    fireEvent.keyDown(window, { key: '?' });
    
    await waitFor(() => {
      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Accessibility')).toBeInTheDocument();
    });
  });

  it('displays keyboard shortcuts with proper formatting', async () => {
    render(<KeyboardShortcutsDialog />);
    
    // Open dialog
    fireEvent.keyDown(window, { key: '?' });
    
    await waitFor(() => {
      expect(screen.getByText('Go to Home')).toBeInTheDocument();
      expect(screen.getByText('Focus Search')).toBeInTheDocument();
      expect(screen.getByText('Navigate Forward')).toBeInTheDocument();
    });
  });

  it('does not open when typing in input field', () => {
    const { container } = render(
      <div>
        <input type="text" />
        <KeyboardShortcutsDialog />
      </div>
    );
    
    const input = container.querySelector('input');
    if (input) {
      fireEvent.keyDown(input, { key: '?' });
    }
    
    // Dialog should not open
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('should not have accessibility violations', async () => {
    const { container } = render(<KeyboardShortcutsDialog />);
    
    // Open dialog
    fireEvent.keyDown(window, { key: '?' });
    
    await waitFor(async () => {
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
