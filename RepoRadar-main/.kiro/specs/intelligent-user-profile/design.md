# Intelligent User Profile - Design Document

## Overview

This design document outlines the technical architecture and implementation approach for the Intelligent User Profile feature. The feature leverages existing database schema and storage methods, focusing on completing API endpoints and building intuitive frontend interfaces for Pro and Enterprise users.

## Architecture

### System Components

### System Architecture Flow

Frontend (React) → API Layer (Express) → Storage Layer (Drizzle ORM) → Database (PostgreSQL)

The frontend components make HTTP requests to REST API endpoints, which use the storage layer methods to interact with the database. All database tables and storage methods already exist; we're adding API endpoints and UI components.


### Technology Stack

**Frontend:**
- React 18 with TypeScript
- TanStack Query for data fetching and caching
- Tailwind CSS for styling
- shadcn/ui components
- Framer Motion for animations

**Backend:**
- Express.js with TypeScript
- Drizzle ORM for database operations
- Existing authentication middleware
- Existing tier enforcement middleware

**AI/ML:**
- Google Gemini 2.5 Pro for recommendation generation
- Existing GitHub API integration

## Components and Interfaces

### Frontend Components

#### 1. BookmarkButton Component
```typescript
// client/src/components/BookmarkButton.tsx
interface BookmarkButtonProps {
  repositoryId: string;
  isBookmarked: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function BookmarkButton({ repositoryId, isBookmarked, onToggle, size = 'md' }: BookmarkButtonProps) {
  // Renders bookmark icon button
  // Shows filled icon when bookmarked
  // Handles click to toggle bookmark state
  // Shows loading state during API call
}

2. TagSelector Component
// client/src/components/TagSelector.tsx
interface TagSelectorProps {
  repositoryId: string;
  selectedTags: Tag[];
  availableTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
}

export function TagSelector({ repositoryId, selectedTags, availableTags, onTagsChange }: TagSelectorProps) {
  // Renders dropdown with tag list
  // Shows selected tags as badges
  // Allows adding/removing tags
  // Supports creating new tags inline
}

3. BookmarksTab Component
// client/src/components/profile/BookmarksTab.tsx
export function BookmarksTab() {
  const { data: bookmarks, isLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => apiRequest('/api/bookmarks')
  });

  // Displays list of bookmarked repositories
  // Shows repository cards with metadata
  // Includes remove bookmark button
  // Handles empty state
  // Implements pagination for 100+ bookmarks
}
4. TagsTab Component
// client/src/components/profile/TagsTab.tsx
export function TagsTab() {
  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiRequest('/api/tags')
  });

  // Displays list of user's tags
  // Shows tag name and color
  // Includes create tag form
  // Includes delete tag button
  // Shows repository count per tag
}
5. PreferencesTab Component
// client/src/components/profile/PreferencesTab.tsx
export function PreferencesTab() {
  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => apiRequest('/api/user/preferences')
  });

  // Multi-select for preferred languages
  // Multi-select for preferred topics
  // Multi-select for excluded topics
  // Number input for minimum stars
  // Toggles for notifications
  // Save button with validation
}
6. RecommendationsTab Component
// client/src/components/profile/RecommendationsTab.tsx
export function RecommendationsTab() {
  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => apiRequest('/api/recommendations'),
    staleTime: 24 * 60 * 60 * 1000 // 24 hours
  });

  // Displays personalized recommendations
  // Shows match score and reasoning
  // Includes analyze button
  // Includes dismiss button
  // Handles loading and error states
  // Shows empty state for new users
}
API Endpoints
Bookmarks API
// GET /api/bookmarks
// Returns: Bookmark[]
interface Bookmark {
  id: string;
  userId: string;
  repositoryId: string;
  notes?: string;
  createdAt: Date;
  repository: Repository;
}

// POST /api/bookmarks
// Body: { repositoryId: string, notes?: string }
// Returns: Bookmark

// DELETE /api/bookmarks/:repositoryId
// Returns: { success: boolean }
Tags API
// GET /api/tags
// Returns: Tag[]
interface Tag {
  id: number;
  userId: string;
  name: string;
  color: string;
  repositoryCount?: number;
}

// POST /api/tags
// Body: { name: string, color?: string }
// Returns: Tag

// DELETE /api/tags/:tagId
// Returns: { success: boolean }

// POST /api/repositories/:id/tags
// Body: { tagId: number }
// Returns: RepositoryTag

// DELETE /api/repositories/:id/tags/:tagId
// Returns: { success: boolean }
Recommendations API
// GET /api/recommendations
// Returns: Recommendation[]
interface Recommendation {
  repository: Repository;
  matchScore: number; // 0-100
  reasoning: string;
  basedOn: {
    languages: string[];
    topics: string[];
    similarTo: string[]; // repository names
  };
}
Data Models
Existing Database Schema
All tables already exist in shared/schema.ts:

// Bookmarks
bookmarks {
  id: serial (primary key)
  userId: varchar (foreign key to users)
  repositoryId: varchar (foreign key to repositories)
  notes: text
  createdAt: timestamp
}

// Tags
tags {
  id: serial (primary key)
  userId: varchar (foreign key to users)
  name: varchar(50)
  color: varchar(7) // hex color
  createdAt: timestamp
}

// Repository Tags (junction table)
repository_tags {
  id: serial (primary key)
  repositoryId: varchar (foreign key to repositories)
  tagId: integer (foreign key to tags)
  userId: varchar (foreign key to users)
  createdAt: timestamp
}

// User Preferences
user_preferences {
  id: serial (primary key)
  userId: varchar (foreign key to users, unique)
  preferredLanguages: text[] // array of language names
  preferredTopics: text[] // array of topic keywords
  excludedTopics: text[] // array of topics to exclude
  minStars: integer // minimum star count
  maxAge: varchar(20) // e.g., "30d", "1y", "any"
  aiRecommendations: boolean // enable/disable
  emailNotifications: boolean // enable/disable
  updatedAt: timestamp
}

// User Activities (for tracking)
user_activities {
  id: serial (primary key)
  userId: varchar (foreign key to users)
  action: varchar(50) // 'viewed', 'analyzed', 'bookmarked', 'shared'
  repositoryId: varchar (foreign key to repositories)
  metadata: jsonb // additional context
  createdAt: timestamp
}
AI Recommendation Algorithm
Recommendation Generation Process
// server/gemini.ts - Add new function
export async function generateAIRecommendations(userId: string): Promise<Recommendation[]> {
  // 1. Gather user data
  const preferences = await storage.getUserPreferences(userId);
  const recentActivity = await storage.getUserRecentActivity(userId, 100);
  const bookmarks = await storage.getUserBookmarks(userId);
  
  // 2. Extract patterns
  const analyzedRepos = recentActivity
    .filter(a => a.action === 'analyzed')
    .map(a => a.repositoryId);
  
  const languages = preferences.preferredLanguages || [];
  const topics = preferences.preferredTopics || [];
  const excludedTopics = preferences.excludedTopics || [];
  const minStars = preferences.minStars || 0;
  
  // 3. Search GitHub for similar repositories
  const searchQueries = [
    ...languages.map(lang => `language:${lang}`),
    ...topics.map(topic => `topic:${topic}`)
  ].join(' OR ');
  
  const candidates = await githubService.searchRepositories(searchQueries, {
    minStars,
    excludeTopics: excludedTopics,
    limit: 50
  });
  
  // 4. Filter out already analyzed/bookmarked repos
  const filtered = candidates.filter(repo => 
    !analyzedRepos.includes(repo.id) &&
    !bookmarks.some(b => b.repositoryId === repo.id)
  );
  
  // 5. Use AI to score and rank
  const prompt = `
    Given a user with these preferences:
    - Preferred languages: ${languages.join(', ')}
    - Preferred topics: ${topics.join(', ')}
    - Recently analyzed: ${analyzedRepos.slice(0, 5).join(', ')}
    
    Rank these repositories by relevance and provide match scores (0-100) and reasoning:
    ${filtered.map(r => `- ${r.fullName}: ${r.description}`).join('\n')}
    
    Return JSON array: [{ repositoryId, matchScore, reasoning }]
  `;
  
  const aiResponse = await geminiModel.generateContent(prompt);
  const scores = JSON.parse(aiResponse.response.text());
  
  // 6. Combine and return top 10
  return scores
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10)
    .map(score => ({
      repository: filtered.find(r => r.id === score.repositoryId),
      matchScore: score.matchScore,
      reasoning: score.reasoning,
      basedOn: {
        languages,
        topics,
        similarTo: analyzedRepos.slice(0, 3)
      }
    }));
}
Error Handling
API Error Responses
// Tier restriction error
{
  error: 'FEATURE_NOT_AVAILABLE',
  message: 'This feature requires a Pro subscription',
  currentTier: 'free',
  requiredTier: 'pro',
  upgradeUrl: '/subscription'
}

// Validation error
{
  error: 'VALIDATION_ERROR',
  message: 'Tag name is required',
  field: 'name'
}

// Not found error
{
  error: 'NOT_FOUND',
  message: 'Bookmark not found',
  resourceType: 'bookmark',
  resourceId: '123'
}

// Server error
{
  error: 'INTERNAL_ERROR',
  message: 'Failed to generate recommendations',
  retryable: true
}
Frontend Error Handling
// Use React Query error handling
const { data, error, isError } = useQuery({
  queryKey: ['bookmarks'],
  queryFn: fetchBookmarks,
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
});

if (isError) {
  if (error.status === 403) {
    return <UpgradePrompt feature="bookmarks" />;
  }
  return <ErrorMessage error={error} onRetry={refetch} />;
}
Testing Strategy
Unit Tests
// Test storage methods (already exist)
describe('BookmarkStorage', () => {
  it('should add bookmark', async () => {
    const bookmark = await storage.addBookmark(userId, repoId);
    expect(bookmark).toBeDefined();
    expect(bookmark.userId).toBe(userId);
  });
  
  it('should remove bookmark', async () => {
    await storage.removeBookmark(userId, repoId);
    const bookmarks = await storage.getUserBookmarks(userId);
    expect(bookmarks).not.toContainEqual(expect.objectContaining({ repositoryId: repoId }));
  });
});

// Test API endpoints
describe('Bookmarks API', () => {
  it('should return 403 for free users', async () => {
    const response = await request(app)
      .get('/api/bookmarks')
      .set('Authorization', `Bearer ${freeUserToken}`);
    expect(response.status).toBe(403);
  });
  
  it('should return bookmarks for pro users', async () => {
    const response = await request(app)
      .get('/api/bookmarks')
      .set('Authorization', `Bearer ${proUserToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
Integration Tests
// Test full bookmark flow
describe('Bookmark Flow', () => {
  it('should bookmark and unbookmark repository', async () => {
    // Add bookmark
    const addResponse = await request(app)
      .post('/api/bookmarks')
      .send({ repositoryId: 'test-repo' })
      .set('Authorization', `Bearer ${proUserToken}`);
    expect(addResponse.status).toBe(200);
    
    // Verify bookmark exists
    const getResponse = await request(app)
      .get('/api/bookmarks')
      .set('Authorization', `Bearer ${proUserToken}`);
    expect(getResponse.body).toContainEqual(
      expect.objectContaining({ repositoryId: 'test-repo' })
    );
    
    // Remove bookmark
    const deleteResponse = await request(app)
      .delete('/api/bookmarks/test-repo')
      .set('Authorization', `Bearer ${proUserToken}`);
    expect(deleteResponse.status).toBe(200);
    
    // Verify bookmark removed
    const finalResponse = await request(app)
      .get('/api/bookmarks')
      .set('Authorization', `Bearer ${proUserToken}`);
    expect(finalResponse.body).not.toContainEqual(
      expect.objectContaining({ repositoryId: 'test-repo' })
    );
  });
});
E2E Tests
// Test UI interactions
describe('Profile Page', () => {
  it('should display bookmarks tab for pro users', async () => {
    await page.goto('/profile');
    await page.waitForSelector('[data-testid="bookmarks-tab"]');
    await page.click('[data-testid="bookmarks-tab"]');
    expect(await page.textContent('h2')).toContain('Bookmarks');
  });
  
  it('should show upgrade prompt for free users', async () => {
    await page.goto('/profile');
    await page.click('[data-testid="intelligent-profile-tab"]');
    expect(await page.textContent('.upgrade-prompt')).toContain('Upgrade to Pro');
  });
});
Performance Considerations
Caching Strategy
// React Query cache configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 3
    }
  }
});

