import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  real,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from 'drizzle-orm';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reset_tokens_token").on(table.token),
  index("idx_reset_tokens_user").on(table.userId),
  index("idx_reset_tokens_expires").on(table.expiresAt),
]);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// Rate limits table (fallback when Redis is not available)
export const rateLimits = pgTable("rate_limits", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_rate_limits_key").on(table.key),
  index("idx_rate_limits_reset").on(table.resetAt),
]);

export type RateLimit = typeof rateLimits.$inferSelect;
export type InsertRateLimit = typeof rateLimits.$inferInsert;

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  bio: text("bio"), // User biography
  
  // Authentication fields
  passwordHash: varchar("password_hash", { length: 255 }),
  emailVerified: boolean("email_verified").default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  
  // OAuth fields
  googleId: varchar("google_id", { length: 255 }),
  githubId: varchar("github_id", { length: 255 }),
  oauthProviders: jsonb("oauth_providers").default([]).$type<string[]>(),
  
  // Security fields
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: varchar("last_login_ip", { length: 45 }),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  accountLockedUntil: timestamp("account_locked_until"),
  
  subscriptionTier: varchar("subscription_tier").default("free"), // free, pro, enterprise
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status").default("inactive"), // active, inactive, cancelled, past_due
  subscriptionEndDate: timestamp("subscription_end_date"),
  analysisCount: integer("analysis_count").default(0), // Daily analysis count for rate limiting
  lastAnalysisReset: timestamp("last_analysis_reset").defaultNow(),
  apiKey: varchar("api_key"), // For API access
  githubToken: varchar("github_token", { length: 255 }), // GitHub Personal Access Token for code review
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Repositories table
export const repositories = pgTable("repositories", {
  id: varchar("id").primaryKey(), // GitHub repo ID
  name: varchar("name").notNull(),
  fullName: varchar("full_name").notNull().unique(),
  owner: varchar("owner").notNull(),
  description: text("description"),
  language: varchar("language"),
  stars: integer("stars").default(0),
  forks: integer("forks").default(0),
  watchers: integer("watchers").default(0),
  size: integer("size").default(0),
  isPrivate: boolean("is_private").default(false),
  htmlUrl: varchar("html_url").notNull(),
  cloneUrl: varchar("clone_url").notNull(),
  languages: jsonb("languages"), // Object with language percentages
  topics: text("topics").array(), // Array of topic strings
  lastAnalyzed: timestamp("last_analyzed"),
  analysisCount: integer("analysis_count").default(0),
  lastReanalyzedBy: varchar("last_reanalyzed_by").references(() => users.id),
  reanalysisLockedUntil: timestamp("reanalysis_locked_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Repository analyses table
export const repositoryAnalyses = pgTable("repository_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  repositoryId: varchar("repository_id").notNull().references(() => repositories.id),
  userId: varchar("user_id").references(() => users.id),
  originality: real("originality").notNull(),
  completeness: real("completeness").notNull(),
  marketability: real("marketability").notNull(),
  monetization: real("monetization").notNull(),
  usefulness: real("usefulness").notNull(),
  overallScore: real("overall_score").notNull(),
  summary: text("summary").notNull(),
  strengths: jsonb("strengths"),
  weaknesses: jsonb("weaknesses"),
  recommendations: jsonb("recommendations"),
  scoreExplanations: jsonb("score_explanations"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved repositories (user bookmarks)
export const savedRepositories = pgTable("saved_repositories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  repositoryId: varchar("repository_id").notNull().references(() => repositories.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Similar repositories
export const similarRepositories = pgTable("similar_repositories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  repositoryId: varchar("repository_id").notNull().references(() => repositories.id),
  similarRepositoryId: varchar("similar_repository_id").notNull().references(() => repositories.id),
  similarity: real("similarity").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Subscription events (for webhook tracking)
export const subscriptionEvents = pgTable("subscription_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventType: varchar("event_type").notNull(), // subscription_created, subscription_updated, subscription_deleted, payment_succeeded, payment_failed
  stripeEventId: varchar("stripe_event_id").unique(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_subscription_events_user").on(table.userId),
  index("idx_subscription_events_type").on(table.eventType),
  index("idx_subscription_events_stripe").on(table.stripeEventId),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  savedRepositories: many(savedRepositories),
  analyses: many(repositoryAnalyses),
}));

export const repositoriesRelations = relations(repositories, ({ many }) => ({
  analyses: many(repositoryAnalyses),
  savedBy: many(savedRepositories),
  similarRepositories: many(similarRepositories, { relationName: "repository_similar" }),
  similarTo: many(similarRepositories, { relationName: "similar_repository" }),
}));

export const repositoryAnalysesRelations = relations(repositoryAnalyses, ({ one }) => ({
  repository: one(repositories, {
    fields: [repositoryAnalyses.repositoryId],
    references: [repositories.id],
  }),
  user: one(users, {
    fields: [repositoryAnalyses.userId],
    references: [users.id],
  }),
}));

export const savedRepositoriesRelations = relations(savedRepositories, ({ one }) => ({
  user: one(users, {
    fields: [savedRepositories.userId],
    references: [users.id],
  }),
  repository: one(repositories, {
    fields: [savedRepositories.repositoryId],
    references: [repositories.id],
  }),
}));

export const similarRepositoriesRelations = relations(similarRepositories, ({ one }) => ({
  repository: one(repositories, {
    fields: [similarRepositories.repositoryId],
    references: [repositories.id],
    relationName: "repository_similar",
  }),
  similarRepository: one(repositories, {
    fields: [similarRepositories.similarRepositoryId],
    references: [repositories.id],
    relationName: "similar_repository",
  }),
}));

// Insert schemas
export const insertRepositorySchema = createInsertSchema(repositories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastAnalyzed: true,
});

export const insertAnalysisSchema = createInsertSchema(repositoryAnalyses).omit({
  id: true,
  createdAt: true,
});

export const insertSavedRepositorySchema = createInsertSchema(savedRepositories).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Bookmarks table for saving repositories
export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryId: varchar("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bookmarks_user").on(table.userId),
  index("idx_bookmarks_repository").on(table.repositoryId),
]);

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = typeof bookmarks.$inferInsert;

// Tags table for organizing repositories
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }).default("#FF6B35"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_tags_user").on(table.userId),
  index("idx_tags_name").on(table.name),
]);

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

