
# Implementation Plan

- [x] 1. Fix Analytics Dashboard data display





- [x] 1.1 Fix getUserAnalyses database query


  - Update `server/storage.ts` getUserAnalyses() to properly filter by userId
  - Add proper error handling for database queries
  - Test query returns correct data for authenticated users
  - Add logging for debugging
  - _Requirements: 1.1, 1.2, 8.1, 8.5_

- [x] 1.2 Fix analytics endpoint userId extraction


  - Update `/api/analytics/dashboard` endpoint to consistently extract userId
  - Handle both session-based and token-based authentication
  - Add validation for userId presence
  - Return 401 if userId cannot be determined
  - _Requirements: 1.2, 1.8, 8.2_

- [x] 1.3 Implement empty state handling


  - Create getEmptyDashboardData() helper function
  - Return structured empty data when no analyses exist
  - Update frontend to display helpful empty state message
  - Add "Analyze your first repository" call-to-action
  - _Requirements: 1.7, 8.3_

- [x] 1.4 Fix date calculations and aggregations


  - Fix monthly growth calculation logic
  - Fix activity chart date range (last 30 days)
  - Fix language distribution aggregation
  - Handle edge cases (single data point, missing dates)
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 8.2, 8.3, 8.7_

- [x] 1.5 Write tests for analytics fixes





  - Test getUserAnalyses with valid userId
  - Test empty data handling
  - Test date range calculations
  - Test aggregation logic
  - _Requirements: 1.1, 1.2, 1.7, 8.1, 8.2_
- [x] 2. Fix Advanced Analytics authorization




- [ ] 2. Fix Advanced Analytics authorization


- [x] 2.1 Fix isAuthenticated middleware

  - Update `server/neonAuth.ts` isAuthenticated middleware
  - Properly check session for authenticated user
  - Add consistent userId extraction logic
  - Add detailed error logging
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 2.2 Fix session validation


  - Ensure session is properly validated on each request
  - Handle session expiration gracefully
  - Add session refresh logic if needed
  - Test with expired sessions
  - _Requirements: 2.2, 2.6_

- [x] 2.3 Update Advanced Analytics endpoint


  - Verify `/api/analytics/advanced` applies isAuthenticated middleware correctly
  - Add proper error responses for authentication failures
  - Include authentication headers in response
  - Test endpoint with authenticated and unauthenticated requests
  - _Requirements: 2.1, 2.3, 2.7_

- [x] 2.4 Fix frontend authentication handling


  - Verify credentials are included in fetch requests
  - Add redirect to login on 401 errors
  - Implement return URL for post-login redirect
  - Add loading states during authentication check
  - _Requirements: 2.4, 2.7_

- [ ]* 2.5 Write tests for authorization fixes
  - Test isAuthenticated middleware
  - Test session validation
  - Test Advanced Analytics endpoint access
  - Test redirect on authentication failure
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Implement repository reanalysis functionality




- [x] 3.1 Add reanalysis database fields


  - Add analysisCount, lastReanalyzedBy, reanalysisLockedUntil to repositories table
  - Create database migration
  - Update repository schema in shared/schema.ts
  - _Requirements: 3.6, 3.8_

- [x] 3.2 Create reanalysis endpoint


  - Create POST `/api/repositories/:id/reanalyze` endpoint
  - Apply isAuthenticated middleware
  - Implement rate limiting (1 per repository per hour)
  - Add error handling for missing repositories
  - _Requirements: 3.1, 3.2, 3.3, 3.7, 3.8_

- [x] 3.3 Implement cache clearing logic

  - Delete existing analysis from database
  - Clear Redis cache if present
  - Update repository lastAnalyzed timestamp
  - Set reanalysisLockedUntil timestamp
  - _Requirements: 3.2, 3.3, 3.6_

- [x] 3.4 Trigger new analysis

  - Fetch fresh repository data from GitHub
  - Run analysis with Gemini
  - Store new analysis in database
  - Return updated analysis to frontend
  - _Requirements: 3.3, 3.4, 3.5_

- [x] 3.5 Add reanalyze button to frontend


  - Add "Reanalyze" button to repository detail page
  - Implement loading state during reanalysis
  - Disable button during reanalysis
  - Show success/error messages
  - Invalidate and refetch repository data on success
  - _Requirements: 3.1, 3.4, 3.5, 3.7_

- [x] 3.6 Write tests for reanalysis






  - Test reanalysis endpoint
  - Test rate limiting
  - Test cache clearing
  - Test concurrent reanalysis prevention
  - _Requirements: 3.2, 3.3, 3.6, 3.8_


- [x] 4. Integrate Stripe payment processing


- [x] 4.1 Set up Stripe account and configuration


  - Create Stripe account (or use existing)
  - Get API keys (test and production)
  - Create Pro and Enterprise products in Stripe Dashboard
  - Create price objects for monthly subscriptions
  - Configure webhook endpoint URL
  - Add environment variables to .env
  - _Requirements: 4.1, 4.2, 9.1, 9.2_

- [x] 4.2 Enhance Stripe service


  - Update `server/stripe.ts` with createCheckoutSession()
  - Implement createCustomerPortalSession()
  - Add getSubscriptionStatus()
  - Add cancelSubscription()
  - Handle customer creation and retrieval
  - _Requirements: 4.2, 4.3, 5.4, 9.3_



