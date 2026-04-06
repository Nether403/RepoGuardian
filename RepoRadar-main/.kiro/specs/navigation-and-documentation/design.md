# Design Document

## Overview

This design document outlines the implementation approach for improving RepoRadar's navigation system and adding a comprehensive documentation section. The enhancements will provide consistent navigation across all pages, fix routing issues in the Discover menu, and introduce a centralized documentation hub for user guidance.

### Goals
- Implement fixed header navigation across all pages
- Restructure Discover menu with correct routing
- Create a documentation section with help resources
- Ensure mobile responsiveness
- Maintain accessibility standards

### Non-Goals
- Complete redesign of the UI theme
- Advanced documentation features (versioning, translations)
- User-generated documentation
- Video tutorials (future enhancement)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Header Component                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Home   │  │ Discover │  │Analytics │  │   Docs   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                      │              │                        │
│                      ▼              ▼                        │
│              ┌──────────────┐  ┌──────────────┐            │
│              │ Dropdown Menu│  │ Dropdown Menu│            │
│              └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Page Content                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Current Page (Home, Discover, Analytics, Docs, etc) │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App
├── Header (fixed, persistent)
│   ├── Logo
│   ├── Navigation
│   │   ├── HomeLink
│   │   ├── DiscoverDropdown
│   │   │   ├── DiscoverRepositories
│   │   │   └── TrendingRepositories (external)
│   │   ├── AnalyticsLink
│   │   └── DocsDropdown
│   │       ├── GettingStarted
│   │       ├── Features
│   │       ├── APIReference
│   │       ├── FAQ
│   │       └── Troubleshooting
│   └── UserMenu
│       ├── Profile
│       ├── Settings
│       └── Logout
└── PageContent (routes)
    ├── Home
    ├── Discover
    ├── Analytics
    ├── Docs
    │   └── DocViewer
    └── ...other pages
```

## Components and Interfaces

### 1. Header Component

**Location:** `client/src/components/layout/Header.tsx`

**Interface:**
```typescript
interface HeaderProps {
  className?: string;
}

interface NavigationItem {
  label: string;
  path?: string;
  external?: boolean;
  dropdown?: NavigationItem[];
  icon?: React.ComponentType;
}
```

**Implementation Details:**
- Fixed positioning with z-index management
- Responsive design with mobile hamburger menu
- Active route highlighting
- Dropdown menu support
- Authentication state awareness

### 2. Navigation Menu Component

**Location:** `client/src/components/layout/Navigation.tsx`

**Interface:**
```typescript
interface NavigationProps {
  items: NavigationItem[];
  activeRoute: string;
  isMobile: boolean;
  onNavigate?: (path: string) => void;
}
```

**Implementation Details:**
- Desktop horizontal menu
- Mobile drawer/hamburger menu
- Keyboard navigation support
- ARIA labels for accessibility

### 3. Dropdown Menu Component

**Location:** `client/src/components/layout/DropdownMenu.tsx`

**Interface:**
```typescript
interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: NavigationItem[];
  align?: 'left' | 'right';
  onItemClick?: (item: NavigationItem) => void;
}
```

**Implementation Details:**
- Hover and click activation
- Keyboard navigation (arrow keys, escape)
- Click outside to close
- Smooth animations
- Mobile-friendly touch interactions

### 4. Documentation Viewer Component

**Location:** `client/src/components/docs/DocViewer.tsx`

**Interface:**
```typescript
interface DocViewerProps {
  docPath: string;
  content: string;
  metadata: DocMetadata;
}

interface DocMetadata {
  title: string;
  category: string;
  lastUpdated: Date;
  author?: string;
}
```

**Implementation Details:**
- Markdown rendering with syntax highlighting
- Table of contents generation
- Code block copy functionality
- Image optimization
- Search integration

### 5. Documentation Sidebar Component

**Location:** `client/src/components/docs/DocSidebar.tsx`

**Interface:**
```typescript
interface DocSidebarProps {
  categories: DocCategory[];
  currentDoc: string;
  onDocSelect: (docPath: string) => void;
}

