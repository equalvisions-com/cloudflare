-- PlanetScale Database Indexes for RSS System
-- Apply these indexes to optimize RSS feed processing and pagination
-- Run these commands in your PlanetScale dashboard or CLI

-- 1. Composite index for common pagination query pattern
-- Optimizes: SELECT ... FROM rss_entries WHERE feed_id = ? ORDER BY pub_date DESC LIMIT ? OFFSET ?
ALTER TABLE rss_entries ADD INDEX idx_feed_pubdate (feed_id, pub_date DESC);

-- 2. Index for recent entries detection (used by queue consumer)
-- Optimizes: SELECT ... WHERE created_at >= ?
ALTER TABLE rss_entries ADD INDEX idx_created_at (created_at);

-- 3. Composite index for multi-feed queries with date ordering
-- Optimizes: SELECT ... FROM rss_entries e JOIN rss_feeds f WHERE f.title IN (...) ORDER BY e.pub_date DESC
ALTER TABLE rss_entries ADD INDEX idx_feed_pubdate_composite (feed_id, pub_date DESC, id);

-- 4. Workers-specific optimization for database locking
-- Optimizes: UPDATE rss_feeds SET processing_until = ? WHERE feed_url = ? AND processing_until < ?
ALTER TABLE rss_feeds ADD INDEX idx_processing_until (processing_until);

-- 5. Index for feed lookups by title (if not already exists)
-- Optimizes: Multi-feed queries by post title
ALTER TABLE rss_feeds ADD INDEX idx_title (title);

-- ✅ TO VERIFY EXISTING INDEXES:
-- SHOW INDEX FROM rss_feeds;
-- SHOW INDEX FROM rss_entries;

-- 🗑️ CLEANUP: Drop unused table (if exists)
-- Only run this if you're sure rss_locks is no longer used
-- DROP TABLE IF EXISTS rss_locks;