// Repository tags junction table
export const repositoryTags = pgTable("repository_tags", {
  id: serial("id").primaryKey(),
  repositoryId: varchar("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_repository_tags_repo").on(table.repositoryId),
  index("idx_repository_tags_tag").on(table.tagId),
  index("idx_repository_tags_user").on(table.userId),
]);

export type RepositoryTag = typeof repositoryTags.$inferSelect;
export type InsertRepositoryTag = typeof repositoryTags.$inferInsert;

// Collections for organizing repositories
export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  icon: varchar("icon", { length: 50 }).default("folder"),
  color: varchar("color", { length: 7 }).default("#FF6B35"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_collections_user").on(table.userId),
  index("idx_collections_public").on(table.isPublic),
]);

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof collections.$inferInsert;

// Collection items junction table
export const collectionItems = pgTable("collection_items", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  repositoryId: varchar("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  position: integer("position").default(0),
  notes: text("notes"),
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => [
  index("idx_collection_items_collection").on(table.collectionId),
  index("idx_collection_items_repository").on(table.repositoryId),
]);

export type CollectionItem = typeof collectionItems.$inferSelect;
export type InsertCollectionItem = typeof collectionItems.$inferInsert;

// User preferences for AI recommendations
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  preferredLanguages: text("preferred_languages").array().default([]),
  preferredTopics: text("preferred_topics").array().default([]),
  excludedTopics: text("excluded_topics").array().default([]),
  minStars: integer("min_stars").default(0),
  maxAge: varchar("max_age", { length: 20 }).default("any"),
  aiRecommendations: boolean("ai_recommendations").default(true),
  emailNotifications: boolean("email_notifications").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_preferences_user").on(table.userId),
]);

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// User activity tracking for recommendations
export const userActivities = pgTable("user_activities", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(), // viewed, analyzed, bookmarked, shared
  repositoryId: varchar("repository_id").references(() => repositories.id, { onDelete: "cascade" }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_activities_user").on(table.userId),
  index("idx_user_activities_action").on(table.action),
  index("idx_user_activities_repository").on(table.repositoryId),
]);

export type UserActivity = typeof userActivities.$inferSelect;
export type InsertUserActivity = typeof userActivities.$inferInsert;

