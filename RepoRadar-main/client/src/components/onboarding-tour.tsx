import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS } from 'react-joyride';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

const tourSteps: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: '🚀 Welcome to RepoAnalyzer!',
    content: (
      <div className="space-y-2">
        <p>Your AI-powered GitHub repository analysis platform.</p>
        <p className="text-sm text-gray-600">Let's take a quick tour to help you get started!</p>
      </div>
    ),
    disableBeacon: true,
  },
  {
    target: '[data-tour="search-box"]',
    title: '🔍 Smart Repository Search',
    content: 'Start by searching for any GitHub repository. Just paste a GitHub URL or search by name.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="analyze-button"]', 
    title: '🤖 AI-Powered Analysis',
    content: 'Click "Analyze" to get comprehensive insights using our advanced AI. We evaluate originality, completeness, marketability, and more!',
    placement: 'bottom',
  },
  {
    target: '[data-tour="ai-assistant"]',
    title: '✨ AI Assistant',
    content: 'Need help? Click the AI assistant button for instant, context-aware help with any feature!',
    placement: 'left',
  },
  {
    target: 'body',
    placement: 'center',
    title: '🎉 You\'re All Set!',
    content: (
      <div className="space-y-3">
        <p>Ready to start analyzing repositories?</p>
        <p className="text-sm text-gray-600">Try searching for your own GitHub repository or explore trending projects!</p>
        <p className="text-xs text-gray-500 mt-3">Tip: You can restart this tour anytime from your profile settings.</p>
      </div>
    ),
  },
];

interface OnboardingTourProps {
  onComplete?: () => void;
}

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [runTour, setRunTour] = useState(false);
  const [location] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Only run tour on home page after authentication
    if (location !== '/home') {
      return;
    }

    // Check if tour has been completed before
    const tourCompleted = localStorage.getItem('completedTour');
    const skipTour = localStorage.getItem('skipTour');
    
    if (!tourCompleted && !skipTour) {
      // Small delay to ensure page is fully loaded
      setTimeout(() => {
        setRunTour(true);
      }, 1500);
    }
  }, [location]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;

    if (status === STATUS.FINISHED) {
      // Mark tour as completed
      localStorage.setItem('completedTour', 'true');
      localStorage.setItem('tourCompletedDate', new Date().toISOString());
      setRunTour(false);
      
      toast({
        title: "Tour Completed! 🎉",
        description: "You can restart the tour anytime from your profile settings.",
      });
      
      if (onComplete) {
        onComplete();
      }
    } else if (status === STATUS.SKIPPED) {
      // Mark as skipped
      localStorage.setItem('skipTour', 'true');
      setRunTour(false);
      
      toast({
        title: "Tour Skipped",
        description: "You can restart the tour anytime from your profile settings.",
      });
    }
  };

  const joyrideStyles = {
    options: {
      primaryColor: 'rgb(59, 130, 246)', // Blue color matching the app theme
      backgroundColor: '#1f2937',
      textColor: '#ffffff',
      arrowColor: '#1f2937',
      overlayColor: 'rgba(0, 0, 0, 0.7)',
      beaconSize: 36,
      zIndex: 10000,
    },
    tooltip: {
      borderRadius: '8px',
      fontSize: '14px',
    },
    tooltipContainer: {
      textAlign: 'left' as const,
    },
    tooltipTitle: {
      fontSize: '18px',
      marginBottom: '8px',
    },
    tooltipContent: {
      padding: '8px 0',
    },
    buttonNext: {
      backgroundColor: 'rgb(59, 130, 246)',
      borderRadius: '6px',
      color: '#fff',
      fontSize: '14px',
      padding: '8px 16px',
    },
    buttonBack: {
      color: '#94a3b8',
      fontSize: '14px',
      marginRight: '8px',
    },
    buttonSkip: {
      color: '#64748b',
      fontSize: '14px',
    },
    spotlight: {
      borderRadius: '8px',
    },
  };

  if (!runTour) return null;

  return (
    <Joyride
      steps={tourSteps}
      run={runTour}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      scrollOffset={100}
      spotlightPadding={10}
      disableOverlayClose
      disableScrollParentFix
      callback={handleJoyrideCallback}
      styles={joyrideStyles}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish Tour',
        next: 'Next',
        skip: 'Skip Tour',
      }}
      floaterProps={{
        disableAnimation: false,
        disableFlip: false,
      }}
    />
  );
}

// Export function to restart tour programmatically
export function restartTour() {
  localStorage.removeItem('completedTour');
  localStorage.removeItem('skipTour');
  localStorage.removeItem('tourCompletedDate');
  window.location.reload();
}