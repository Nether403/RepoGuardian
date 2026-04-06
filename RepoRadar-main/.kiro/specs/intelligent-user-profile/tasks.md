# Implementation Plan

- [x] 1. Set up API endpoints for bookmarks





  - Create GET /api/bookmarks endpoint to retrieve user's bookmarks with repository details
  - Create POST /api/bookmarks endpoint to add a new bookmark with optional notes
  - Create DELETE /api/bookmarks/:repositoryId endpoint to remove a bookmark
  - Add tier enforcement middleware to all bookmark endpoints (Pro/Enterprise only)
  - Add authentication middleware to verify user identity
  - _Requirements: 1.2, 1.3, 1.7, 1.8_

- [x] 1.1 Write unit tests for bookmark API endpoints

  - Test bookmark creation with valid data
  - Test bookmark deletion
  - Test tier enforcement (403 for Free users)
  - Test authentication requirements
  - _Requirements: 1.2, 1.3, 1.7, 1.8_

- [x] 2. Set up API endpoints for tags





  - Create GET /api/tags endpoint to retrieve user's tags with repository counts
  - Create POST /api/tags endpoint to create a new tag with name and color validation
  - Create DELETE /api/tags/:tagId endpoint to remove a tag and cascade delete associations
  - Create POST /api/repositories/:id/tags endpoint to apply a tag to a repository
  - Create DELETE /api/repositories/:id/tags/:tagId endpoint to remove a tag from a repository
  - Add tier enforcement middleware to all tag endpoints (Pro/Enterprise only)
  - _Requirements: 2.2, 2.3, 2.4, 2.6, 2.9, 2.10, 2.13_

- [x] 2.1 Write unit tests for tag API endpoints


  - Test tag creation with validation
  - Test tag deletion with cascade
  - Test tag application to repositories
  - Test tier enforcement
  - _Requirements: 2.2, 2.3, 2.4, 2.6, 2.9, 2.10_

- [x] 3. Set up API endpoints for user preferences





  - Create GET /api/user/preferences endpoint to retrieve user preferences with defaults
  - Create PUT /api/user/preferences endpoint to update preferences with validation
  - Implement input validation for languages, topics, minStars, and notification settings
  - Add tier enforcement middleware (Pro/Enterprise only)
  - _Requirements: 3.2, 3.14, 3.16, 3.17_

- [x] 3.1 Write unit tests for preferences API endpoints


  - Test preferences retrieval with defaults
  - Test preferences update with validation
  - Test input validation for all fields
  - Test tier enforcement
  - _Requirements: 3.2, 3.14, 3.16, 3.17_

- [x] 4. Implement AI recommendation generation system






  - Create generateAIRecommendations function in server/gemini.ts
  - Implement user data gathering (preferences, activity, bookmarks)
  - Implement GitHub repository search based on user preferences
  - Implement AI scoring and ranking using Gemini 2.5 Pro
  - Filter out already analyzed and bookmarked repositories
  - Return top 10 recommendations with match scores and reasoning
  - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_

- [x] 5. Set up API endpoint for recommendations





  - Create GET /api/recommendations endpoint
  - Implement 24-hour caching for recommendation results
  - Add cache invalidation on new analyses or preference updates
  - Handle insufficient activity data with appropriate messaging
  - Add tier enforcement middleware (Pro/Enterprise only)
  - Implement rate limiting for expensive AI operations
  - _Requirements: 4.2, 4.16, 4.18, 4.19_

- [x] 5.1 Write unit tests for recommendations system


  - Test recommendation generation with mock data
  - Test caching behavior
  - Test cache invalidation
  - Test tier enforcement
  - Test rate limiting
  - _Requirements: 4.2, 4.18, 4.19_

- [x] 6. Create BookmarkButton component





  - Implement BookmarkButton component with filled/unfilled states
  - Add click handler to toggle bookmark state
  - Implement optimistic UI updates
  - Add loading state during API calls
  - Handle errors with user-friendly messages
  - Support size variants (sm, md, lg)
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 7. Create TagSelector component





  - Implement TagSelector dropdown component
  - Display available tags with colors
  - Show selected tags as badges
  - Add tag selection/deselection functionality
  - Implement inline tag creation
  - Add mobile-optimized dropdown view
  - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 6.4_

- [x] 8. Create BookmarksTab component










  - Implement BookmarksTab with repository card list
  - Display repository name, owner, description, and bookmark date
  - Add remove bookmark button to each card
  - Implement empty state with helpful guidance
  - Add pagination for 100+ bookmarks
  - Implement loading skeletons
  - Add error handling with retry option
  - Make responsive for mobile (single column layout)
  - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.10, 6.2, 7.1_

- [x] 9. Create TagsTab component
  - Implement TagsTab with tag list display
  - Show tag name, color, and repository count
  - Add create tag form with name input and color picker
  - Implement tag name validation
  - Add delete tag button with confirmation
  - Display tags in responsive grid
  - Make responsive for mobile
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.14, 6.3_