// Tracked repositories for real-time monitoring
export const trackedRepositories = pgTable("tracked_repositories", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryId: varchar("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  trackingType: varchar("tracking_type", { length: 50 }).notNull().default("all"), // all, stars, releases, commits, issues
  lastChecked: timestamp("last_checked").defaultNow(),
  lastStars: integer("last_stars").default(0),
  lastForks: integer("last_forks").default(0),
  lastCommitHash: varchar("last_commit_hash"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_tracked_repositories_user").on(table.userId),
  index("idx_tracked_repositories_repo").on(table.repositoryId),
  index("idx_tracked_repositories_active").on(table.isActive),
]);

export type TrackedRepository = typeof trackedRepositories.$inferSelect;
export type InsertTrackedRepository = typeof trackedRepositories.$inferInsert;

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // repo_update, star_milestone, new_release, recommendation
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  repositoryId: varchar("repository_id").references(() => repositories.id, { onDelete: "cascade" }),
  metadata: jsonb("metadata"), // Additional data like old/new values
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notifications_user").on(table.userId),
  index("idx_notifications_read").on(table.isRead),
  index("idx_notifications_type").on(table.type),
  index("idx_notifications_created").on(table.createdAt),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Comments table for repository discussions
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryId: varchar("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  parentId: integer("parent_id"), // For threaded comments
  likes: integer("likes").default(0),
  isEdited: boolean("is_edited").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_comments_user").on(table.userId),
  index("idx_comments_repository").on(table.repositoryId),
  index("idx_comments_parent").on(table.parentId),
  index("idx_comments_created").on(table.createdAt),
]);

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

// Comment likes junction table
export const commentLikes = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_comment_likes_comment").on(table.commentId),
  index("idx_comment_likes_user").on(table.userId),
]);

export type CommentLike = typeof commentLikes.$inferSelect;
export type InsertCommentLike = typeof commentLikes.$inferInsert;

// Ratings table for repository ratings
export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  repositoryId: varchar("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-5 stars
  review: text("review"),
  helpfulCount: integer("helpful_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ratings_user").on(table.userId),
  index("idx_ratings_repository").on(table.repositoryId),
  index("idx_ratings_rating").on(table.rating),
  index("idx_ratings_created").on(table.createdAt),
]);

export type Rating = typeof ratings.$inferSelect;
export type InsertRating = typeof ratings.$inferInsert;

// Rating helpfulness junction table
export const ratingHelpful = pgTable("rating_helpful", {
  id: serial("id").primaryKey(),
  ratingId: integer("rating_id").notNull().references(() => ratings.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_rating_helpful_rating").on(table.ratingId),
  index("idx_rating_helpful_user").on(table.userId),
]);

export type RatingHelpful = typeof ratingHelpful.$inferSelect;
export type InsertRatingHelpful = typeof ratingHelpful.$inferInsert;

// Teams table for collaboration
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_teams_owner").on(table.ownerId),
  index("idx_teams_created").on(table.createdAt),
]);

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

// Team members junction table
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull().default('member'), // owner, admin, member, viewer
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  index("idx_team_members_team").on(table.teamId),
  index("idx_team_members_user").on(table.userId),
  index("idx_team_members_role").on(table.role),
]);

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

// Team invitations table
export const teamInvitations = pgTable("team_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default('member'),
  invitedBy: varchar("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_team_invitations_team").on(table.teamId),
  index("idx_team_invitations_email").on(table.email),
  index("idx_team_invitations_token").on(table.token),
]);

export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type InsertTeamInvitation = typeof teamInvitations.$inferInsert;

// Shared analyses table for team collaboration
export const sharedAnalyses = pgTable("shared_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: varchar("analysis_id").notNull().references(() => repositoryAnalyses.id, { onDelete: "cascade" }),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  sharedBy: varchar("shared_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  permissions: varchar("permissions", { length: 50 }).notNull().default('view'), // view, comment, edit
  sharedAt: timestamp("shared_at").defaultNow(),
}, (table) => [
  index("idx_shared_analyses_analysis").on(table.analysisId),
  index("idx_shared_analyses_team").on(table.teamId),
  index("idx_shared_analyses_shared_by").on(table.sharedBy),
]);

export type SharedAnalysis = typeof sharedAnalyses.$inferSelect;
export type InsertSharedAnalysis = typeof sharedAnalyses.$inferInsert;

// API Keys for developer access
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  permissions: jsonb("permissions").default(['read']).$type<string[]>(), // ['read', 'write', 'delete']
  rateLimit: integer("rate_limit").default(1000), // requests per hour
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_api_keys_user").on(table.userId),
  index("idx_api_keys_key").on(table.key),
]);

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// API Usage tracking
export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  statusCode: integer("status_code"),
  responseTime: integer("response_time"), // in milliseconds
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_api_usage_key").on(table.apiKeyId),
  index("idx_api_usage_timestamp").on(table.timestamp),
]);

export type ApiUsage = typeof apiUsage.$inferSelect;
export type InsertApiUsage = typeof apiUsage.$inferInsert;

// Webhook configurations
export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: varchar("url", { length: 500 }).notNull(),
  events: jsonb("events").default(['repository.analyzed']).$type<string[]>(), // Event types to trigger
  secret: varchar("secret", { length: 64 }).notNull(), // For signature verification
  active: boolean("active").default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_webhooks_user").on(table.userId),
  index("idx_webhooks_active").on(table.active),
]);

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = typeof webhooks.$inferInsert;

