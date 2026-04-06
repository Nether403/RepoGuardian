import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorMessage, InlineErrorMessage } from '../error-message';
import { AppError } from '@/../../shared/errors';

describe('ErrorMessage', () => {
  it('should render error message', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500
    );

    render(<ErrorMessage error={error} />);

    expect(screen.getByText('User-friendly error message')).toBeInTheDocument();
  });

  it('should render recovery action', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500,
      'Please try again later'
    );

    render(<ErrorMessage error={error} />);

    expect(screen.getByText(/Please try again later/)).toBeInTheDocument();
  });

  it('should render retry button when onRetry is provided', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500
    );
    const onRetry = vi.fn();

    render(<ErrorMessage error={error} onRetry={onRetry} />);

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500
    );
    const onRetry = vi.fn();

    render(<ErrorMessage error={error} onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /try again/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should render dismiss button when onDismiss is provided', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500
    );
    const onDismiss = vi.fn();

    render(<ErrorMessage error={error} onDismiss={onDismiss} />);

    expect(screen.getByRole('button', { name: /dismiss error/i })).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500
    );
    const onDismiss = vi.fn();

    render(<ErrorMessage error={error} onDismiss={onDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    await user.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should show error details when showDetails is true', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500,
      undefined,
      { detail: 'test detail' }
    );

    render(<ErrorMessage error={error} showDetails={true} />);

    expect(screen.getByText('Technical details')).toBeInTheDocument();
  });

  it('should not show error details when showDetails is false', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500,
      undefined,
      { detail: 'test detail' }
    );

    render(<ErrorMessage error={error} showDetails={false} />);

    expect(screen.queryByText('Technical details')).not.toBeInTheDocument();
  });

  it('should render with error severity', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500
    );

    const { container } = render(<ErrorMessage error={error} severity="error" />);

    // Check for destructive variant class
    expect(container.querySelector('[class*="destructive"]')).toBeInTheDocument();
  });

  it('should render with warning severity', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500
    );

    render(<ErrorMessage error={error} severity="warning" />);

    // Should render without destructive variant
    expect(screen.getByText('User-friendly error message')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const error = new AppError(
      'TEST_ERROR',
      'Internal message',
      'User-friendly error message',
      500
    );

    const { container } = render(
      <ErrorMessage error={error} className="custom-class" />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});

describe('InlineErrorMessage', () => {
  it('should render inline error message', () => {
    render(<InlineErrorMessage message="This field is required" />);

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <InlineErrorMessage message="Error" className="custom-class" />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should render with error icon', () => {
    const { container } = render(<InlineErrorMessage message="Error" />);

    // Check for lucide icon
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
