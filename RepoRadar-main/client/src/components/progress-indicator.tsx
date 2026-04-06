import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  isAnalyzing: boolean;
}

export function ProgressIndicator({ isAnalyzing }: ProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!isAnalyzing) {
      setProgress(0);
      setStatus('');
      return;
    }

    const stages = [
      { progress: 10, status: 'Fetching repository data...', duration: 1000 },
      { progress: 25, status: 'Analyzing code structure...', duration: 2000 },
      { progress: 40, status: 'Evaluating completeness...', duration: 2000 },
      { progress: 55, status: 'Assessing marketability...', duration: 2000 },
      { progress: 70, status: 'Calculating monetization potential...', duration: 2000 },
      { progress: 85, status: 'Generating recommendations...', duration: 2000 },
      { progress: 95, status: 'Finalizing analysis...', duration: 1000 },
    ];

    let currentStage = 0;
    
    const updateProgress = () => {
      if (currentStage < stages.length) {
        setProgress(stages[currentStage].progress);
        setStatus(stages[currentStage].status);
        
        setTimeout(() => {
          currentStage++;
          updateProgress();
        }, stages[currentStage].duration);
      }
    };

    updateProgress();
  }, [isAnalyzing]);

  if (!isAnalyzing) return null;

  return (
    <Card className="bg-card/50 border border-border backdrop-blur-sm mt-6">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">{status}</span>
            <span className="text-sm text-gray-400">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-gray-800">
            <div 
              className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </Progress>
        </div>
      </CardContent>
    </Card>
  );
}

// Enhanced ProgressIndicator with status tracking
export type ProgressStatus = 'loading' | 'processing' | 'complete' | 'error';

interface EnhancedProgressIndicatorProps {
  progress: number; // 0-100
  status: ProgressStatus;
  message?: string;
  estimatedTime?: number; // seconds
  className?: string;
}

export function EnhancedProgressIndicator({
  progress,
  status,
  message,
  estimatedTime,
  className,
}: EnhancedProgressIndicatorProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'from-blue-500 to-blue-600';
      case 'processing':
        return 'from-primary to-secondary';
      case 'complete':
        return 'from-green-500 to-green-600';
      case 'error':
        return 'from-red-500 to-red-600';
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card className={cn('bg-card/50 border border-border backdrop-blur-sm', className)}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <span className="text-sm font-medium text-gray-300">
                {message || 'Processing...'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {estimatedTime !== undefined && status !== 'complete' && status !== 'error' && (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(estimatedTime)}</span>
                </div>
              )}
              <span className="text-sm text-gray-400">{progress}%</span>
            </div>
          </div>
          <Progress value={progress} className="h-2 bg-gray-800">
            <div 
              className={cn(
                'h-full bg-gradient-to-r transition-all duration-500',
                getStatusColor()
              )}
              style={{ width: `${progress}%` }}
            />
          </Progress>
        </div>
      </CardContent>
    </Card>
  );
}