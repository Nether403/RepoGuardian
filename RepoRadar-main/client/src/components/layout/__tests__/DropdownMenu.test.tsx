import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownMenu, DropdownMenuItem } from '../DropdownMenu';

// Mock wouter
vi.mock('wouter', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('DropdownMenu', () => {
  const mockItems: DropdownMenuItem[] = [
    { label: 'Internal Link', path: '/internal' },
    { label: 'External Link', path: 'https://example.com', external: true },
    { label: 'No Path Item' },
  ];

  const mockOnItemClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Opening and Closing', () => {
    it('renders trigger button with correct attributes', () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-haspopup', 'true');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens dropdown on click', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });

      // Check that menu items are visible
      expect(screen.getByText('Internal Link')).toBeInTheDocument();
      expect(screen.getByText('External Link')).toBeInTheDocument();
    });

    it('opens dropdown on hover', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });

      expect(screen.getByText('Internal Link')).toBeInTheDocument();
    });

    it('closes dropdown on mouse leave after delay', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      
      // Open dropdown
      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });

      // Leave dropdown
      fireEvent.mouseLeave(trigger);
      
      // Fast-forward time to trigger the timeout
      vi.advanceTimersByTime(200);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('closes dropdown when item is selected', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} onItemClick={mockOnItemClick} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Internal Link')).toBeInTheDocument();
      });

      const internalLink = screen.getByText('Internal Link');
      await userEvent.click(internalLink);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('closes dropdown on escape key', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });

      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('closes dropdown when clicking outside', async () => {
      render(
        <div>
          <DropdownMenu trigger={<>Menu</>} items={mockItems} />
          <div data-testid="outside">Outside</div>
        </div>
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });

      const outside = screen.getByTestId('outside');
      await userEvent.click(outside);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports tab navigation to trigger', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      await userEvent.tab();

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveFocus();
    });

    it('shows focus indicator on trigger', () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveClass('focus-visible:ring-2');
    });

    it('supports arrow key navigation through menu items', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Internal Link')).toBeInTheDocument();
      });

      // Arrow down should focus next item
      await userEvent.keyboard('{ArrowDown}');
      
      // Verify menu items are accessible
      const internalLink = screen.getByText('Internal Link');
      expect(internalLink).toBeInTheDocument();
    });

    it('supports Enter key to select menu item', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} onItemClick={mockOnItemClick} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Internal Link')).toBeInTheDocument();
      });

      const internalLink = screen.getByText('Internal Link');
      internalLink.focus();
      await userEvent.keyboard('{Enter}');

      expect(mockOnItemClick).toHaveBeenCalledWith(mockItems[0]);
    });

    it('supports Space key to select menu item', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} onItemClick={mockOnItemClick} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('No Path Item')).toBeInTheDocument();
      });

      const noPathItem = screen.getByText('No Path Item');
      noPathItem.focus();
      await userEvent.keyboard(' ');

      expect(mockOnItemClick).toHaveBeenCalledWith(mockItems[2]);
    });
  });

  describe('External Links', () => {
    it('opens external links in new tab', async () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('External Link')).toBeInTheDocument();
      });

      const externalLink = screen.getByText('External Link');
      await userEvent.click(externalLink);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer'
      );

      windowOpenSpy.mockRestore();
    });

    it('calls onItemClick for external links', async () => {
      vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} onItemClick={mockOnItemClick} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('External Link')).toBeInTheDocument();
      });

      const externalLink = screen.getByText('External Link');
      await userEvent.click(externalLink);

      expect(mockOnItemClick).toHaveBeenCalledWith(mockItems[1]);
    });

    it('renders internal links as Link components', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Internal Link')).toBeInTheDocument();
      });

      const internalLink = screen.getByText('Internal Link').closest('a');
      expect(internalLink).toHaveAttribute('href', '/internal');
    });

    it('renders external links as buttons', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('External Link')).toBeInTheDocument();
      });

      const externalLink = screen.getByText('External Link');
      // External links are rendered as menu items, not anchor tags
      expect(externalLink.closest('a')).not.toBeInTheDocument();
    });
  });

  describe('Alignment', () => {
    it('renders with default start alignment', () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toBeInTheDocument();
    });

    it('accepts custom alignment prop', () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} align="end" />
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('Icons', () => {
    it('renders items with icons', async () => {
      const MockIcon = ({ className }: { className?: string }) => (
        <svg className={className} data-testid="mock-icon" />
      );

      const itemsWithIcons: DropdownMenuItem[] = [
        { label: 'With Icon', path: '/icon', icon: MockIcon },
      ];

      render(
        <DropdownMenu trigger={<>Menu</>} items={itemsWithIcons} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('With Icon')).toBeInTheDocument();
      });

      expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });
  });

  describe('Chevron Animation', () => {
    it('rotates chevron when dropdown is open', async () => {
      const { container } = render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      const chevron = container.querySelector('[aria-hidden="true"]');

      expect(chevron).not.toHaveClass('rotate-180');

      await userEvent.click(trigger);

      await waitFor(() => {
        expect(chevron).toHaveClass('rotate-180');
      });
    });
  });

  describe('Hover Behavior', () => {
    it('keeps dropdown open when hovering over content', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      
      // Open dropdown
      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });

      // Move mouse to content
      const content = screen.getByText('Internal Link').closest('[role]')?.parentElement;
      if (content) {
        fireEvent.mouseEnter(content);
      }

      // Fast-forward time
      vi.advanceTimersByTime(200);

      // Should still be open
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-haspopup', 'true');
      expect(trigger).toHaveAttribute('aria-expanded');
    });

    it('chevron has aria-hidden attribute', () => {
      const { container } = render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const chevron = container.querySelector('[aria-hidden="true"]');
      expect(chevron).toBeInTheDocument();
    });

    it('menu items have proper hover styles', async () => {
      render(
        <DropdownMenu trigger={<>Menu</>} items={mockItems} />
      );

      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Internal Link')).toBeInTheDocument();
      });

      const menuItem = screen.getByText('Internal Link').parentElement;
      expect(menuItem).toHaveClass('hover:bg-accent');
    });
  });
});
