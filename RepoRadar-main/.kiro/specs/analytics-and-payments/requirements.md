# Requirements Document

## Introduction

This specification addresses critical fixes for the analytics system and the integration of Stripe payment processing for RepoRadar. Currently, the Analytics Dashboard shows no data, the Advanced Analytics page returns unauthorized errors, and there's no payment system for subscription management. Additionally, there's a need for repository reanalysis functionality that clears cached versions. These enhancements will provide users with working analytics insights and enable monetization through subscription tiers.

## Requirements

### Requirement 1: Fix Analytics Dashboard Data Display

**User Story:** As a user, I want to see my repository analysis statistics on the Analytics Dashboard, so that I can track my usage and insights over time.

#### Acceptance Criteria

1. WHEN a user navigates to /analytics THEN the system SHALL display repository analysis statistics
2. WHEN the dashboard loads THEN the system SHALL fetch the user's analysis history from the database
3. WHEN analysis data exists THEN the system SHALL display total analyses, monthly growth, average scores, and top language
4. WHEN analysis data exists THEN the system SHALL show activity charts for the last 30 days
5. WHEN analysis data exists THEN the system SHALL display language distribution charts
6. WHEN analysis data exists THEN the system SHALL show score averages across all metrics
7. IF no analysis data exists THEN the system SHALL display an empty state with guidance to analyze repositories
8. WHEN data fails to load THEN the system SHALL display a user-friendly error message with retry option

### Requirement 2: Fix Advanced Analytics Authorization

**User Story:** As an authenticated user, I want to access the Advanced Analytics page without authorization errors, so that I can view detailed analytics insights.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to /advanced-analytics THEN the system SHALL allow access without authorization errors
2. WHEN the advanced analytics page loads THEN the system SHALL verify user authentication properly
3. WHEN authentication is valid THEN the system SHALL fetch advanced analytics data
4. IF authentication fails THEN the system SHALL redirect to login page with return URL
5. WHEN the isAuthenticated middleware is applied THEN the system SHALL correctly identify authenticated users
6. WHEN session validation occurs THEN the system SHALL handle session expiration gracefully
7. WHEN advanced analytics data is fetched THEN the system SHALL include proper authentication headers

### Requirement 3: Repository Reanalysis Functionality

**User Story:** As a user, I want to reanalyze repositories to get fresh insights, so that I can see updated analysis based on current repository state.

#### Acceptance Criteria

1. WHEN a user views a repository detail page THEN the system SHALL display a "Reanalyze" button
2. WHEN a user clicks "Reanalyze" THEN the system SHALL clear the cached analysis for that repository
3. WHEN cached analysis is cleared THEN the system SHALL trigger a new analysis request
4. WHEN reanalysis starts THEN the system SHALL show a loading indicator
5. WHEN reanalysis completes THEN the system SHALL display the updated analysis results
6. WHEN reanalysis is triggered THEN the system SHALL update the lastAnalyzed timestamp
7. IF reanalysis fails THEN the system SHALL display an error message and retain the previous analysis
8. WHEN reanalysis is in progress THEN the system SHALL disable the reanalyze button to prevent duplicate requests

### Requirement 4: Stripe Payment Integration

**User Story:** As a user, I want to subscribe to paid plans using Stripe, so that I can access premium features and higher usage limits.

#### Acceptance Criteria

1. WHEN Stripe is configured THEN the system SHALL initialize Stripe with API keys
2. WHEN a user selects a subscription plan THEN the system SHALL create a Stripe checkout session
3. WHEN checkout is initiated THEN the system SHALL redirect to Stripe's hosted checkout page
4. WHEN payment succeeds THEN the system SHALL receive a webhook notification from Stripe
5. WHEN webhook is received THEN the system SHALL update the user's subscription status in the database
6. WHEN subscription is active THEN the system SHALL grant access to premium features
7. WHEN subscription expires THEN the system SHALL downgrade user to free tier
8. WHEN payment fails THEN the system SHALL notify the user and provide retry options

### Requirement 5: Subscription Management UI

