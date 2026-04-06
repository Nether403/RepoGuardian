import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonLoaderProps {
  className?: string;
  count?: number;
  height?: string;
  width?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className,
  count = 1,
  height = '20px',
  width = '100%',
}) => {
  return (
    <div className={cn('space-y-3 fade-in', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{
            height,
            width,
          }}
        />
      ))}
    </div>
  );
};

// Enhanced LoadingSkeleton component with variants
interface LoadingSkeletonProps {
  variant: 'card' | 'list' | 'table' | 'chart';
  count?: number;
  animate?: boolean;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant,
  count = 1,
  animate = true,
  className,
}) => {
  const animationClass = animate ? 'animate-pulse' : '';

  switch (variant) {
    case 'card':
      return (
        <div className={cn('space-y-4', className)}>
          {Array.from({ length: count }).map((_, index) => (
            <CardSkeleton key={index} animate={animate} />
          ))}
        </div>
      );
    case 'list':
      return (
        <div className={cn('space-y-3', className)}>
          {Array.from({ length: count }).map((_, index) => (
            <ListItemSkeleton key={index} animate={animate} />
          ))}
        </div>
      );
    case 'table':
      return <TableSkeleton rows={count} animate={animate} className={className} />;
    case 'chart':
      return <ChartSkeleton animate={animate} className={className} />;
    default:
      return null;
  }
};

export const CardSkeleton: React.FC<{ className?: string; animate?: boolean }> = ({ 
  className, 
  animate = true 
}) => {
  const animationClass = animate ? 'animate-pulse' : '';
  
  return (
    <div className={cn('p-6 rounded-lg border border-border bg-card fade-in', className)}>
      <div className={cn('skeleton h-6 w-3/4 mb-4', animationClass)} />
      <div className={cn('skeleton h-4 w-full mb-2', animationClass)} />
      <div className={cn('skeleton h-4 w-5/6 mb-4', animationClass)} />
      <div className="flex gap-4 mt-4">
        <div className={cn('skeleton h-8 w-20', animationClass)} />
        <div className={cn('skeleton h-8 w-20', animationClass)} />
        <div className={cn('skeleton h-8 w-20', animationClass)} />
      </div>
    </div>
  );
};

const ListItemSkeleton: React.FC<{ animate?: boolean }> = ({ animate = true }) => {
  const animationClass = animate ? 'animate-pulse' : '';
  
  return (
    <div className="p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-4">
        <div className={cn('skeleton h-12 w-12 rounded-full', animationClass)} />
        <div className="flex-1 space-y-2">
          <div className={cn('skeleton h-4 w-3/4', animationClass)} />
          <div className={cn('skeleton h-3 w-1/2', animationClass)} />
        </div>
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ 
  rows?: number; 
  className?: string; 
  animate?: boolean;
}> = ({ 
  rows = 5, 
  className,
  animate = true 
}) => {
  const animationClass = animate ? 'animate-pulse' : '';
  
  return (
    <div className={cn('w-full fade-in', className)}>
      <div className={cn('skeleton h-12 w-full mb-2', animationClass)} />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={cn('skeleton h-16 w-full mb-2', animationClass)} />
      ))}
    </div>
  );
};

const ChartSkeleton: React.FC<{ className?: string; animate?: boolean }> = ({ 
  className,
  animate = true 
}) => {
  const animationClass = animate ? 'animate-pulse' : '';
  
  return (
    <div className={cn('p-6 rounded-lg border border-border bg-card', className)}>
      <div className={cn('skeleton h-6 w-1/3 mb-6', animationClass)} />
      <div className="flex items-end justify-between gap-2 h-48">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className={cn('skeleton w-full', animationClass)}
            style={{ height: `${Math.random() * 60 + 40}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className={cn('skeleton h-3 w-8', animationClass)} />
        ))}
      </div>
    </div>
  );
};

export const ButtonSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return <div className={cn('skeleton h-10 w-24 rounded-md', className)} />;
};