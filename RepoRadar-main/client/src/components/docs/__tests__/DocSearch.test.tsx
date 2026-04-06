import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocSearch } from '../DocSearch';

// Mock wouter
const mockSetLocation = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/docs', mockSetLocation],
}));

describe('DocSearch', () => {
  const mockDocuments = [
    {
      title: 'Getting Started',
      path: '/docs/getting-started/index',
      category: 'getting-started',
      description: 'Introduction to the platform',
      content: 'This is a guide to help you get started with our platform.',
    },
    {
      title: 'Installation Guide',
      path: '/docs/getting-started/installation',
      category: 'getting-started',
      description: 'How to install the software',
      content: 'Follow these steps to install the software on your system.',
    },
    {
      title: 'API Reference',
      path: '/docs/api-reference/index',
      category: 'api-reference',
      description: 'Complete API documentation',
      content: 'This document contains all API endpoints and their usage.',
    },
  ];

  beforeEach(() => {
    mockSetLocation.mockClear();
  });

  it('renders search input', () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/);
    expect(searchInput).toBeInTheDocument();
  });

  it('shows no results initially', () => {
    render(<DocSearch documents={mockDocuments} />);

    expect(screen.queryByText(/result/)).not.toBeInTheDocument();
  });

  it('displays search results when query is entered', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/);
    fireEvent.change(searchInput, { target: { value: 'getting' } });

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
      expect(screen.getByText('Installation Guide')).toBeInTheDocument();
    });
  });

  it('filters results based on search query', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/);
    fireEvent.change(searchInput, { target: { value: 'api' } });

    await waitFor(() => {
      expect(screen.getByText('API Reference')).toBeInTheDocument();
      expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
    });
  });

  it('shows "no results" message when no matches found', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText(/No results found/)).toBeInTheDocument();
    });
  });

  it('navigates to document when result is clicked', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/);
    fireEvent.change(searchInput, { target: { value: 'getting' } });

    await waitFor(() => {
      const result = screen.getByText('Getting Started');
      fireEvent.click(result.closest('button')!);
    });

    expect(mockSetLocation).toHaveBeenCalledWith('/docs/getting-started/index');
  });

  it('clears search when clear button is clicked', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'test' } });

    await waitFor(() => {
      const clearButton = screen.getByLabelText('Clear search');
      fireEvent.click(clearButton);
    });

    expect(searchInput.value).toBe('');
  });

  it('closes results when clicking outside', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/);
    fireEvent.change(searchInput, { target: { value: 'getting' } });

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });

    // Click outside
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
    });
  });

  it('displays result count', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/);
    fireEvent.change(searchInput, { target: { value: 'getting' } });

    await waitFor(() => {
      expect(screen.getByText(/2 results/)).toBeInTheDocument();
    });
  });

  it('highlights matching text in results', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/);
    fireEvent.change(searchInput, { target: { value: 'api' } });

    await waitFor(() => {
      const marks = document.querySelectorAll('mark');
      expect(marks.length).toBeGreaterThan(0);
    });
  });

  it('requires minimum 2 characters to search', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/);
    fireEvent.change(searchInput, { target: { value: 'a' } });

    // Should not show results with only 1 character
    expect(screen.queryByText(/result/)).not.toBeInTheDocument();
  });

  it('displays category for each result', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/);
    fireEvent.change(searchInput, { target: { value: 'getting' } });

    await waitFor(() => {
      expect(screen.getAllByText('getting started').length).toBeGreaterThan(0);
    });
  });

  it('clears results and closes dropdown after navigation', async () => {
    render(<DocSearch documents={mockDocuments} />);

    const searchInput = screen.getByPlaceholderText(/Search documentation/) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'getting' } });

    await waitFor(() => {
      const result = screen.getByText('Getting Started');
      fireEvent.click(result.closest('button')!);
    });

    expect(searchInput.value).toBe('');
  });
});