**User Story:** As a user, I want to view and manage my subscription, so that I can upgrade, downgrade, or cancel my plan as needed.

#### Acceptance Criteria

1. WHEN a user navigates to subscription settings THEN the system SHALL display current subscription status
2. WHEN subscription is active THEN the system SHALL show plan details, billing cycle, and next payment date
3. WHEN a user wants to upgrade THEN the system SHALL display available higher-tier plans
4. WHEN a user wants to cancel THEN the system SHALL provide a cancellation flow with confirmation
5. WHEN subscription changes THEN the system SHALL update the database and notify the user
6. WHEN viewing subscription history THEN the system SHALL display past invoices and payments
7. IF Stripe is not configured THEN the system SHALL display a message that payments are unavailable

### Requirement 6: Subscription Tier Enforcement

**User Story:** As a platform administrator, I want subscription tiers to be enforced, so that users receive appropriate access based on their subscription level.

#### Acceptance Criteria

1. WHEN a user makes an API request THEN the system SHALL check their subscription tier
2. WHEN rate limits are applied THEN the system SHALL use tier-specific limits (free: 100/hour, pro: 1000/hour, enterprise: unlimited)
3. WHEN analysis limits are checked THEN the system SHALL enforce daily limits based on tier (free: 10/day, pro: 100/day, enterprise: unlimited)
4. WHEN a user exceeds their tier limits THEN the system SHALL return a 429 status with upgrade prompt
5. WHEN premium features are accessed THEN the system SHALL verify the user has an active paid subscription
6. IF subscription expires THEN the system SHALL immediately enforce free tier limits
7. WHEN subscription is upgraded THEN the system SHALL immediately apply new tier limits

### Requirement 7: Stripe Webhook Handling

**User Story:** As a system administrator, I want Stripe webhooks to be handled reliably, so that subscription status stays synchronized with payment events.

#### Acceptance Criteria

1. WHEN a Stripe webhook is received THEN the system SHALL verify the webhook signature
2. WHEN signature verification fails THEN the system SHALL reject the webhook with 400 status
3. WHEN subscription.created event occurs THEN the system SHALL create subscription record in database
4. WHEN subscription.updated event occurs THEN the system SHALL update subscription status
5. WHEN subscription.deleted event occurs THEN the system SHALL mark subscription as cancelled
6. WHEN invoice.payment_succeeded event occurs THEN the system SHALL log successful payment
7. WHEN invoice.payment_failed event occurs THEN the system SHALL notify user and update status
8. WHEN webhook processing fails THEN the system SHALL log the error for manual review

### Requirement 8: Analytics Data Integrity

**User Story:** As a user, I want my analytics data to be accurate and consistent, so that I can trust the insights provided by the dashboard.

#### Acceptance Criteria

1. WHEN an analysis is created THEN the system SHALL store all required metrics in the database
2. WHEN analytics are calculated THEN the system SHALL use accurate date ranges and filters
3. WHEN aggregations are performed THEN the system SHALL handle edge cases (no data, single data point)
4. WHEN data is displayed THEN the system SHALL format numbers and dates consistently
5. IF database queries fail THEN the system SHALL handle errors gracefully without crashing
6. WHEN multiple analyses exist for one repository THEN the system SHALL use the most recent analysis
7. WHEN calculating trends THEN the system SHALL handle missing data points appropriately

### Requirement 9: Payment Security

**User Story:** As a user, I want my payment information to be secure, so that I can trust the platform with my financial data.

#### Acceptance Criteria

1. WHEN payment processing occurs THEN the system SHALL never store credit card information
2. WHEN Stripe is used THEN the system SHALL use Stripe's hosted checkout for PCI compliance
3. WHEN API keys are stored THEN the system SHALL use environment variables, never hardcoded values
4. WHEN webhook endpoints are exposed THEN the system SHALL verify webhook signatures
5. WHEN subscription data is accessed THEN the system SHALL require authentication
6. WHEN payment errors occur THEN the system SHALL not expose sensitive information in error messages
7. WHEN logs are written THEN the system SHALL never log payment card details or API keys
