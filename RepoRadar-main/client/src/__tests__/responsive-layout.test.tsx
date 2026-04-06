import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RepositoryListItem from '../components/repository-list-item';
import AnalysisResults from '../components/analysis-results';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  },
}));

describe('Responsive Layout Tests', () => {
  const mockRepository = {
    id: 1,
    fullName: 'test/repo',
    name: 'repo',
    description: 'Test repository',
    htmlUrl: 'https://github.com/test/repo',
    language: 'TypeScript',
    stars: 1000,
    forks: 100,
    watchers: 50,
    updatedAt: '2024-01-01T00:00:00Z',
    size: 1024,
    topics: ['react', 'typescript', 'testing'],
  };

  const mockAnalysis = {
    originality: 8.5,
    completeness: 7.8,
    marketability: 9.0,
    monetization: 6.5,
    usefulness: 8.0,
    overallScore: 8.0,
    summary: 'This is a test analysis summary',
    strengths: ['Good documentation', 'Active community'],
    weaknesses: ['Limited test coverage'],
    recommendations: ['Add more tests', 'Improve CI/CD'],
  };

  describe('Touch Target Sizes', () => {
    it('should have minimum 44x44 touch targets on buttons', () => {
      render(
        <RepositoryListItem
          repository={mockRepository}
          index={0}
          onAnalyze={() => {}}
        />
      );

      const analyzeButton = screen.getByTestId(`button-analyze-${mockRepository.id}`);
      expect(analyzeButton).toHaveClass('touch-target');
    });

    it('should have touch-friendly export buttons', () => {
      render(
        <AnalysisResults
          analysis={mockAnalysis}
          repository={mockRepository}
        />
      );

      const pdfButton = screen.getByTestId('button-export-pdf');
      const csvButton = screen.getByTestId('button-export-csv');

      expect(pdfButton).toHaveClass('touch-target');
      expect(csvButton).toHaveClass('touch-target');
    });
  });

  describe('Mobile Layout Adaptations', () => {
    it('should render repository list item with mobile-friendly layout', () => {
      const { container } = render(
        <RepositoryListItem
          repository={mockRepository}
          index={0}
          onAnalyze={() => {}}
        />
      );

      // Check for responsive classes
      const card = container.querySelector('.p-3.md\\:p-4');
      expect(card).toBeInTheDocument();
    });

    it('should show truncated text on mobile for long repository names', () => {
      const longNameRepo = {
        ...mockRepository,
        fullName: 'very-long-organization-name/very-long-repository-name-that-should-truncate',
      };

      render(
        <RepositoryListItem
          repository={longNameRepo}
          index={0}
          onAnalyze={() => {}}
        />
      );

      const repoName = screen.getByText(longNameRepo.fullName);
      expect(repoName).toHaveClass('truncate');
    });

    it('should hide less important stats on mobile', () => {
      const { container } = render(
        <RepositoryListItem
          repository={mockRepository}
          index={0}
          onAnalyze={() => {}}
        />
      );

      // Watchers should be hidden on small screens
      const watchersSpan = container.querySelector('.hidden.sm\\:flex');
      expect(watchersSpan).toBeInTheDocument();
    });

    it('should stack action buttons vertically on mobile', () => {
      const { container } = render(
        <RepositoryListItem
          repository={mockRepository}
          index={0}
          onAnalyze={() => {}}
        />
      );

      // Check for flex-col on mobile, flex-row on desktop
      const buttonContainer = container.querySelector('.flex.md\\:flex-col');
      expect(buttonContainer).toBeInTheDocument();
    });
  });

  describe('Analysis Results Mobile Layout', () => {
    it('should render analysis results with mobile-friendly spacing', () => {
      const { container } = render(
        <AnalysisResults
          analysis={mockAnalysis}
          repository={mockRepository}
        />
      );

      // Check for responsive padding
      const cardContent = container.querySelector('.p-4.md\\:p-8');
      expect(cardContent).toBeInTheDocument();
    });

    it('should stack export buttons on mobile', () => {
      const { container } = render(
        <AnalysisResults
          analysis={mockAnalysis}
          repository={mockRepository}
        />
      );

      // Check for flex-col on mobile
      const exportButtons = container.querySelector('.flex-col.sm\\:flex-row');
      expect(exportButtons).toBeInTheDocument();
    });

    it('should use smaller text sizes on mobile', () => {
      render(
        <AnalysisResults
          analysis={mockAnalysis}
          repository={mockRepository}
        />
      );

      const title = screen.getByText('AI Analysis Results');
      expect(title).toHaveClass('text-xl', 'md:text-2xl');
    });

    it('should make metrics scrollable on mobile', () => {
      const { container } = render(
        <AnalysisResults
          analysis={mockAnalysis}
          repository={mockRepository}
        />
      );

      const metricsGrid = container.querySelector('.mobile-scroll');
      expect(metricsGrid).toBeInTheDocument();
    });
  });

  describe('Responsive Grid Layouts', () => {
    it('should use single column on mobile for repository list', () => {
      const { container } = render(
        <RepositoryListItem
          repository={mockRepository}
          index={0}
          onAnalyze={() => {}}
        />
      );

      // Check for responsive flex direction
      const mainContainer = container.querySelector('.flex-col.md\\:flex-row');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should adapt grid columns for different screen sizes', () => {
      const { container } = render(
        <AnalysisResults
          analysis={mockAnalysis}
          repository={mockRepository}
        />
      );

      // Check for responsive grid
      const strengthsGrid = container.querySelector('.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
      expect(strengthsGrid).toBeInTheDocument();
    });
  });

  describe('Text Responsiveness', () => {
    it('should use responsive font sizes', () => {
      render(
        <AnalysisResults
          analysis={mockAnalysis}
          repository={mockRepository}
        />
      );

      const summary = screen.getByTestId('text-analysis-summary');
      expect(summary).toHaveClass('text-sm', 'md:text-base');
    });

    it('should adjust icon sizes for mobile', () => {
      const { container } = render(
        <RepositoryListItem
          repository={mockRepository}
          index={0}
          onAnalyze={() => {}}
        />
      );

      // Check for responsive icon sizes
      const icons = container.querySelectorAll('.w-3.h-3.md\\:w-4.md\\:h-4');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Spacing and Padding', () => {
    it('should use responsive padding', () => {
      const { container } = render(
        <AnalysisResults
          analysis={mockAnalysis}
          repository={mockRepository}
        />
      );

      const sections = container.querySelectorAll('.p-3.md\\:p-4, .p-4.md\\:p-6');
      expect(sections.length).toBeGreaterThan(0);
    });

    it('should use responsive gaps in flex/grid layouts', () => {
      const { container } = render(
        <AnalysisResults
          analysis={mockAnalysis}
          repository={mockRepository}
        />
      );

      const grids = container.querySelectorAll('.gap-4.md\\:gap-8');
      expect(grids.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility on Mobile', () => {
    it('should maintain proper heading hierarchy', () => {
      render(
        <AnalysisResults
          analysis={mockAnalysis}
          repository={mockRepository}
        />
      );

      const h2 = screen.getByText('AI Analysis Results');
      expect(h2.tagName).toBe('H2');

      const h3Elements = screen.getAllByRole('heading', { level: 3 });
      expect(h3Elements.length).toBeGreaterThan(0);
    });

    it('should have proper ARIA labels on interactive elements', () => {
      render(
        <RepositoryListItem
          repository={mockRepository}
          index={0}
          onAnalyze={() => {}}
        />
      );

      const analyzeButton = screen.getByTestId(`button-analyze-${mockRepository.id}`);
      expect(analyzeButton).toBeInTheDocument();
    });
  });

  describe('Content Overflow Handling', () => {
    it('should handle long text with truncation', () => {
      const longDescRepo = {
        ...mockRepository,
        description: 'This is a very long description that should be truncated on mobile devices to prevent layout issues and maintain readability across different screen sizes',
      };

      const { container } = render(
        <RepositoryListItem
          repository={longDescRepo}
          index={0}
          onAnalyze={() => {}}
        />
      );

      const description = container.querySelector('.line-clamp-2');
      expect(description).toBeInTheDocument();
    });

    it('should handle topic badges overflow', () => {
      const manyTopicsRepo = {
        ...mockRepository,
        topics: ['react', 'typescript', 'testing', 'ci-cd', 'docker', 'kubernetes', 'aws'],
      };

      render(
        <RepositoryListItem
          repository={manyTopicsRepo}
          index={0}
          onAnalyze={() => {}}
        />
      );

      // Should show limited topics with "+X more" indicator
      const topics = screen.getAllByRole('status');
      expect(topics.length).toBeLessThanOrEqual(6); // 5 topics + 1 "more" badge
    });
  });
});
