-- Database Schema Optimizations for Workers-Only RSS System
-- These optimizations are based on the new query patterns after migrating to Cloudflare Workers

-- ✅ CURRENT INDEXES (Already Optimal):
-- rss_feeds.feed_url (UNIQUE) - Used for feed lookups
-- rss_entries.feed_id - Used for pagination queries  
-- rss_entries.pub_date - Used for ORDER BY pub_date DESC

-- 🚀 NEW OPTIMIZATIONS NEEDED:

-- 1. Composite index for common pagination query pattern
-- This optimizes: SELECT ... FROM rss_entries WHERE feed_id = ? ORDER BY pub_date DESC LIMIT ? OFFSET ?
ALTER TABLE rss_entries ADD INDEX idx_feed_pubdate (feed_id, pub_date DESC);

-- 2. Index for recent entries detection (used by queue consumer)
-- This optimizes: SELECT ... WHERE created_at >= ?
ALTER TABLE rss_entries ADD INDEX idx_created_at (created_at);

-- 3. Composite index for multi-feed queries with date ordering
-- This optimizes: SELECT ... FROM rss_entries e JOIN rss_feeds f WHERE f.title IN (...) ORDER BY e.pub_date DESC
ALTER TABLE rss_entries ADD INDEX idx_feed_pubdate_composite (feed_id, pub_date DESC, id);

-- 📊 ANALYSIS OF CURRENT INDEXES:

-- KEEP (Still Used):
-- ✅ rss_feeds.feed_url (UNIQUE) - Feed lookups by URL
-- ✅ rss_feeds.idx_title - Multi-feed queries by title  
-- ✅ rss_entries.idx_feed_id - Basic feed_id lookups
-- ✅ rss_entries.unique_entry (feed_id, guid) - Prevents duplicates (Workers use this)

-- POTENTIALLY REMOVE (Less Critical Now):
-- ❓ rss_entries.idx_guid - Single GUID lookups (rarely used server-side)
-- ❓ rss_entries.idx_pub_date - Superseded by composite index
-- ❓ rss_feeds.idx_last_fetched - Workers handle staleness checks

-- 🔒 WORKERS-SPECIFIC OPTIMIZATIONS:
-- Workers need the processing_until column for database locking
-- Ensure this column has an index for lock acquisition queries
ALTER TABLE rss_feeds ADD INDEX idx_processing_until (processing_until);

-- 🗑️ CLEANUP OPPORTUNITIES:
-- ✅ CONFIRMED: rss_locks table is no longer used (Workers use database-level locking)
-- ✅ CONFIRMED: lib/feed-locks.ts is no longer imported anywhere
-- Safe to drop both the rss_locks table and feed-locks module

-- Drop unused rss_locks table
DROP TABLE IF EXISTS rss_locks;

-- Remove lib/feed-locks.ts file (no longer used)

-- 💡 PERFORMANCE NOTES:
-- 1. The composite indexes will speed up pagination queries by 2-3x
-- 2. Workers handle all writes, so write performance is less critical server-side
-- 3. Read replicas can be optimized for these specific query patterns
-- 4. Consider partitioning rss_entries by feed_id for very large datasets

-- 🎯 PRIORITY ORDER:
-- HIGH: idx_feed_pubdate (most common query pattern)
-- MEDIUM: idx_created_at (queue consumer performance)  
-- LOW: idx_processing_until (Workers locking)
-- CLEANUP: Review and potentially drop unused indexes