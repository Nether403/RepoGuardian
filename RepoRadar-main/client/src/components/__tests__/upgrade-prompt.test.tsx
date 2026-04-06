import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpgradePrompt } from '../upgrade-prompt';

// Mock wouter
vi.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('UpgradePrompt', () => {
  describe('Full version (default)', () => {
    it('renders the full upgrade prompt with all features', () => {
      render(<UpgradePrompt />);
      
      expect(screen.getByText('Unlock Intelligent Profile Features')).toBeInTheDocument();
      expect(screen.getByText('AI Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Smart Bookmarks')).toBeInTheDocument();
      expect(screen.getByText('Custom Tags')).toBeInTheDocument();
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });

    it('displays upgrade buttons', () => {
      render(<UpgradePrompt />);
      
      const upgradeButtons = screen.getAllByText('Upgrade to Pro');
      expect(upgradeButtons.length).toBeGreaterThan(0);
      expect(screen.getByText('Compare Plans')).toBeInTheDocument();
    });

    it('shows pricing information', () => {
      render(<UpgradePrompt />);
      
      expect(screen.getByText(/\$9\.99\/month/)).toBeInTheDocument();
    });

    it('links to pricing page', () => {
      render(<UpgradePrompt />);
      
      const links = screen.getAllByRole('link');
      const pricingLinks = links.filter(link => link.getAttribute('href') === '/pricing');
      expect(pricingLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Compact version', () => {
    it('renders compact version for bookmarks feature', () => {
      render(<UpgradePrompt feature="bookmarks" compact />);
      
      expect(screen.getByText('Smart Bookmarks')).toBeInTheDocument();
      expect(screen.getByText(/Save and organize repositories/)).toBeInTheDocument();
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    });

    it('renders compact version for tags feature', () => {
      render(<UpgradePrompt feature="tags" compact />);
      
      expect(screen.getByText('Custom Tags')).toBeInTheDocument();
      expect(screen.getByText(/Categorize repositories/)).toBeInTheDocument();
    });

    it('renders compact version for preferences feature', () => {
      render(<UpgradePrompt feature="preferences" compact />);
      
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
      expect(screen.getByText(/Set your preferences/)).toBeInTheDocument();
    });

    it('renders compact version for recommendations feature', () => {
      render(<UpgradePrompt feature="recommendations" compact />);
      
      expect(screen.getByText('AI Recommendations')).toBeInTheDocument();
      expect(screen.getByText(/Get personalized repository suggestions/)).toBeInTheDocument();
    });

    it('renders generic compact version when feature is "all"', () => {
      render(<UpgradePrompt feature="all" compact />);
      
      expect(screen.getByText('Premium Feature')).toBeInTheDocument();
      expect(screen.getByText(/This feature is available for Pro and Enterprise users/)).toBeInTheDocument();
    });

    it('does not show all feature cards in compact mode', () => {
      render(<UpgradePrompt feature="bookmarks" compact />);
      
      // Should not show other features
      expect(screen.queryByText('Custom Tags')).not.toBeInTheDocument();
      expect(screen.queryByText('AI Preferences')).not.toBeInTheDocument();
    });
  });

  describe('Feature-specific full version', () => {
    it('renders full version for specific feature', () => {
      render(<UpgradePrompt feature="bookmarks" />);
      
      // Should still show all features in full mode
      expect(screen.getByText('AI Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Smart Bookmarks')).toBeInTheDocument();
      expect(screen.getByText('Custom Tags')).toBeInTheDocument();
      expect(screen.getByText('AI Preferences')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<UpgradePrompt />);
      
      const heading = screen.getByText('Unlock Intelligent Profile Features');
      expect(heading).toBeInTheDocument();
    });

    it('has descriptive text for screen readers', () => {
      render(<UpgradePrompt />);
      
      expect(screen.getByText(/Upgrade to Pro or Enterprise/)).toBeInTheDocument();
    });

    it('compact version has proper heading', () => {
      render(<UpgradePrompt feature="bookmarks" compact />);
      
      const heading = screen.getByText('Smart Bookmarks');
      expect(heading.tagName).toBe('H3');
    });
  });
});
