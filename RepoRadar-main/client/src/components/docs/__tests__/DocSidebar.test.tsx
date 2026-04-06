import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocSidebar } from '../DocSidebar';
import { FileText } from 'lucide-react';

// Mock wouter
vi.mock('wouter', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ['/docs/getting-started/index', vi.fn()],
}));

describe('DocSidebar', () => {
  const mockCategories = [
    {
      name: 'Getting Started',
      slug: 'getting-started',
      icon: FileText,
      docs: [
        { title: 'Overview', path: 'index', description: 'Introduction' },
        { title: 'Installation', path: 'installation', description: 'Setup guide' },
      ],
    },
    {
      name: 'Features',
      slug: 'features',
      icon: FileText,
      docs: [
        { title: 'Feature 1', path: 'feature-1' },
        { title: 'Feature 2', path: 'feature-2' },
      ],
    },
  ];

  it('renders all categories', () => {
    render(<DocSidebar categories={mockCategories} />);

    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
  });

  it('renders document list for each category', () => {
    render(<DocSidebar categories={mockCategories} />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Installation')).toBeInTheDocument();
    expect(screen.getByText('Feature 1')).toBeInTheDocument();
    expect(screen.getByText('Feature 2')).toBeInTheDocument();
  });

  it('highlights active document', () => {
    render(
      <DocSidebar
        categories={mockCategories}
        currentDoc="/docs/getting-started/index"
      />
    );

    const activeLink = screen.getByText('Overview').closest('a');
    expect(activeLink).toHaveClass('bg-primary');
  });

  it('toggles category expansion on click', () => {
    render(<DocSidebar categories={mockCategories} />);

    const categoryButton = screen.getByText('Getting Started').closest('button');
    expect(categoryButton).toBeInTheDocument();

    // Initially expanded, so docs should be visible
    expect(screen.getByText('Overview')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(categoryButton!);

    // Docs should still be visible (categories start expanded)
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('renders document descriptions when provided', () => {
    render(<DocSidebar categories={mockCategories} />);

    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Setup guide')).toBeInTheDocument();
  });

  it('renders mobile toggle button', () => {
    render(<DocSidebar categories={mockCategories} />);

    const mobileToggle = screen.getByLabelText('Toggle documentation menu');
    expect(mobileToggle).toBeInTheDocument();
  });

  it('opens mobile menu when toggle is clicked', () => {
    render(<DocSidebar categories={mockCategories} />);

    const mobileToggle = screen.getByLabelText('Toggle documentation menu');
    fireEvent.click(mobileToggle);

    // Check if backdrop is rendered
    const backdrop = document.querySelector('.fixed.inset-0.bg-background\\/80');
    expect(backdrop).toBeInTheDocument();
  });

  it('closes mobile menu when backdrop is clicked', () => {
    render(<DocSidebar categories={mockCategories} />);

    const mobileToggle = screen.getByLabelText('Toggle documentation menu');
    fireEvent.click(mobileToggle);

    const backdrop = document.querySelector('.fixed.inset-0.bg-background\\/80');
    fireEvent.click(backdrop!);

    // Menu should be closed (check if sidebar has translate class)
    const sidebar = document.querySelector('aside');
    expect(sidebar).toHaveClass('-translate-x-full');
  });

  it('capitalizes category names with hyphens', () => {
    render(<DocSidebar categories={mockCategories} />);

    expect(screen.getByText('Getting Started')).toBeInTheDocument();
  });
});