interface DocCategory {
  name: string;
  icon?: React.ComponentType;
  docs: DocItem[];
}

interface DocItem {
  title: string;
  path: string;
  description?: string;
}
```

**Implementation Details:**
- Collapsible categories
- Active document highlighting
- Search functionality
- Mobile responsive (drawer on small screens)

## Data Models

### Documentation Structure

**Location:** `docs/` directory

```
docs/
├── getting-started/
│   ├── index.md
│   ├── quick-start.md
│   └── installation.md
├── features/
│   ├── index.md
│   ├── repository-analysis.md
│   ├── similar-repositories.md
│   └── analytics-dashboard.md
├── api-reference/
│   ├── index.md
│   ├── authentication.md
│   ├── repositories.md
│   └── analytics.md
├── faq/
│   └── index.md
└── troubleshooting/
    └── index.md
```

### Documentation Metadata

```typescript
interface DocMetadata {
  title: string;
  description: string;
  category: string;
  order: number;
  lastUpdated: string;
  author?: string;
  tags?: string[];
}
```

**Frontmatter Format:**
```markdown
---
title: "Getting Started with RepoRadar"
description: "Learn how to analyze your first repository"
category: "getting-started"
order: 1
lastUpdated: "2025-01-10"
tags: ["beginner", "tutorial"]
---

