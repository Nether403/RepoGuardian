import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnhancedProgressIndicator } from '../progress-indicator';

describe('EnhancedProgressIndicator', () => {
  it('renders with loading status', () => {
    render(
      <EnhancedProgressIndicator
        progress={50}
        status="loading"
        message="Loading data..."
      />
    );
    
    expect(screen.getByText('Loading data...')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('renders with processing status', () => {
    render(
      <EnhancedProgressIndicator
        progress={75}
        status="processing"
        message="Processing..."
      />
    );
    
    expect(screen.getByText('Processing...')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('renders with complete status', () => {
    render(
      <EnhancedProgressIndicator
        progress={100}
        status="complete"
        message="Complete!"
      />
    );
    
    expect(screen.getByText('Complete!')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('renders with error status', () => {
    render(
      <EnhancedProgressIndicator
        progress={30}
        status="error"
        message="Error occurred"
      />
    );
    
    expect(screen.getByText('Error occurred')).toBeTruthy();
    expect(screen.getByText('30%')).toBeTruthy();
  });

  it('displays estimated time when provided', () => {
    render(
      <EnhancedProgressIndicator
        progress={40}
        status="loading"
        message="Loading..."
        estimatedTime={90}
      />
    );
    
    expect(screen.getByText('1m 30s')).toBeTruthy();
  });

  it('formats time correctly for seconds only', () => {
    render(
      <EnhancedProgressIndicator
        progress={40}
        status="loading"
        message="Loading..."
        estimatedTime={45}
      />
    );
    
    expect(screen.getByText('45s')).toBeTruthy();
  });

  it('does not show estimated time for complete status', () => {
    const { container } = render(
      <EnhancedProgressIndicator
        progress={100}
        status="complete"
        message="Complete!"
        estimatedTime={30}
      />
    );
    
    expect(screen.queryByText('30s')).toBeFalsy();
  });

  it('does not show estimated time for error status', () => {
    const { container } = render(
      <EnhancedProgressIndicator
        progress={50}
        status="error"
        message="Error"
        estimatedTime={30}
      />
    );
    
    expect(screen.queryByText('30s')).toBeFalsy();
  });

  it('uses default message when not provided', () => {
    render(
      <EnhancedProgressIndicator
        progress={50}
        status="loading"
      />
    );
    
    expect(screen.getByText('Processing...')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EnhancedProgressIndicator
        progress={50}
        status="loading"
        className="custom-progress"
      />
    );
    
    const element = container.querySelector('.custom-progress');
    expect(element).toBeTruthy();
  });

  it('renders correct icon for each status', () => {
    const { container: loadingContainer } = render(
      <EnhancedProgressIndicator progress={50} status="loading" />
    );
    expect(loadingContainer.querySelector('.animate-spin')).toBeTruthy();

    const { container: completeContainer } = render(
      <EnhancedProgressIndicator progress={100} status="complete" />
    );
    expect(completeContainer.querySelector('svg')).toBeTruthy();

    const { container: errorContainer } = render(
      <EnhancedProgressIndicator progress={50} status="error" />
    );
    expect(errorContainer.querySelector('svg')).toBeTruthy();
  });
});