// Specific cache times
useQuery({
  queryKey: ['bookmarks'],
  staleTime: 2 * 60 * 1000 // 2 minutes (frequently updated)
});

useQuery({
  queryKey: ['tags'],
  staleTime: 10 * 60 * 1000 // 10 minutes (rarely updated)
});

useQuery({
  queryKey: ['recommendations'],
  staleTime: 24 * 60 * 60 * 1000 // 24 hours (expensive to generate)
});
Database Optimization
// Add indexes for common queries
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_repo ON bookmarks(repository_id);
CREATE INDEX idx_tags_user ON tags(user_id);
CREATE INDEX idx_repository_tags_repo ON repository_tags(repository_id);
CREATE INDEX idx_repository_tags_tag ON repository_tags(tag_id);
CREATE INDEX idx_user_activities_user ON user_activities(user_id);
CREATE INDEX idx_user_activities_action ON user_activities(action);
Pagination
// Implement cursor-based pagination for large lists
interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

// API endpoint
app.get('/api/bookmarks', async (req, res) => {
  const { cursor, limit = 20 } = req.query;
  const bookmarks = await storage.getUserBookmarksPaginated(
    req.user.id,
    cursor,
    limit
  );
  res.json(bookmarks);
});
Security Considerations
Authorization
// All endpoints require authentication
app.get('/api/bookmarks', isAuthenticated, async (req, res) => {
  // User can only access their own bookmarks
  const bookmarks = await storage.getUserBookmarks(req.user.id);
  res.json(bookmarks);
});