# Content here...
```

## Error Handling

### Navigation Errors

**Error Scenarios:**
- Invalid route navigation
- External link failures
- Dropdown menu rendering errors
- Mobile menu state issues

**Error Handling Strategy:**
- Graceful fallback to home page for invalid routes
- Error boundaries around navigation components
- Console warnings for development
- User-friendly error messages

### Documentation Errors

**Error Scenarios:**
- Missing documentation files
- Markdown parsing errors
- Image loading failures
- Search index errors

**Error Handling Strategy:**
- Display "Documentation not found" page
- Fallback content for parsing errors
- Lazy loading with error boundaries
- Search fallback to basic filtering

## Testing Strategy

### Unit Tests

**Header Component Tests:**
- Renders with correct navigation items
- Highlights active route
- Handles authentication state
- Responsive behavior (desktop/mobile)

**Dropdown Menu Tests:**
- Opens and closes correctly
- Keyboard navigation works
- Click outside closes menu
- External links open in new tab

**Documentation Viewer Tests:**
- Renders markdown correctly
- Syntax highlighting works
- Code copy functionality
- Table of contents generation

### Integration Tests

**Navigation Flow Tests:**
- Navigate between pages
- Dropdown menu interactions
- Mobile menu toggle
- Active route updates

**Documentation Tests:**
- Load and display documentation
- Navigate between docs
- Search functionality
- Category filtering

### End-to-End Tests

**User Journey Tests:**
- Complete navigation flow
- Discover menu usage
- Documentation browsing
- Mobile navigation experience


## Implementation Details

### Phase 1: Header Component Refactoring

**Create Reusable Header Component:**
1. Create `client/src/components/layout/Header.tsx`
2. Implement fixed positioning with proper z-index
3. Add responsive design with breakpoints
4. Include logo and navigation items
5. Add user menu for authenticated users

**Navigation Configuration:**
```typescript
const navigationConfig: NavigationItem[] = [
  { label: 'Home', path: '/home' },
  {
    label: 'Discover',
    dropdown: [
      { label: 'Discover Repositories', path: '/discover' },
      { 
        label: 'Trending Repositories', 
        path: 'https://github.com/trending',
        external: true 
      },
    ],
  },
  { label: 'Analytics', path: '/analytics' },
  {
    label: 'Docs',
    dropdown: [
      { label: 'Getting Started', path: '/docs/getting-started' },
      { label: 'Features', path: '/docs/features' },
      { label: 'API Reference', path: '/docs/api-reference' },
      { label: 'FAQ', path: '/docs/faq' },
      { label: 'Troubleshooting', path: '/docs/troubleshooting' },
    ],
  },
];
```

### Phase 2: Dropdown Menu Implementation

**Create Dropdown Component:**
1. Use Radix UI DropdownMenu for accessibility
2. Implement hover and click triggers
3. Add keyboard navigation support
4. Style with Tailwind CSS
5. Add smooth animations with Framer Motion

**External Link Handling:**
```typescript
const handleNavigation = (item: NavigationItem) => {
  if (item.external) {
    window.open(item.path, '_blank', 'noopener,noreferrer');
  } else {
    navigate(item.path);
  }
};
```

### Phase 3: Mobile Navigation

**Hamburger Menu Implementation:**
1. Create mobile menu toggle button
2. Implement slide-in drawer with Framer Motion
3. Add backdrop overlay
4. Handle touch gestures
5. Ensure proper z-index layering

**Responsive Breakpoints:**
```typescript
const breakpoints = {
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
};
```

### Phase 4: Documentation System

**Documentation Structure Setup:**
1. Create `docs/` directory in project root
2. Organize documentation by category
3. Create index files for each category
4. Add markdown files with frontmatter

**Markdown Processing:**
1. Install markdown processing libraries:
   - `react-markdown` for rendering
   - `remark-gfm` for GitHub Flavored Markdown
   - `rehype-highlight` for syntax highlighting
2. Create markdown processor utility
3. Implement frontmatter parsing
4. Add code block copy functionality

**Documentation Routes:**
```typescript
// Add to routes
<Route path="/docs/:category/:doc?" element={<DocsPage />} />
```

### Phase 5: Documentation Viewer

**DocViewer Component:**
1. Create documentation viewer with sidebar
2. Implement markdown rendering
3. Add table of contents generation
4. Include breadcrumb navigation
5. Add "Edit on GitHub" link

**Search Implementation:**
1. Create search index from documentation
2. Implement client-side search with Fuse.js
3. Add search input in docs header
4. Display search results with highlighting

### Phase 6: Integration with Existing Pages

**Update All Pages:**
1. Import and add Header component to all pages
2. Remove duplicate navigation code
3. Ensure consistent layout
4. Test navigation flow
5. Verify mobile responsiveness

**Pages to Update:**
- Landing page
- Home page
- Discover page
- Analytics pages
- Repository detail pages
- User profile pages
- Settings pages

## Styling and Design

### Header Styling

```typescript
const headerStyles = {
  container: 'fixed top-0 left-0 right-0 z-50 bg-background border-b',
  inner: 'container mx-auto px-4 h-16 flex items-center justify-between',
  logo: 'text-xl font-bold',
  nav: 'hidden md:flex items-center space-x-6',
  mobileToggle: 'md:hidden',
};
```

### Dropdown Styling

```typescript
const dropdownStyles = {
  trigger: 'flex items-center space-x-1 hover:text-primary transition-colors',
  content: 'bg-background border rounded-md shadow-lg p-2 min-w-[200px]',
  item: 'px-3 py-2 rounded hover:bg-accent cursor-pointer transition-colors',
  separator: 'h-px bg-border my-1',
};
```

### Documentation Styling

```typescript
const docsStyles = {
  container: 'container mx-auto px-4 py-8',
  layout: 'grid grid-cols-1 md:grid-cols-[250px_1fr] gap-8',
  sidebar: 'space-y-4',
  content: 'prose prose-slate dark:prose-invert max-w-none',
  codeBlock: 'relative group',
  copyButton: 'absolute top-2 right-2 opacity-0 group-hover:opacity-100',
};
```

## Accessibility Implementation

### ARIA Labels

```typescript
<nav aria-label="Main navigation">
  <button aria-label="Open menu" aria-expanded={isOpen}>
    <MenuIcon />
  </button>
</nav>

<a 
  href={item.path} 
  aria-current={isActive ? 'page' : undefined}
>
  {item.label}
