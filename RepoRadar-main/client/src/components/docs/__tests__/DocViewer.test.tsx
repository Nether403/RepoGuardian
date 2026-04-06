import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocViewer } from '../DocViewer';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

describe('DocViewer', () => {
  const mockMetadata = {
    title: 'Test Document',
    description: 'A test document',
    category: 'getting-started',
    lastUpdated: '2025-01-10',
    author: 'Test Author',
    tags: ['test', 'documentation'],
  };

  const mockContent = `
# Test Heading

This is a test paragraph with **bold** and *italic* text.

\`\`\`javascript
const test = 'code block';
console.log(test);
\`\`\`

[Internal Link](/docs/test)
[External Link](https://example.com)

![Test Image](https://example.com/image.png)
  `;

  it('renders document title and metadata', () => {
    render(
      <DocViewer
        content={mockContent}
        metadata={mockMetadata}
        category="getting-started"
        docName="test"
      />
    );

    expect(screen.getByText('Test Document')).toBeInTheDocument();
    expect(screen.getByText('A test document')).toBeInTheDocument();
    expect(screen.getByText('Test Author', { exact: false })).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    render(
      <DocViewer
        content={mockContent}
        metadata={mockMetadata}
        category="getting-started"
        docName="test"
      />
    );

    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.getByText('Getting started')).toBeInTheDocument();
  });

  it('renders markdown content correctly', () => {
    render(
      <DocViewer
        content={mockContent}
        metadata={mockMetadata}
        category="getting-started"
        docName="test"
      />
    );

    expect(screen.getByText('Test Heading')).toBeInTheDocument();
    expect(screen.getByText(/This is a test paragraph/)).toBeInTheDocument();
  });

  it('renders code blocks with copy button', async () => {
    render(
      <DocViewer
        content={mockContent}
        metadata={mockMetadata}
        category="getting-started"
        docName="test"
      />
    );

    const codeBlock = screen.getByText(/const test = 'code block'/);
    expect(codeBlock).toBeInTheDocument();

    // Find copy button (it should be in the same container as the code)
    const copyButtons = screen.getAllByLabelText('Copy code');
    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it('copies code to clipboard when copy button is clicked', async () => {
    render(
      <DocViewer
        content={mockContent}
        metadata={mockMetadata}
        category="getting-started"
        docName="test"
      />
    );

    const copyButton = screen.getAllByLabelText('Copy code')[0];
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('renders external links with target="_blank"', () => {
    render(
      <DocViewer
        content={mockContent}
        metadata={mockMetadata}
        category="getting-started"
        docName="test"
      />
    );

    const externalLink = screen.getByText('External Link');
    expect(externalLink).toHaveAttribute('target', '_blank');
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders images with lazy loading', () => {
    render(
      <DocViewer
        content={mockContent}
        metadata={mockMetadata}
        category="getting-started"
        docName="test"
      />
    );

    const image = screen.getByAlt('Test Image');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('displays tags when provided', () => {
    render(
      <DocViewer
        content={mockContent}
        metadata={mockMetadata}
        category="getting-started"
        docName="test"
      />
    );

    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('documentation')).toBeInTheDocument();
  });

  it('formats last updated date correctly', () => {
    render(
      <DocViewer
        content={mockContent}
        metadata={mockMetadata}
        category="getting-started"
        docName="test"
      />
    );

    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });
});
