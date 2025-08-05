-- PlanetScale Database Indexes - Safe Version
-- Only add indexes that don't already exist
-- Run SHOW INDEX queries first to check what exists

-- ⚠️ BEFORE RUNNING: Check existing indexes with planetscale-check-indexes.sql

-- 1. CONDITIONAL: Add feed pagination index (only if missing)
-- Check if idx_feed_pubdate exists on rss_entries first
-- ALTER TABLE rss_entries ADD INDEX idx_feed_pubdate (feed_id, pub_date DESC);

-- 2. CONDITIONAL: Add created_at index (only if missing)  
-- Check if idx_created_at exists on rss_entries first
-- ALTER TABLE rss_entries ADD INDEX idx_created_at (created_at);

-- 3. CONDITIONAL: Add composite index (only if missing)
-- Check if idx_feed_pubdate_composite exists on rss_entries first  
-- ALTER TABLE rss_entries ADD INDEX idx_feed_pubdate_composite (feed_id, pub_date DESC, id);

-- 4. CONDITIONAL: Add processing lock index (only if missing)
-- Check if idx_processing_until exists on rss_feeds first
-- ALTER TABLE rss_feeds ADD INDEX idx_processing_until (processing_until);

-- 5. ✅ CONFIRMED: idx_title already exists on rss_feeds (skip this one)
-- ALTER TABLE rss_feeds ADD INDEX idx_title (title); -- ALREADY EXISTS

-- 🔍 SAFE APPROACH:
-- 1. Run: SHOW INDEX FROM rss_feeds;
-- 2. Run: SHOW INDEX FROM rss_entries;  
-- 3. Only add indexes that don't appear in the results
-- 4. PlanetScale will show existing index names in the "Key_name" column