- [x] 10. Create PreferencesTab component




  - Implement PreferencesTab with form layout
  - Add multi-select dropdown for 50+ programming languages
  - Add multi-select input for preferred topics (free-form text)
  - Add multi-select input for excluded topics (free-form text)
  - Add number input for minimum stars (0-1000000)
  - Add toggle switches for AI recommendations and email notifications
  - Add save button with validation
  - Display success confirmation on save
  - Show sensible defaults for new users
  - Make responsive for mobile (vertical stack)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.17, 6.5_


- [x] 11. Create RecommendationsTab component




  - Implement RecommendationsTab as default profile view
  - Display up to 10 personalized recommendations
  - Show repository name, owner, description, and stars for each recommendation
  - Display match score (0-100) with visual indicator
  - Show reasoning text explaining why recommended
  - Add "Analyze" button to navigate to repository analysis
  - Add "Dismiss" button to remove recommendation from list
  - Implement loading skeletons during generation
  - Add error handling with retry option
  - Display empty state for users with insufficient activity
  - Make responsive for mobile (single column layout)
  - _Requirements: 4.1, 4.2, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 6.6_
- [x] 12. Integrate BookmarkButton into repository cards
  - Add BookmarkButton to RepositoryCard component
  - Fetch bookmark status for each repository
  - Implement toggle bookmark mutation
  - Update UI optimistically on bookmark toggle
  - Handle tier restrictions (hide for Free users)
  - _Requirements: 1.1, 1.2, 1.3, 1.8_

- [x] 13. Integrate TagSelector into repository cards





  - Add TagSelector to RepositoryCard component
  - Fetch user's tags and repository's current tags
  - Implement add/remove tag mutations
  - Update UI optimistically on tag changes
  - Handle tier restrictions (hide for Free users)
  - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 2.13_


- [x] 14. Update Profile page with intelligent profile tabs




  - Add "Bookmarks", "Tags", "AI Preferences", and "AI Recommendations" tabs to profile page
  - Set AI Recommendations as default tab for Pro/Enterprise users
  - Implement horizontal scrollable tab layout for mobile
  - Add tab navigation with proper routing
  - Render appropriate tab component based on selection
  - _Requirements: 1.4, 2.1, 3.1, 4.1, 6.1_

- [x] 15. Implement tier-based access control UI
  - Add "Intelligent Profile" tab with lock icon for Free users
  - Create upgrade prompt component listing all intelligent profile features
  - Display feature cards for Bookmarks, Tags, Preferences, and Recommendations
  - Add prominent "Upgrade to Pro" button linking to subscription page
  - Show upgrade prompts when Free users attempt to access restricted features
  - Remove locks and show full access for Pro/Enterprise users
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.10_

- [x] 16. Implement React Query caching strategy




  - Configure QueryClient with appropriate cache times
  - Set 2-minute stale time for bookmarks
  - Set 10-minute stale time for tags
  - Set 24-hour stale time for recommendations
  - Implement cache invalidation on mutations
  - Add optimistic updates for all mutations
  - Configure retry logic with exponential backoff
  - _Requirements: 7.10, 4.18_

- [x] 17. Implement error handling and loading states




  - Add loading skeletons for all list views
  - Implement error boundaries for component failures
  - Add retry buttons for failed API requests
  - Display user-friendly error messages
  - Handle tier restriction errors with upgrade prompts
  - Handle validation errors with field-specific messages
  - Implement automatic retry with exponential backoff
  - _Requirements: 7.8, 8.4, 8.5, 8.10_

- [x] 18. Implement mobile responsiveness





  - Ensure all tabs use horizontal scrollable layout on mobile
  - Make repository cards single column on mobile
  - Make tag grid responsive
  - Optimize dropdowns for mobile touch
  - Stack preference form fields vertically on mobile
  - Make recommendation cards single column on mobile
  - Ensure touch targets are minimum 44x44px
  - Test smooth 60fps scrolling performance
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 19. Add performance optimizations



  - Implement pagination for bookmarks (20 per page)
  - Implement virtual scrolling for tag selectors with 50+ tags
  - Optimize API response times (bookmarks <500ms, tags <300ms, preferences <200ms)
  - Ensure recommendation generation completes in <3 seconds
  - Add database indexes for common queries
  - Implement infinite scroll or pagination for all lists
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.9_

- [x] 20. Write integration tests for complete flows






  - Test complete bookmark flow (add, view, remove)
  - Test complete tag flow (create, apply, filter, delete)
  - Test preferences update flow
  - Test recommendation generation and dismissal flow
  - Test tier enforcement across all features
  - _Requirements: All requirements_

- [x] 21. Write E2E tests for user interactions






  - Test profile page navigation for Pro users
  - Test upgrade prompt display for Free users
  - Test bookmark button interactions
  - Test tag selector interactions
  - Test preferences form submission
  - Test recommendation card interactions
  - Test mobile responsiveness
  - _Requirements: All requirements_

- [x] 22. Add monitoring and analytics





  - Add event tracking for bookmark_added, bookmark_removed
  - Add event tracking for tag_created, tag_deleted, tag_applied
  - Add event tracking for preferences_updated
  - Add event tracking for recommendations_generated, recommendation_dismissed
  - Monitor API response times
  - Monitor recommendation generation performance
  - Track feature usage by tier
  - _Requirements: 7.3, 7.4, 7.5, 7.6_