- [x] 4.3 Implement checkout endpoint

  - Create POST `/api/subscription/checkout` endpoint
  - Create Stripe checkout session
  - Return checkout URL to frontend
  - Handle errors gracefully

  - _Requirements: 4.2, 4.3, 4.8_

- [x] 4.4 Implement webhook handler

  - Enhance POST `/api/stripe/webhook` endpoint
  - Verify webhook signatures
  - Handle subscription.created, updated, deleted events
  - Handle invoice.payment_succeeded, payment_failed events
  - Update user subscription status in database
  - Log all webhook events
  - _Requirements: 4.4, 4.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_


- [x]* 4.5 Write tests for Stripe integration





  - Test checkout session creation
  - Test webhook signature verification
  - Test subscription status updates
  - Test error handling
  - _Requirements: 4.1, 4.2, 4.4, 7.1, 7.2_

- [x] 5. Create subscription management UI




- [x] 5.1 Create subscription page


  - Create `client/src/pages/subscription.tsx`
  - Display current subscription status
  - Show plan details and billing cycle
  - Add loading and error states
  - _Requirements: 5.1, 5.2_

- [x] 5.2 Create plan comparison component

  - Create plan cards showing features and pricing
  - Highlight current plan
  - Add "Upgrade" buttons for higher tiers
  - Show "Current Plan" badge
  - _Requirements: 5.1, 5.3_

- [x] 5.3 Implement upgrade flow


  - Handle plan selection
  - Redirect to Stripe Checkout
  - Handle success and cancel redirects
  - Show confirmation message after successful upgrade
  - _Requirements: 4.2, 4.3, 5.3, 5.5_

- [x] 5.4 Implement cancellation flow


  - Add "Cancel Subscription" button
  - Show confirmation dialog
  - Call cancellation endpoint
  - Update UI to reflect cancelled status
  - Show when subscription will end
  - _Requirements: 5.4, 5.5_

- [x] 5.5 Add billing history


  - Fetch invoice history from Stripe
  - Display past payments
  - Show payment status and dates
  - Add download invoice links
  - _Requirements: 5.6_



- [ ] 5.6 Handle Stripe unavailable state
  - Check if Stripe is configured
  - Display message when payments unavailable
  - Hide upgrade buttons
  - Show contact information for enterprise
  - _Requirements: 5.7, 9.2_

- [ ]* 5.7 Write tests for subscription UI
  - Test subscription page rendering
  - Test plan selection
  - Test cancellation flow
  - Test Stripe unavailable state
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7_

- [x] 6. Implement subscription tier enforcement





- [x] 6.1 Create tier enforcement middleware

  - Create `server/middleware/subscriptionTier.ts`
  - Implement checkTierLimit() middleware
  - Define TIER_LIMITS configuration
  - Add API rate limit checking
  - Add analysis limit checking
  - _Requirements: 6.1, 6.2, 6.3, 6.4_


- [x] 6.2 Apply tier limits to API endpoints

  - Apply checkTierLimit to analysis endpoints
  - Apply to API endpoints requiring tier access
  - Return 429 with upgrade prompt when limit exceeded
  - Include tier information in error response
  - _Requirements: 6.2, 6.3, 6.4_


- [x] 6.3 Implement premium feature gates

  - Check subscription tier for advanced analytics access
  - Check tier for export functionality
  - Check tier for API access
  - Redirect free users to upgrade page
  - _Requirements: 6.5_


- [x] 6.4 Handle subscription changes

  - Immediately apply new limits on upgrade
  - Immediately enforce free limits on downgrade/cancellation
  - Handle subscription expiration
  - Update user tier in database on webhook events
  - _Requirements: 6.6, 6.7_

- [ ]* 6.5 Write tests for tier enforcement
  - Test tier limit checking
  - Test rate limit enforcement
  - Test premium feature gates
  - Test subscription change handling
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 7. Database schema updates




- [x] 7.1 Create subscription events table


  - Add subscriptionEvents table to shared/schema.ts
  - Create indexes for userId and eventType
  - Run database migration
  - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_


- [x] 7.2 Update users table for subscriptions

  - Verify subscription fields exist (stripeCustomerId, stripeSubscriptionId, subscriptionTier, subscriptionStatus, subscriptionEndDate)
  - Add any missing fields
  - Create indexes if needed
  - _Requirements: 4.5, 6.1, 6.7_


- [x] 7.3 Add storage methods for subscriptions

  - Add getSubscriptionEvent() to storage
  - Add createSubscriptionEvent() to storage
  - Add getUserByStripeCustomerId() to storage
  - Add updateUserSubscription() to storage
  - _Requirements: 4.5, 7.8_

- [x] 8. Configuration and documentation






- [x] 8.1 Update environment variables

  - Add Stripe configuration to .env.example
  - Document all required Stripe variables
  - Add APP_URL configuration
  - Update configuration validation
  - _Requirements: 4.1, 9.1, 9.2, 9.3_

- [x] 8.2 Create Stripe setup documentation


  - Document Stripe account setup process
  - Document product and price creation
  - Document webhook configuration
  - Add testing instructions with Stripe CLI
  - _Requirements: 4.1, 7.1_


- [x] 8.3 Update API documentation

  - Document reanalysis endpoint
  - Document subscription endpoints
  - Document tier limits and enforcement
  - Add error response examples
  - _Requirements: 3.1, 4.2, 6.4_
