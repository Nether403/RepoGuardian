import { Home, Compass, BarChart3, BookOpen, Search, Layers, GitCompare, Rocket, FolderOpen, TrendingUp, Users, Code, Plug, Bot, User, Bookmark, Tag, HelpCircle, FileText, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  label: string;
  path?: string;
  external?: boolean;
  dropdown?: NavigationItem[];
  icon?: LucideIcon;
  description?: string;
  requiresAuth?: boolean;
}

export const navigationConfig: NavigationItem[] = [
  {
    label: 'Home',
    path: '/home',
    icon: Home,
    requiresAuth: true,
  },
  {
    label: 'Code Review',
    path: '/code-review',
    icon: Shield,
    requiresAuth: false,
  },
  {
    label: 'Discover',
    icon: Compass,
    dropdown: [
      {
        label: 'Discover Repositories',
        path: '/discover',
        icon: Rocket,
        description: 'Explore trending repositories and emerging technologies',
      },
      {
        label: 'Trending Repositories',
        path: 'https://github.com/trending',
        icon: TrendingUp,
        external: true,
        description: 'View trending repositories on GitHub',
      },
      {
        label: 'Advanced Search',
        path: '/search',
        icon: Search,
        description: 'Search with powerful filters and sorting options',
      },
      {
        label: 'Batch Analysis',
        path: '/batch-analyze',
        icon: Layers,
        description: 'Analyze multiple repositories simultaneously',
      },
      {
        label: 'Compare Repos',
        path: '/compare',
        icon: GitCompare,
        description: 'Side-by-side repository comparisons',
      },
    ],
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    requiresAuth: true,
  },
  {
    label: 'Docs',
    icon: BookOpen,
    dropdown: [
      {
        label: 'Getting Started',
        path: '/docs/getting-started',
        icon: Rocket,
        description: 'Learn the basics and get up to speed quickly',
      },
      {
        label: 'Features',
        path: '/docs/features',
        icon: Layers,
        description: 'Explore all available features and capabilities',
      },
      {
        label: 'API Reference',
        path: '/docs/api-reference',
        icon: Code,
        description: 'Complete API documentation for developers',
      },
      {
        label: 'FAQ',
        path: '/docs/faq',
        icon: HelpCircle,
        description: 'Frequently asked questions and answers',
      },
      {
        label: 'Troubleshooting',
        path: '/docs/troubleshooting',
        icon: FileText,
        description: 'Common issues and how to resolve them',
      },
    ],
  },
];

// Workspace menu items (shown when authenticated)
export const workspaceMenuItems: NavigationItem[] = [
  {
    label: 'Collections',
    path: '/collections',
    icon: FolderOpen,
    description: 'Organize repositories into custom collections',
  },
  {
    label: 'Advanced Analytics',
    path: '/advanced-analytics',
    icon: BarChart3,
    description: 'Deep insights and predictions',
  },
  {
    label: 'Teams',
    path: '/teams',
    icon: Users,
    description: 'Collaborate with team members',
  },
  {
    label: 'Developer API',
    path: '/developer',
    icon: Code,
    description: 'API keys and documentation',
  },
  {
    label: 'Integrations',
    path: '/integrations',
    icon: Plug,
    description: 'Connect with external tools',
  },
  {
    label: 'AI Code Review',
    path: '/code-review',
    icon: Bot,
    description: 'AI-powered code analysis',
  },
  {
    label: 'Profile',
    path: '/profile',
    icon: User,
    description: 'Manage your account and preferences',
  },
  {
    label: 'Bookmarks',
    path: '/bookmarks',
    icon: Bookmark,
    description: 'Quick access to saved repositories',
  },
];

// User menu items (shown in user dropdown)
export const userMenuItems: NavigationItem[] = [
  {
    label: 'Profile',
    path: '/profile',
    icon: User,
  },
  {
    label: 'Subscription',
    path: '/subscription',
    icon: Tag,
  },
];

export const navigationBreakpoints = {
  mobile: 768,
  tablet: 1024,
};