// Tier enforcement
app.get('/api/bookmarks', 
  isAuthenticated,
  checkFeatureAccess('bookmarks'),
  async (req, res) => {
    // Only Pro/Enterprise users can access
  }
);
Input Validation
// Validate all user inputs
const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-F]{6}$/i)
});

app.post('/api/tags', isAuthenticated, async (req, res) => {
  const validation = createTagSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: validation.error.errors
    });
  }
  // Proceed with validated data
});
Rate Limiting
// Apply rate limits to prevent abuse
app.get('/api/recommendations',
  isAuthenticated,
  checkFeatureAccess('recommendations'),
  apiRateLimit, // 1000 requests/hour for Pro
  async (req, res) => {
    // Generate recommendations (expensive operation)
  }
);
Deployment Considerations
Environment Variables
No new environment variables required. Uses existing:

DATABASE_URL - PostgreSQL connection
GEMINI_API_KEY - For AI recommendations
GITHUB_TOKEN - For repository search
Database Migrations
No migrations needed - all tables already exist.

Monitoring
// Add metrics for new features
trackEvent('bookmark_added', { userId, repositoryId });
trackEvent('tag_created', { userId, tagName });
trackEvent('recommendations_generated', { userId, count });
trackEvent('preferences_updated', { userId, changes });
Future Enhancements
Phase 2 Features (Not in Current Scope)
Bookmark Collections

Group bookmarks into folders
Share bookmark collections
Tag Hierarchies

Parent/child tag relationships
Tag templates
Advanced Recommendations

Trending repositories in user's stack
Collaborative filtering
Weekly digest emails
Social Features

Follow other users
See what others are bookmarking
Public tag clouds
Conclusion
This design leverages existing infrastructure to deliver a complete intelligent profile experience with minimal new code. The focus is on:

API Completion - Adding missing endpoints for bookmarks and tags
UI Development - Building intuitive interfaces for all features
AI Integration - Implementing smart recommendations
Performance - Ensuring fast, responsive user experience
Security - Proper tier enforcement and data protection
All components are designed to be modular, testable, and maintainable, following existing patterns in the RepoRadar codebase.