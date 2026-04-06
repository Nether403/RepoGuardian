import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { 
  LoadingSkeleton, 
  CardSkeleton, 
  TableSkeleton,
  ButtonSkeleton 
} from '../skeleton-loader';

describe('LoadingSkeleton', () => {
  it('renders card variant with correct count', () => {
    const { container } = render(<LoadingSkeleton variant="card" count={3} />);
    const cards = container.querySelectorAll('.p-6.rounded-lg');
    expect(cards.length).toBe(3);
  });

  it('renders list variant with correct count', () => {
    const { container } = render(<LoadingSkeleton variant="list" count={5} />);
    const listItems = container.querySelectorAll('.p-4.rounded-lg');
    expect(listItems.length).toBe(5);
  });

  it('renders table variant', () => {
    const { container } = render(<LoadingSkeleton variant="table" count={4} />);
    const rows = container.querySelectorAll('.skeleton.h-16');
    expect(rows.length).toBe(4);
  });

  it('renders chart variant', () => {
    const { container } = render(<LoadingSkeleton variant="chart" />);
    const chart = container.querySelector('.p-6.rounded-lg');
    expect(chart).toBeTruthy();
  });

  it('applies animation class when animate is true', () => {
    const { container } = render(<LoadingSkeleton variant="card" animate={true} />);
    const animatedElement = container.querySelector('.animate-pulse');
    expect(animatedElement).toBeTruthy();
  });

  it('does not apply animation class when animate is false', () => {
    const { container } = render(<LoadingSkeleton variant="card" animate={false} />);
    const animatedElement = container.querySelector('.animate-pulse');
    expect(animatedElement).toBeFalsy();
  });

  it('applies custom className', () => {
    const { container } = render(
      <LoadingSkeleton variant="card" className="custom-class" />
    );
    const element = container.querySelector('.custom-class');
    expect(element).toBeTruthy();
  });
});

describe('CardSkeleton', () => {
  it('renders card skeleton structure', () => {
    const { container } = render(<CardSkeleton />);
    const card = container.querySelector('.p-6.rounded-lg');
    expect(card).toBeTruthy();
    
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('applies animation by default', () => {
    const { container } = render(<CardSkeleton />);
    const animatedElement = container.querySelector('.animate-pulse');
    expect(animatedElement).toBeTruthy();
  });

  it('can disable animation', () => {
    const { container } = render(<CardSkeleton animate={false} />);
    const animatedElement = container.querySelector('.animate-pulse');
    expect(animatedElement).toBeFalsy();
  });
});

describe('TableSkeleton', () => {
  it('renders correct number of rows', () => {
    const { container } = render(<TableSkeleton rows={7} />);
    const rows = container.querySelectorAll('.skeleton.h-16');
    expect(rows.length).toBe(7);
  });

  it('renders header row', () => {
    const { container } = render(<TableSkeleton />);
    const header = container.querySelector('.skeleton.h-12');
    expect(header).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(<TableSkeleton className="custom-table" />);
    const element = container.querySelector('.custom-table');
    expect(element).toBeTruthy();
  });
});

describe('ButtonSkeleton', () => {
  it('renders button skeleton', () => {
    const { container } = render(<ButtonSkeleton />);
    const button = container.querySelector('.skeleton.h-10');
    expect(button).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(<ButtonSkeleton className="custom-button" />);
    const element = container.querySelector('.custom-button');
    expect(element).toBeTruthy();
  });
});