// Analytics events table for tracking user behavior
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventName: varchar("event_name", { length: 255 }).notNull(),
  eventCategory: varchar("event_category", { length: 100 }).notNull(),
  properties: jsonb("properties"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_analytics_events_name").on(table.eventName),
  index("idx_analytics_events_timestamp").on(table.timestamp),
  index("idx_analytics_events_session").on(table.sessionId),
  index("idx_analytics_events_category").on(table.eventCategory),
  index("idx_analytics_events_user").on(table.userId),
]);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

// Add relations for new tables
export const trackedRepositoriesRelations = relations(trackedRepositories, ({ one }) => ({
  user: one(users, {
    fields: [trackedRepositories.userId],
    references: [users.id],
  }),
  repository: one(repositories, {
    fields: [trackedRepositories.repositoryId],
    references: [repositories.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  repository: one(repositories, {
    fields: [notifications.repositoryId],
    references: [repositories.id],
  }),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  user: one(users, {
    fields: [analyticsEvents.userId],
    references: [users.id],
  }),
}));

// Advanced Analytics aggregation tables
export const dailyAnalytics = pgTable("daily_analytics", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  totalAnalyses: integer("total_analyses").default(0),
  totalRepositories: integer("total_repositories").default(0),
  activeUsers: integer("active_users").default(0),
  avgScore: real("avg_score"),
  avgOriginality: real("avg_originality"),
  avgCompleteness: real("avg_completeness"),
  avgMarketability: real("avg_marketability"),
  avgMonetization: real("avg_monetization"),
  avgUsefulness: real("avg_usefulness"),
  apiCalls: integer("api_calls").default(0),
  avgResponseTime: integer("avg_response_time"), // in milliseconds
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_daily_analytics_date").on(table.date),
]);

export type DailyAnalytics = typeof dailyAnalytics.$inferSelect;
export type InsertDailyAnalytics = typeof dailyAnalytics.$inferInsert;

export const languageAnalytics = pgTable("language_analytics", {
  id: serial("id").primaryKey(),
  language: varchar("language", { length: 100 }).notNull(),
  count: integer("count").default(0),
  avgScore: real("avg_score"),
  totalStars: integer("total_stars").default(0),
  period: varchar("period", { length: 20 }).notNull(), // 7d, 30d, 90d, all
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  index("idx_language_analytics_language").on(table.language),
  index("idx_language_analytics_period").on(table.period),
]);

export type LanguageAnalytics = typeof languageAnalytics.$inferSelect;
export type InsertLanguageAnalytics = typeof languageAnalytics.$inferInsert;

// Code reviews table for storing code review results
export const codeReviews = pgTable("code_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // 'repository' or 'snippet'
  content: text("content").notNull(), // Repository URL or code snippet
  repositoryName: varchar("repository_name"),
  repositoryUrl: varchar("repository_url"),
  overallScore: integer("overall_score").notNull(),
  codeQuality: integer("code_quality").notNull(),
  security: integer("security").notNull(),
  performance: integer("performance").notNull(),
  maintainability: integer("maintainability").notNull(),
  testCoverage: integer("test_coverage").notNull(),
  issues: jsonb("issues").notNull().$type<any[]>(),
  suggestions: jsonb("suggestions").notNull().$type<string[]>(),
  positives: jsonb("positives").notNull().$type<string[]>(),
  metrics: jsonb("metrics").notNull().$type<{
    linesOfCode: number;
    complexity: number;
    duplications: number;
    technicalDebt: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_code_reviews_user").on(table.userId),
  index("idx_code_reviews_type").on(table.type),
  index("idx_code_reviews_created").on(table.createdAt),
]);

export type CodeReview = typeof codeReviews.$inferSelect;
export type InsertCodeReview = typeof codeReviews.$inferInsert;

export const codeReviewsRelations = relations(codeReviews, ({ one }) => ({
  user: one(users, {
    fields: [codeReviews.userId],
    references: [users.id],
  }),
}));

export type Repository = typeof repositories.$inferSelect;
export type InsertRepository = z.infer<typeof insertRepositorySchema>;
export type RepositoryAnalysis = typeof repositoryAnalyses.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type SavedRepository = typeof savedRepositories.$inferSelect;
export type InsertSavedRepository = z.infer<typeof insertSavedRepositorySchema>;
export type SimilarRepository = typeof similarRepositories.$inferSelect;
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type InsertSubscriptionEvent = typeof subscriptionEvents.$inferInsert;
