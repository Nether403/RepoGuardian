import {
  users,
  repositories,
  repositoryAnalyses,
  savedRepositories,
  similarRepositories,
  subscriptionEvents,
  bookmarks,
  tags,
  repositoryTags,
  collections,
  collectionItems,
  userPreferences,
  userActivities,
  trackedRepositories,
  notifications,
  comments,
  commentLikes,
  ratings,
  ratingHelpful,
  teams,
  teamMembers,
  teamInvitations,
  sharedAnalyses,
  apiKeys,
  apiUsage,
  webhooks,
  codeReviews,
  type User,
  type UpsertUser,
  type Repository,
  type InsertRepository,
  type RepositoryAnalysis,
  type InsertAnalysis,
  type SavedRepository,
  type InsertSavedRepository,
  type SimilarRepository,
  type Bookmark,
  type InsertBookmark,
  type Tag,
  type InsertTag,
  type RepositoryTag,
  type InsertRepositoryTag,
  type Collection,
  type InsertCollection,
  type CollectionItem,
  type InsertCollectionItem,
  type UserPreference,
  type InsertUserPreference,
  type UserActivity,
  type InsertUserActivity,
  type TrackedRepository,
  type InsertTrackedRepository,
  type Notification,
  type InsertNotification,
  type Comment,
  type InsertComment,
  type CommentLike,
  type InsertCommentLike,
  type Rating,
  type InsertRating,
  type RatingHelpful,
  type InsertRatingHelpful,
  type Team,
  type InsertTeam,
  type TeamMember,
  type InsertTeamMember,
  type TeamInvitation,
  type InsertTeamInvitation,
  type SharedAnalysis,
  type InsertSharedAnalysis,
  type ApiKey,
  type InsertApiKey,
  type ApiUsage,
  type InsertApiUsage,
  type Webhook,
  type InsertWebhook,
  type CodeReview,
  type InsertCodeReview,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User>;
  updateUserPassword(userId: string, passwordHash: string): Promise<User>;
  updateUserProfile(userId: string, profile: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    profileImageUrl?: string;
    githubToken?: string;
  }): Promise<User>;
  updateUserSubscription(userId: string, subscription: {
    stripeSubscriptionId?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
    subscriptionEndDate?: Date | null;
  }): Promise<User>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  resetUserAnalysisCount(userId: string): Promise<User>;
  incrementUserAnalysisCount(userId: string): Promise<User>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByGithubId(githubId: string): Promise<User | undefined>;
  linkOAuthProvider(userId: string, provider: 'google' | 'github', providerId: string): Promise<User>;
  updateUserLastLogin(userId: string, ip: string): Promise<User>;
  invalidateUserSessions(userId: string): Promise<User>;
  
  // Subscription events
  createSubscriptionEvent(event: {
    userId: string;
    eventType: string;
    stripeEventId: string;
    data: any;
  }): Promise<void>;
  getSubscriptionEvent(stripeEventId: string): Promise<any | undefined>;

  // Repository operations
  getRepository(id: string): Promise<Repository | undefined>;
  getRepositoryByFullName(fullName: string): Promise<Repository | undefined>;
  upsertRepository(repo: InsertRepository & { id: string }): Promise<Repository>;
  searchRepositories(query: string, limit?: number): Promise<Repository[]>;
  getRecentRepositories(limit?: number): Promise<Repository[]>;
  getRecentRepositoriesPaginated(limit: number, offset: number): Promise<Repository[]>;
  getRepositoryCount(): Promise<number>;

  // Analysis operations
  getAnalysis(repositoryId: string, userId?: string): Promise<RepositoryAnalysis | undefined>;
  createAnalysis(analysis: InsertAnalysis): Promise<RepositoryAnalysis>;
  deleteRepositoryAnalysis(repositoryId: string): Promise<void>;
  getRecentAnalyses(userId?: string, limit?: number): Promise<(RepositoryAnalysis & { repository: Repository })[]>;
  getRecentAnalysesPaginated(userId?: string, limit?: number, offset?: number): Promise<(RepositoryAnalysis & { repository: Repository })[]>;
  getAnalysisCount(userId?: string): Promise<number>;
  updateRepositoryReanalysis(repositoryId: string, data: { lastReanalyzedBy: string; reanalysisLockedUntil: Date; analysisCount: number }): Promise<void>;

  // Saved repositories operations
  saveRepository(userId: string, repositoryId: string): Promise<SavedRepository>;
  unsaveRepository(userId: string, repositoryId: string): Promise<void>;
  getSavedRepositories(userId: string): Promise<(SavedRepository & { repository: Repository })[]>;
  getSavedRepositoriesPaginated(userId: string, limit: number, offset: number): Promise<(SavedRepository & { repository: Repository })[]>;
  getSavedRepositoriesCount(userId: string): Promise<number>;
  isRepositorySaved(userId: string, repositoryId: string): Promise<boolean>;

  // Similar repositories operations
  getSimilarRepositories(repositoryId: string, limit?: number): Promise<(SimilarRepository & { similarRepository: Repository })[]>;
  createSimilarRepositories(repositoryId: string, similarRepos: { repositoryId: string; similarity: number }[]): Promise<void>;
  
  // Trending repositories
  getTrendingRepositories(): Promise<Repository[]>;
  
  // User Profile & Preferences operations
  getUserPreferences(userId: string): Promise<UserPreference | undefined>;
  updateUserPreferences(userId: string, preferences: Partial<InsertUserPreference>): Promise<UserPreference>;
  
  // Bookmarks operations
  getUserBookmarks(userId: string): Promise<Bookmark[]>;
  getUserBookmarksPaginated(userId: string, limit: number, offset: number): Promise<Bookmark[]>;
  getUserBookmarksCount(userId: string): Promise<number>;
  addBookmark(userId: string, repositoryId: string, notes?: string): Promise<Bookmark>;
  removeBookmark(userId: string, repositoryId: string): Promise<void>;
  
  // Tags operations
  getUserTags(userId: string): Promise<Tag[]>;
  getUserTagsPaginated(userId: string, limit: number, offset: number): Promise<Tag[]>;
  getUserTagsCount(userId: string): Promise<number>;
  createTag(userId: string, name: string, color?: string): Promise<Tag>;
  deleteTag(userId: string, tagId: number): Promise<void>;
  tagRepository(repositoryId: string, tagId: number, userId: string): Promise<RepositoryTag>;
  untagRepository(repositoryId: string, tagId: number, userId: string): Promise<void>;
  getRepositoryTags(repositoryId: string, userId: string): Promise<Tag[]>;
  
  // Collections operations
  getUserCollections(userId: string): Promise<Collection[]>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  addToCollection(collectionId: number, repositoryId: string, notes?: string): Promise<CollectionItem>;
  
  // Activity tracking
  trackActivity(userId: string, action: string, repositoryId?: string, metadata?: Record<string, unknown>): Promise<UserActivity>;
  getUserRecentActivity(userId: string, limit?: number): Promise<UserActivity[]>;
  
  // Repository tracking operations
  trackRepository(userId: string, repositoryId: string, trackingType: string): Promise<TrackedRepository>;
  untrackRepository(userId: string, repositoryId: string): Promise<void>;
  getTrackedRepositories(userId: string): Promise<(TrackedRepository & { repository: Repository })[]>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string, unreadOnly?: boolean): Promise<(Notification & { repository?: Repository })[]>;
  markNotificationAsRead(notificationId: number, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(notificationId: number, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        stripeCustomerId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserSubscription(userId: string, subscription: {
    stripeSubscriptionId?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
    subscriptionEndDate?: Date | null;
  }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        ...subscription,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
  
  async updateUserProfile(userId: string, profile: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    profileImageUrl?: string;
    githubToken?: string;
  }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        ...profile,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  async resetUserAnalysisCount(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        analysisCount: 0,
        lastAnalysisReset: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async incrementUserAnalysisCount(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        analysisCount: sql`${users.analysisCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByGithubId(githubId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.githubId, githubId));
    return user;
  }

  async linkOAuthProvider(userId: string, provider: 'google' | 'github', providerId: string): Promise<User> {
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    // Set the provider-specific ID field
    if (provider === 'google') {
      updateData.googleId = providerId;
    } else if (provider === 'github') {
      updateData.githubId = providerId;
    }
    
    // Update the oauthProviders array
    updateData.oauthProviders = sql`
      CASE 
        WHEN ${users.oauthProviders} IS NULL THEN ARRAY[${provider}]::text[]
        WHEN NOT (${provider} = ANY(${users.oauthProviders})) THEN array_append(${users.oauthProviders}, ${provider})
        ELSE ${users.oauthProviders}
      END
    `;
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    return user;
  }

  async updateUserLastLogin(userId: string, ip: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        failedLoginAttempts: 0, // Reset failed attempts on successful login
        accountLockedUntil: null, // Clear any account lock
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    return user;
  }

  async incrementFailedLoginAttempts(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        failedLoginAttempts: sql`COALESCE(${users.failedLoginAttempts}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    return user;
  }

  async lockAccount(userId: string, lockDurationMinutes: number = 15): Promise<User> {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + lockDurationMinutes);
    
    const [user] = await db
      .update(users)
      .set({
        accountLockedUntil: lockUntil,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    return user;
  }

  async unlockAccount(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        accountLockedUntil: null,
        failedLoginAttempts: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    return user;
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    const [user] = await db
      .select({ accountLockedUntil: users.accountLockedUntil })
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user || !user.accountLockedUntil) {
      return false;
    }
    
    // Check if lock has expired
    const now = new Date();
    if (user.accountLockedUntil <= now) {
      // Lock has expired, unlock the account
      await this.unlockAccount(userId);
      return false;
    }
    
    return true;
  }

  async invalidateUserSessions(userId: string): Promise<User> {
    // Mark user as requiring re-authentication by updating a timestamp
    // This can be checked against session creation time
    const [user] = await db
      .update(users)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    return user;
  }

  // Subscription event operations
  async createSubscriptionEvent(event: {
    userId: string;
    eventType: string;
    stripeEventId: string;
    data: any;
  }): Promise<void> {
    await db.insert(subscriptionEvents).values({
      userId: event.userId,
      eventType: event.eventType,
      stripeEventId: event.stripeEventId,
      data: event.data,
    });
  }

  async getSubscriptionEvent(stripeEventId: string): Promise<any | undefined> {
    const [event] = await db
      .select()
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.stripeEventId, stripeEventId));
    return event;
  }

  // Repository operations
  async getRepository(id: string): Promise<Repository | undefined> {
    const [repository] = await db.select().from(repositories).where(eq(repositories.id, id));
    return repository;
  }

  async getRepositoryByFullName(fullName: string): Promise<Repository | undefined> {
    const [repository] = await db.select().from(repositories).where(eq(repositories.fullName, fullName));
    return repository;
  }

  async upsertRepository(repo: InsertRepository & { id: string }): Promise<Repository> {
    const [repository] = await db
      .insert(repositories)
      .values(repo)
      .onConflictDoUpdate({
        target: repositories.fullName,
        set: {
          ...repo,
          updatedAt: new Date(),
        },
      })
      .returning();
    return repository;
  }

  async searchRepositories(query: string, limit = 10): Promise<Repository[]> {
    return await db
      .select()
      .from(repositories)
      .where(sql`${repositories.name} ILIKE ${`%${query}%`} OR ${repositories.description} ILIKE ${`%${query}%`}`)
      .orderBy(desc(repositories.stars))
      .limit(limit);
  }

  async getRecentRepositories(limit = 10): Promise<Repository[]> {
    return await db
      .select()
      .from(repositories)
      .orderBy(desc(repositories.createdAt))
      .limit(limit);
  }

  async getRecentRepositoriesPaginated(limit: number, offset: number): Promise<Repository[]> {
    return await db
      .select()
      .from(repositories)
      .orderBy(desc(repositories.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getRepositoryCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(repositories);
    return result.count;
  }

  // Analysis operations
  async getAnalysis(repositoryId: string, userId?: string): Promise<RepositoryAnalysis | undefined> {
    const conditions = [eq(repositoryAnalyses.repositoryId, repositoryId)];
    
    if (userId) {
      conditions.push(eq(repositoryAnalyses.userId, userId));
    }

    const results = await db
      .select()
      .from(repositoryAnalyses)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(desc(repositoryAnalyses.createdAt));
    
    return results[0];
  }

  async createAnalysis(analysis: InsertAnalysis): Promise<RepositoryAnalysis> {
    const [newAnalysis] = await db
      .insert(repositoryAnalyses)
      .values(analysis)
      .returning();
    return newAnalysis;
  }

  async deleteRepositoryAnalysis(repositoryId: string): Promise<void> {
    await db
      .delete(repositoryAnalyses)
      .where(eq(repositoryAnalyses.repositoryId, repositoryId));
  }

  async updateRepositoryReanalysis(repositoryId: string, data: { lastReanalyzedBy: string; reanalysisLockedUntil: Date; analysisCount: number }): Promise<void> {
    await db
      .update(repositories)
      .set({
        lastReanalyzedBy: data.lastReanalyzedBy,
        reanalysisLockedUntil: data.reanalysisLockedUntil,
        analysisCount: data.analysisCount,
      })
      .where(eq(repositories.id, repositoryId));
  }

  async getRecentAnalyses(userId?: string, limit = 10): Promise<(RepositoryAnalysis & { repository: Repository })[]> {
    const query = db
      .select({
        id: repositoryAnalyses.id,
        repositoryId: repositoryAnalyses.repositoryId,
        userId: repositoryAnalyses.userId,
        originality: repositoryAnalyses.originality,
        completeness: repositoryAnalyses.completeness,
        marketability: repositoryAnalyses.marketability,
        monetization: repositoryAnalyses.monetization,
        usefulness: repositoryAnalyses.usefulness,
        overallScore: repositoryAnalyses.overallScore,
        summary: repositoryAnalyses.summary,
        strengths: repositoryAnalyses.strengths,
        weaknesses: repositoryAnalyses.weaknesses,
        recommendations: repositoryAnalyses.recommendations,
        scoreExplanations: repositoryAnalyses.scoreExplanations,
        createdAt: repositoryAnalyses.createdAt,
        repository: repositories,
      })
      .from(repositoryAnalyses)
      .innerJoin(repositories, eq(repositoryAnalyses.repositoryId, repositories.id));

    if (userId) {
      query.where(eq(repositoryAnalyses.userId, userId));
    }

    return await query
      .orderBy(desc(repositoryAnalyses.createdAt))
      .limit(limit);
  }

  async getRecentAnalysesPaginated(userId?: string, limit = 10, offset = 0): Promise<(RepositoryAnalysis & { repository: Repository })[]> {
    const query = db
      .select({
        id: repositoryAnalyses.id,
        repositoryId: repositoryAnalyses.repositoryId,
        userId: repositoryAnalyses.userId,
        originality: repositoryAnalyses.originality,
        completeness: repositoryAnalyses.completeness,
        marketability: repositoryAnalyses.marketability,
        monetization: repositoryAnalyses.monetization,
        usefulness: repositoryAnalyses.usefulness,
        overallScore: repositoryAnalyses.overallScore,
        summary: repositoryAnalyses.summary,
        strengths: repositoryAnalyses.strengths,
        weaknesses: repositoryAnalyses.weaknesses,
        recommendations: repositoryAnalyses.recommendations,
        scoreExplanations: repositoryAnalyses.scoreExplanations,
        createdAt: repositoryAnalyses.createdAt,
        repository: repositories,
      })
      .from(repositoryAnalyses)
      .innerJoin(repositories, eq(repositoryAnalyses.repositoryId, repositories.id));

    if (userId) {
      query.where(eq(repositoryAnalyses.userId, userId));
    }

    return await query
      .orderBy(desc(repositoryAnalyses.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAnalysisCount(userId?: string): Promise<number> {
    const query = db
      .select({ count: sql<number>`count(*)` })
      .from(repositoryAnalyses);

    if (userId) {
      query.where(eq(repositoryAnalyses.userId, userId));
    }

    const [result] = await query;
    return result.count;
  }

  async getUserAnalyses(userId: string): Promise<Array<any>> {
    try {
      console.log(`[Storage] Fetching analyses for userId: ${userId}`);
      
      const results = await db
        .select({
          id: repositoryAnalyses.id,
          repositoryId: repositoryAnalyses.repositoryId,
          repositoryName: repositories.name,
          repositoryOwner: repositories.owner,
          primaryLanguage: repositories.language,
          userId: repositoryAnalyses.userId,
          originality: repositoryAnalyses.originality,
          completeness: repositoryAnalyses.completeness,
          marketability: repositoryAnalyses.marketability,
          monetization: repositoryAnalyses.monetization,
          usefulness: repositoryAnalyses.usefulness,
          overallScore: repositoryAnalyses.overallScore,
          createdAt: repositoryAnalyses.createdAt,
          repository: repositories,
        })
        .from(repositoryAnalyses)
        .innerJoin(repositories, eq(repositoryAnalyses.repositoryId, repositories.id))
        .where(eq(repositoryAnalyses.userId, userId))
        .orderBy(desc(repositoryAnalyses.createdAt));
      
      console.log(`[Storage] Found ${results.length} analyses for userId: ${userId}`);
      return results;
    } catch (error) {
      console.error(`[Storage] Error fetching analyses for userId ${userId}:`, error);
      throw new Error(`Failed to fetch user analyses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Saved repositories operations
  async saveRepository(userId: string, repositoryId: string): Promise<SavedRepository> {
    const [saved] = await db
      .insert(savedRepositories)
      .values({ userId, repositoryId })
      .returning();
    return saved;
  }

  async unsaveRepository(userId: string, repositoryId: string): Promise<void> {
    await db
      .delete(savedRepositories)
      .where(and(eq(savedRepositories.userId, userId), eq(savedRepositories.repositoryId, repositoryId)));
  }

  async getSavedRepositories(userId: string): Promise<(SavedRepository & { repository: Repository })[]> {
    return await db
      .select({
        id: savedRepositories.id,
        userId: savedRepositories.userId,
        repositoryId: savedRepositories.repositoryId,
        createdAt: savedRepositories.createdAt,
        repository: repositories,
      })
      .from(savedRepositories)
      .innerJoin(repositories, eq(savedRepositories.repositoryId, repositories.id))
      .where(eq(savedRepositories.userId, userId))
      .orderBy(desc(savedRepositories.createdAt));
  }

  async getSavedRepositoriesPaginated(userId: string, limit: number, offset: number): Promise<(SavedRepository & { repository: Repository })[]> {
    return await db
      .select({
        id: savedRepositories.id,
        userId: savedRepositories.userId,
        repositoryId: savedRepositories.repositoryId,
        createdAt: savedRepositories.createdAt,
        repository: repositories,
      })
      .from(savedRepositories)
      .innerJoin(repositories, eq(savedRepositories.repositoryId, repositories.id))
      .where(eq(savedRepositories.userId, userId))
      .orderBy(desc(savedRepositories.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getSavedRepositoriesCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedRepositories)
      .where(eq(savedRepositories.userId, userId));
    return result.count;
  }

  async isRepositorySaved(userId: string, repositoryId: string): Promise<boolean> {
    const [saved] = await db
      .select()
      .from(savedRepositories)
      .where(and(eq(savedRepositories.userId, userId), eq(savedRepositories.repositoryId, repositoryId)));
    return !!saved;
  }

  // Similar repositories operations
  async getSimilarRepositories(repositoryId: string, limit = 5): Promise<(SimilarRepository & { similarRepository: Repository })[]> {
    return await db
      .select({
        id: similarRepositories.id,
        repositoryId: similarRepositories.repositoryId,
        similarRepositoryId: similarRepositories.similarRepositoryId,
        similarity: similarRepositories.similarity,
        createdAt: similarRepositories.createdAt,
        similarRepository: repositories,
      })
      .from(similarRepositories)
      .innerJoin(repositories, eq(similarRepositories.similarRepositoryId, repositories.id))
      .where(eq(similarRepositories.repositoryId, repositoryId))
      .orderBy(desc(similarRepositories.similarity))
      .limit(limit);
  }

  async createSimilarRepositories(repositoryId: string, similarRepos: { repositoryId: string; similarity: number }[]): Promise<void> {
    if (similarRepos.length === 0) return;
    
    const values = similarRepos.map(repo => ({
      repositoryId,
      similarRepositoryId: repo.repositoryId,
      similarity: repo.similarity,
    }));

    await db.insert(similarRepositories).values(values);
  }

  // Trending repositories
  async getTrendingRepositories(): Promise<Repository[]> {
    // Get repositories with recent analyses and high scores
    const result = await db
      .select({
        repository: repositories,
        avgScore: sql<number>`avg(${repositoryAnalyses.overallScore})`,
        analysisCount: sql<number>`count(${repositoryAnalyses.id})`,
      })
      .from(repositories)
      .innerJoin(repositoryAnalyses, eq(repositories.id, repositoryAnalyses.repositoryId))
      .where(sql`${repositoryAnalyses.createdAt} > now() - interval '7 days'`)
      .groupBy(repositories.id)
      .having(sql`avg(${repositoryAnalyses.overallScore}) > 7`)
      .orderBy(desc(sql`avg(${repositoryAnalyses.overallScore})`))
      .limit(10);
    
    return result.map(r => r.repository);
  }

  // User Profile & Preferences operations
  async getUserPreferences(userId: string): Promise<UserPreference | undefined> {
    const [pref] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    
    if (!pref) {
      // Create default preferences if none exist
      const [newPref] = await db
        .insert(userPreferences)
        .values({ userId })
        .returning();
      return newPref;
    }
    
    return pref;
  }

  async updateUserPreferences(userId: string, preferences: Partial<InsertUserPreference>): Promise<UserPreference> {
    const [updated] = await db
      .insert(userPreferences)
      .values({ ...preferences, userId })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          ...preferences,
          updatedAt: new Date(),
        },
      })
      .returning();
    return updated;
  }

  // Bookmarks operations
  async getUserBookmarks(userId: string): Promise<Bookmark[]> {
    return await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));
  }

  async getUserBookmarksPaginated(userId: string, limit: number, offset: number): Promise<Bookmark[]> {
    return await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getUserBookmarksCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId));
    return result.count;
  }

  async addBookmark(userId: string, repositoryId: string, notes?: string): Promise<Bookmark> {
    const [bookmark] = await db
      .insert(bookmarks)
      .values({ userId, repositoryId, notes })
      .returning();
    return bookmark;
  }

  async removeBookmark(userId: string, repositoryId: string): Promise<void> {
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.repositoryId, repositoryId)));
  }

  // Tags operations
  async getUserTags(userId: string): Promise<Tag[]> {
    return await db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(tags.name);
  }

  async getUserTagsPaginated(userId: string, limit: number, offset: number): Promise<Tag[]> {
    return await db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(tags.name)
      .limit(limit)
      .offset(offset);
  }

  async getUserTagsCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tags)
      .where(eq(tags.userId, userId));
    return result.count;
  }

  async createTag(userId: string, name: string, color = "#FF6B35"): Promise<Tag> {
    const [tag] = await db
      .insert(tags)
      .values({ userId, name, color })
      .returning();
    return tag;
  }

  async deleteTag(userId: string, tagId: number): Promise<void> {
    // First delete all repository tag associations
    await db
      .delete(repositoryTags)
      .where(and(eq(repositoryTags.tagId, tagId), eq(repositoryTags.userId, userId)));
    
    // Then delete the tag itself
    await db
      .delete(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
  }

  async tagRepository(repositoryId: string, tagId: number, userId: string): Promise<RepositoryTag> {
    const [repoTag] = await db
      .insert(repositoryTags)
      .values({ repositoryId, tagId, userId })
      .returning();
    return repoTag;
  }

  async untagRepository(repositoryId: string, tagId: number, userId: string): Promise<void> {
    await db
      .delete(repositoryTags)
      .where(
        and(
          eq(repositoryTags.repositoryId, repositoryId),
          eq(repositoryTags.tagId, tagId),
          eq(repositoryTags.userId, userId)
        )
      );
  }

  async getRepositoryTags(repositoryId: string, userId: string): Promise<Tag[]> {
    const result = await db
      .select({
        id: tags.id,
        userId: tags.userId,
        name: tags.name,
        color: tags.color,
        createdAt: tags.createdAt,
      })
      .from(repositoryTags)
      .innerJoin(tags, eq(repositoryTags.tagId, tags.id))
      .where(
        and(
          eq(repositoryTags.repositoryId, repositoryId),
          eq(repositoryTags.userId, userId)
        )
      );
    return result;
  }

  // Collections operations (implementation moved below)

  async addToCollection(collectionId: number, repositoryId: string, notes?: string): Promise<CollectionItem> {
    const [maxPosition] = await db
      .select({ max: sql<number>`COALESCE(MAX(${collectionItems.position}), 0)` })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));
    
    const [item] = await db
      .insert(collectionItems)
      .values({
        collectionId,
        repositoryId,
        notes,
        position: (maxPosition?.max || 0) + 1,
      })
      .returning();
    
    // Update collection's updatedAt
    await db
      .update(collections)
      .set({ updatedAt: new Date() })
      .where(eq(collections.id, collectionId));
    
    return item;
  }

  // Activity tracking
  async trackActivity(userId: string, action: string, repositoryId?: string, metadata?: Record<string, unknown>): Promise<UserActivity> {
    const [activity] = await db
      .insert(userActivities)
      .values({ userId, action, repositoryId, metadata })
      .returning();
    return activity;
  }

  async getUserRecentActivity(userId: string, limit = 20): Promise<UserActivity[]> {
    return await db
      .select()
      .from(userActivities)
      .where(eq(userActivities.userId, userId))
      .orderBy(desc(userActivities.createdAt))
      .limit(limit);
  }

  // Repository tracking operations
  async trackRepository(userId: string, repositoryId: string, trackingType: string): Promise<TrackedRepository> {
    // Check if already tracking
    const [existing] = await db
      .select()
      .from(trackedRepositories)
      .where(and(
        eq(trackedRepositories.userId, userId),
        eq(trackedRepositories.repositoryId, repositoryId)
      ));
    
    if (existing) {
      // Update existing tracking
      const [updated] = await db
        .update(trackedRepositories)
        .set({ 
          trackingType, 
          isActive: true,
          lastChecked: new Date() 
        })
        .where(eq(trackedRepositories.id, existing.id))
        .returning();
      return updated;
    }
    
    // Create new tracking
    const [tracked] = await db
      .insert(trackedRepositories)
      .values({
        userId,
        repositoryId,
        trackingType,
      })
      .returning();
    return tracked;
  }

  async untrackRepository(userId: string, repositoryId: string): Promise<void> {
    await db
      .update(trackedRepositories)
      .set({ isActive: false })
      .where(and(
        eq(trackedRepositories.userId, userId),
        eq(trackedRepositories.repositoryId, repositoryId)
      ));
  }

  async getTrackedRepositories(userId: string): Promise<(TrackedRepository & { repository: Repository })[]> {
    const result = await db
      .select({
        tracked: trackedRepositories,
        repository: repositories,
      })
      .from(trackedRepositories)
      .innerJoin(repositories, eq(trackedRepositories.repositoryId, repositories.id))
      .where(and(
        eq(trackedRepositories.userId, userId),
        eq(trackedRepositories.isActive, true)
      ))
      .orderBy(desc(trackedRepositories.createdAt));
    
    return result.map(r => ({ ...r.tracked, repository: r.repository }));
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    
    // Send real-time notification if available
    const globalWithNotification = global as typeof global & { sendRealtimeNotification?: (userId: string, notification: unknown) => void };
    if (globalWithNotification.sendRealtimeNotification) {
      globalWithNotification.sendRealtimeNotification(notification.userId, newNotification);
    }
    
    return newNotification;
  }

  async getUserNotifications(userId: string, unreadOnly = false): Promise<(Notification & { repository?: Repository })[]> {
    const query = db
      .select({
        notification: notifications,
        repository: repositories,
      })
      .from(notifications)
      .leftJoin(repositories, eq(notifications.repositoryId, repositories.id))
      .where(
        unreadOnly
          ? and(
              eq(notifications.userId, userId),
              eq(notifications.isRead, false)
            )
          : eq(notifications.userId, userId)
      )
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    
    const result = await query;
    return result.map(r => ({ 
      ...r.notification, 
      repository: r.repository || undefined 
    }));
  }

  async markNotificationAsRead(notificationId: number, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ 
        isRead: true, 
        readAt: new Date() 
      })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ 
        isRead: true, 
        readAt: new Date() 
      })
      .where(eq(notifications.userId, userId));
  }

  async deleteNotification(notificationId: number, userId: string): Promise<void> {
    await db
      .delete(notifications)
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  // Comments operations
  async getRepositoryComments(repositoryId: string): Promise<(Comment & { user: User, likeCount: number, hasLiked?: boolean })[]> {
    const commentsData = await db
      .select({
        comment: comments,
        user: users,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.repositoryId, repositoryId))
      .orderBy(desc(comments.createdAt));
    
    // Get like counts
    const commentIds = commentsData.map(c => c.comment.id);
    const likeCounts = await db
      .select({
        commentId: commentLikes.commentId,
        count: sql<number>`count(*)::int`,
      })
      .from(commentLikes)
      .where(sql`${commentLikes.commentId} = ANY(${commentIds})`)
      .groupBy(commentLikes.commentId);
    
    const likeCountMap = new Map(likeCounts.map(lc => [lc.commentId, lc.count]));
    
    return commentsData.map(cd => ({
      ...cd.comment,
      user: cd.user,
      likeCount: likeCountMap.get(cd.comment.id) || 0,
    }));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [newComment] = await db
      .insert(comments)
      .values(comment)
      .returning();
    return newComment;
  }

  async updateComment(commentId: number, userId: string, content: string): Promise<Comment> {
    const [updated] = await db
      .update(comments)
      .set({ 
        content,
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(and(
        eq(comments.id, commentId),
        eq(comments.userId, userId)
      ))
      .returning();
    return updated;
  }

  async deleteComment(commentId: number, userId: string): Promise<void> {
    await db
      .delete(comments)
      .where(and(
        eq(comments.id, commentId),
        eq(comments.userId, userId)
      ));
  }

  async likeComment(commentId: number, userId: string): Promise<void> {
    // Check if already liked
    const [existing] = await db
      .select()
      .from(commentLikes)
      .where(and(
        eq(commentLikes.commentId, commentId),
        eq(commentLikes.userId, userId)
      ));
    
    if (!existing) {
      await db.insert(commentLikes).values({ commentId, userId });
      // Update like count
      await db
        .update(comments)
        .set({ likes: sql`${comments.likes} + 1` })
        .where(eq(comments.id, commentId));
    }
  }

  async unlikeComment(commentId: number, userId: string): Promise<void> {
    const deleted = await db
      .delete(commentLikes)
      .where(and(
        eq(commentLikes.commentId, commentId),
        eq(commentLikes.userId, userId)
      ))
      .returning();
    
    if (deleted.length > 0) {
      // Update like count
      await db
        .update(comments)
        .set({ likes: sql`GREATEST(${comments.likes} - 1, 0)` })
        .where(eq(comments.id, commentId));
    }
  }

  // Ratings operations
  async getRepositoryRatings(repositoryId: string): Promise<(Rating & { user: User, helpfulCount: number })[]> {
    const ratingsData = await db
      .select({
        rating: ratings,
        user: users,
      })
      .from(ratings)
      .innerJoin(users, eq(ratings.userId, users.id))
      .where(eq(ratings.repositoryId, repositoryId))
      .orderBy(desc(ratings.createdAt));
    
    return ratingsData.map(rd => ({
      ...rd.rating,
      user: rd.user,
      helpfulCount: rd.rating.helpfulCount || 0,
    }));
  }

  async getRepositoryAverageRating(repositoryId: string): Promise<{ average: number, count: number }> {
    const [result] = await db
      .select({
        average: sql<number>`COALESCE(AVG(${ratings.rating}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(ratings)
      .where(eq(ratings.repositoryId, repositoryId));
    
    return { 
      average: result?.average || 0,
      count: result?.count || 0,
    };
  }

  async getUserRating(userId: string, repositoryId: string): Promise<Rating | undefined> {
    const [rating] = await db
      .select()
      .from(ratings)
      .where(and(
        eq(ratings.userId, userId),
        eq(ratings.repositoryId, repositoryId)
      ));
    return rating;
  }

  async createOrUpdateRating(rating: InsertRating): Promise<Rating> {
    const [upserted] = await db
      .insert(ratings)
      .values(rating)
      .onConflictDoUpdate({
        target: [ratings.userId, ratings.repositoryId],
        set: {
          rating: rating.rating,
          review: rating.review,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async deleteRating(ratingId: number, userId: string): Promise<void> {
    await db
      .delete(ratings)
      .where(and(
        eq(ratings.id, ratingId),
        eq(ratings.userId, userId)
      ));
  }

  async markRatingHelpful(ratingId: number, userId: string): Promise<void> {
    // Check if already marked
    const [existing] = await db
      .select()
      .from(ratingHelpful)
      .where(and(
        eq(ratingHelpful.ratingId, ratingId),
        eq(ratingHelpful.userId, userId)
      ));
    
    if (!existing) {
      await db.insert(ratingHelpful).values({ ratingId, userId });
      // Update helpful count
      await db
        .update(ratings)
        .set({ helpfulCount: sql`${ratings.helpfulCount} + 1` })
        .where(eq(ratings.id, ratingId));
    }
  }

  async unmarkRatingHelpful(ratingId: number, userId: string): Promise<void> {
    const deleted = await db
      .delete(ratingHelpful)
      .where(and(
        eq(ratingHelpful.ratingId, ratingId),
        eq(ratingHelpful.userId, userId)
      ))
      .returning();
    
    if (deleted.length > 0) {
      // Update helpful count
      await db
        .update(ratings)
        .set({ helpfulCount: sql`GREATEST(${ratings.helpfulCount} - 1, 0)` })
        .where(eq(ratings.id, ratingId));
    }
  }

  // Collections operations
  async getUserCollections(userId: string): Promise<(Collection & { repositoryCount: number })[]> {
    const collectionsData = await db
      .select({
        collection: collections,
      })
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(desc(collections.createdAt));
    
    // Get repository counts
    const collectionIds = collectionsData.map(c => c.collection.id);
    const counts = await db
      .select({
        collectionId: collectionItems.collectionId,
        count: sql<number>`count(*)::int`,
      })
      .from(collectionItems)
      .where(sql`${collectionItems.collectionId} = ANY(${collectionIds})`)
      .groupBy(collectionItems.collectionId);
    
    const countMap = new Map(counts.map(c => [c.collectionId, c.count]));
    
    return collectionsData.map(cd => ({
      ...cd.collection,
      repositoryCount: countMap.get(cd.collection.id) || 0,
    }));
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    const [newCollection] = await db
      .insert(collections)
      .values(collection)
      .returning();
    return newCollection;
  }

  async updateCollection(collectionId: number, userId: string, updates: Partial<InsertCollection>): Promise<Collection> {
    const [updated] = await db
      .update(collections)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(collections.id, collectionId),
        eq(collections.userId, userId)
      ))
      .returning();
    return updated;
  }

  async deleteCollection(collectionId: number, userId: string): Promise<void> {
    await db
      .delete(collections)
      .where(and(
        eq(collections.id, collectionId),
        eq(collections.userId, userId)
      ));
  }

  async addRepositoryToCollection(collectionId: number, repositoryId: string, userId: string): Promise<CollectionItem> {
    // First verify the collection belongs to the user
    const [collection] = await db
      .select()
      .from(collections)
      .where(and(
        eq(collections.id, collectionId),
        eq(collections.userId, userId)
      ));
    
    if (!collection) {
      throw new Error('Collection not found or access denied');
    }
    
    // Check if already in collection
    const [existing] = await db
      .select()
      .from(collectionItems)
      .where(and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.repositoryId, repositoryId)
      ));
    
    if (existing) {
      return existing;
    }
    
    const [item] = await db
      .insert(collectionItems)
      .values({
        collectionId,
        repositoryId,
      })
      .returning();
    return item;
  }

  async removeRepositoryFromCollection(collectionId: number, repositoryId: string, userId: string): Promise<void> {
    // First verify the collection belongs to the user
    const [collection] = await db
      .select()
      .from(collections)
      .where(and(
        eq(collections.id, collectionId),
        eq(collections.userId, userId)
      ));
    
    if (!collection) {
      throw new Error('Collection not found or access denied');
    }
    
    await db
      .delete(collectionItems)
      .where(and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.repositoryId, repositoryId)
      ));
  }

  async getCollectionRepositories(collectionId: number): Promise<Repository[]> {
    const items = await db
      .select({
        repository: repositories,
      })
      .from(collectionItems)
      .innerJoin(repositories, eq(collectionItems.repositoryId, repositories.id))
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(collectionItems.position);
    
    return items.map(i => i.repository);
  }

  // Team operations
  async getUserTeams(userId: string): Promise<Array<{ id: string; name: string; role: string }>> {
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        ownerId: teams.ownerId,
        createdAt: teams.createdAt,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId));
    
    // Get member counts for each team
    const teamsWithCounts = await Promise.all(userTeams.map(async (team) => {
      const [count] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, team.id));
      
      return {
        ...team,
        memberCount: count?.count || 1,
      };
    }));
    
    return teamsWithCounts;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    
    // Add owner as a team member
    await db.insert(teamMembers).values({
      teamId: newTeam.id,
      userId: team.ownerId,
      role: 'owner',
    });
    
    return newTeam;
  }

  async isTeamMember(teamId: string, userId: string): Promise<boolean> {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      ));
    
    return !!member;
  }

  async getTeamMembers(teamId: string): Promise<Array<{ userId: string; role: string; email?: string }>> {
    const members = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        teamId: teamMembers.teamId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, teamId));
    
    return members;
  }

  async getTeamMemberRole(teamId: string, userId: string): Promise<string | null> {
    const [member] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      ));
    
    return member?.role || null;
  }

  async createTeamInvitation(invitation: { teamId: string; email: string; role: string; invitedBy: string }): Promise<{ id: string; token: string; expiresAt: Date }> {
    const token = Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
    
    const [newInvitation] = await db
      .insert(teamInvitations)
      .values({
        ...invitation,
        token,
        expiresAt,
      })
      .returning();
    
    // Note: Email invitation functionality can be added in future enhancement
    return newInvitation;
  }

  async updateTeamMemberRole(memberId: string, role: string): Promise<void> {
    await db
      .update(teamMembers)
      .set({ role })
      .where(eq(teamMembers.id, memberId));
  }

  async removeTeamMember(memberId: string): Promise<void> {
    await db
      .delete(teamMembers)
      .where(eq(teamMembers.id, memberId));
  }

  // API Key operations
  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKeyByKey(key: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, key));
    
    return apiKey;
  }

  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [newKey] = await db
      .insert(apiKeys)
      .values(apiKey)
      .returning();
    
    return newKey;
  }

  async updateApiKeyLastUsed(keyId: number): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyId));
  }

  async deleteApiKey(keyId: number, userId: string): Promise<void> {
    await db
      .delete(apiKeys)
      .where(and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.userId, userId)
      ));
  }

  async logApiUsage(usage: InsertApiUsage): Promise<void> {
    await db.insert(apiUsage).values(usage);
  }

  async getApiUsageStats(apiKeyId: number, hours: number = 24): Promise<any> {
    const since = new Date();
    since.setHours(since.getHours() - hours);
    
    const usage = await db
      .select({
        endpoint: apiUsage.endpoint,
        method: apiUsage.method,
        count: sql<number>`COUNT(*)`,
        avgResponseTime: sql<number>`AVG(${apiUsage.responseTime})`,
      })
      .from(apiUsage)
      .where(and(
        eq(apiUsage.apiKeyId, apiKeyId),
        sql`${apiUsage.timestamp} >= ${since}`
      ))
      .groupBy(apiUsage.endpoint, apiUsage.method);
    
    return usage;
  }

  // Webhook operations
  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    return await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.userId, userId))
      .orderBy(desc(webhooks.createdAt));
  }

  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const [newWebhook] = await db
      .insert(webhooks)
      .values(webhook)
      .returning();
    
    return newWebhook;
  }

  async updateWebhook(webhookId: number, userId: string, updates: Partial<Webhook>): Promise<void> {
    await db
      .update(webhooks)
      .set(updates)
      .where(and(
        eq(webhooks.id, webhookId),
        eq(webhooks.userId, userId)
      ));
  }

  async deleteWebhook(webhookId: number, userId: string): Promise<void> {
    await db
      .delete(webhooks)
      .where(and(
        eq(webhooks.id, webhookId),
        eq(webhooks.userId, userId)
      ));
  }

  // Code Review operations
  async createCodeReview(review: InsertCodeReview): Promise<CodeReview> {
    const [newReview] = await db
      .insert(codeReviews)
      .values(review)
      .returning();
    
    return newReview;
  }

  async getUserCodeReviews(userId: string, limit: number = 50): Promise<CodeReview[]> {
    return await db
      .select()
      .from(codeReviews)
      .where(eq(codeReviews.userId, userId))
      .orderBy(desc(codeReviews.createdAt))
      .limit(limit);
  }

  async getCodeReview(reviewId: string, userId: string): Promise<CodeReview | undefined> {
    const [review] = await db
      .select()
      .from(codeReviews)
      .where(and(
        eq(codeReviews.id, reviewId),
        eq(codeReviews.userId, userId)
      ));
    
    return review;
  }

  async deleteCodeReview(reviewId: string, userId: string): Promise<void> {
    await db
      .delete(codeReviews)
      .where(and(
        eq(codeReviews.id, reviewId),
        eq(codeReviews.userId, userId)
      ));
  }
}

export const storage = new DatabaseStorage();
