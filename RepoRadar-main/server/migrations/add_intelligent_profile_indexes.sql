-- Performance indexes for intelligent profile features
-- These indexes optimize common query patterns for bookmarks, tags, and recommendations

-- Bookmarks indexes (already exist in schema, but adding composite indexes for better performance)
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_repo ON bookmarks(user_id, repository_id);

-- Tags indexes (already exist in schema, but adding composite indexes)
CREATE INDEX IF NOT EXISTS idx_tags_user_name ON tags(user_id, name);

-- Repository tags indexes (already exist in schema, but adding composite indexes)
CREATE INDEX IF NOT EXISTS idx_repository_tags_repo_user ON repository_tags(repository_id, user_id);
CREATE INDEX IF NOT EXISTS idx_repository_tags_tag_user ON repository_tags(tag_id, user_id);
CREATE INDEX IF NOT EXISTS idx_repository_tags_user_tag ON repository_tags(user_id, tag_id);

-- User preferences index (already exists)
-- idx_user_preferences_user already defined in schema

-- User activities indexes for recommendation generation
CREATE INDEX IF NOT EXISTS idx_user_activities_user_created ON user_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_action_created ON user_activities(user_id, action, created_at DESC);

-- Repository analyses indexes for analytics
CREATE INDEX IF NOT EXISTS idx_repository_analyses_user_created ON repository_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repository_analyses_repo_created ON repository_analyses(repository_id, created_at DESC);

-- Repositories indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_repositories_stars ON repositories(stars DESC);
CREATE INDEX IF NOT EXISTS idx_repositories_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_repositories_created ON repositories(created_at DESC);

-- Add GIN index for array searches on user preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_languages ON user_preferences USING GIN (preferred_languages);
CREATE INDEX IF NOT EXISTS idx_user_preferences_topics ON user_preferences USING GIN (preferred_topics);
CREATE INDEX IF NOT EXISTS idx_user_preferences_excluded ON user_preferences USING GIN (excluded_topics);

-- Add GIN index for repository topics array
CREATE INDEX IF NOT EXISTS idx_repositories_topics ON repositories USING GIN (topics);

-- Analyze tables to update statistics for query planner
ANALYZE bookmarks;
ANALYZE tags;
ANALYZE repository_tags;
ANALYZE user_preferences;
ANALYZE user_activities;
ANALYZE repository_analyses;
ANALYZE repositories;