</a>
```

### Keyboard Navigation

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Escape':
      closeDropdown();
      break;
    case 'ArrowDown':
      focusNextItem();
      break;
    case 'ArrowUp':
      focusPreviousItem();
      break;
    case 'Enter':
    case ' ':
      activateItem();
      break;
  }
};
```

### Focus Management

```typescript
// Trap focus in mobile menu
const trapFocus = (element: HTMLElement) => {
  const focusableElements = element.querySelectorAll(
    'a, button, input, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  element.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });
};
```

## Performance Considerations

### Code Splitting

```typescript
// Lazy load documentation pages
const DocsPage = lazy(() => import('./pages/docs'));

// Lazy load markdown processor
const processMarkdown = lazy(() => import('./utils/markdown'));
```

### Caching Strategy

```typescript
// Cache documentation content
const docCache = new Map<string, string>();

const loadDoc = async (path: string) => {
  if (docCache.has(path)) {
    return docCache.get(path);
  }
  
  const content = await fetch(`/docs/${path}.md`).then(r => r.text());
  docCache.set(path, content);
  return content;
};
```

### Image Optimization

```typescript
// Optimize documentation images
<img 
  src={imagePath} 
  loading="lazy"
  alt={altText}
  width={width}
  height={height}
/>
```

## SEO Optimization

### Meta Tags

```typescript
// Add to documentation pages
<Helmet>
  <title>{doc.title} | RepoRadar Docs</title>
  <meta name="description" content={doc.description} />
  <meta property="og:title" content={doc.title} />
  <meta property="og:description" content={doc.description} />
  <meta property="og:type" content="article" />
  <link rel="canonical" href={`https://reporadar.com/docs/${doc.path}`} />
</Helmet>
```

### Structured Data

```typescript
// Add JSON-LD for documentation
const structuredData = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": doc.title,
  "description": doc.description,
  "datePublished": doc.createdAt,
  "dateModified": doc.lastUpdated,
  "author": {
    "@type": "Organization",
    "name": "RepoRadar"
  }
};
```

## Configuration

### Environment Variables

```bash
# Documentation
DOCS_BASE_PATH=/docs
DOCS_GITHUB_EDIT_URL=https://github.com/your-org/reporadar/edit/main/docs

# External Links
GITHUB_TRENDING_URL=https://github.com/trending
```

### Navigation Configuration File

**Location:** `client/src/config/navigation.ts`

```typescript
export const navigationConfig = {
  header: {
    logo: {
      text: 'RepoRadar',
      path: '/home',
    },
    items: [
      // ... navigation items
    ],
  },
  footer: {
    // Footer navigation if needed
  },
  mobile: {
    breakpoint: 768,
    animationDuration: 300,
  },
};
```

## Migration Plan

### Step 1: Create Header Component
1. Build reusable Header component
2. Test in isolation
3. Add to Storybook (if available)

### Step 2: Update Existing Pages
1. Add Header to one page at a time
2. Test navigation flow
3. Fix any layout issues
4. Verify mobile responsiveness

### Step 3: Implement Documentation
1. Create documentation structure
2. Write initial documentation content
3. Implement DocViewer component
4. Add documentation routes

### Step 4: Testing and Refinement
1. Test all navigation flows
2. Verify accessibility
3. Test on multiple devices
4. Gather user feedback

## Monitoring

### Analytics Tracking

```typescript
// Track navigation events
trackEvent('navigation_click', {
  from: currentRoute,
  to: targetRoute,
  type: 'header_nav',
});

// Track documentation views
trackEvent('docs_view', {
  category: doc.category,
  title: doc.title,
  path: doc.path,
});

// Track search usage
trackEvent('docs_search', {
  query: searchQuery,
  resultsCount: results.length,
});
```

### Error Tracking

```typescript
// Track navigation errors
if (navigationError) {
  logError('Navigation Error', {
    route: attemptedRoute,
    error: error.message,
    userAgent: navigator.userAgent,
  });
}
```
