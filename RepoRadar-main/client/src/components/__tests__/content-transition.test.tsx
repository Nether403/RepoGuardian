import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ContentTransition } from '../content-transition';

describe('ContentTransition', () => {
  it('should render skeleton when loading', () => {
    render(
      <ContentTransition
        isLoading={true}
        skeleton={<div data-testid="skeleton">Loading...</div>}
      >
        <div data-testid="content">Content</div>
      </ContentTransition>
    );

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('should render content when not loading', async () => {
    render(
      <ContentTransition
        isLoading={false}
        skeleton={<div data-testid="skeleton">Loading...</div>}
      >
        <div data-testid="content">Content</div>
      </ContentTransition>
    );

    await waitFor(() => {
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ContentTransition
        isLoading={false}
        skeleton={<div>Loading...</div>}
        className="custom-class"
      >
        <div>Content</div>
      </ContentTransition>
    );

    const motionDiv = container.querySelector('.custom-class');
    expect(motionDiv).toBeInTheDocument();
  });

  it('should transition from skeleton to content', async () => {
    const { rerender } = render(
      <ContentTransition
        isLoading={true}
        skeleton={<div data-testid="skeleton">Loading...</div>}
      >
        <div data-testid="content">Content</div>
      </ContentTransition>
    );

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();

    rerender(
      <ContentTransition
        isLoading={false}
        skeleton={<div data-testid="skeleton">Loading...</div>}
      >
        <div data-testid="content">Content</div>
      </ContentTransition>
    );

    await waitFor(() => {
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });
});
