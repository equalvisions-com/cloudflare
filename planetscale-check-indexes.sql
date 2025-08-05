-- Check existing indexes in PlanetScale database
-- Run these commands to see what indexes already exist

-- 1. Check all indexes on rss_feeds table
SHOW INDEX FROM rss_feeds;

-- 2. Check all indexes on rss_entries table  
SHOW INDEX FROM rss_entries;

-- 3. Verify specific indexes we want to add
-- Look for these in the output above:
-- rss_feeds: idx_title, idx_processing_until
-- rss_entries: idx_feed_pubdate, idx_created_at, idx_feed_pubdate_composite