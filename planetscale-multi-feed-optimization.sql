-- PlanetScale Multi-Feed Query Optimization
-- Issue: 61,629 rows read for 52 rows returned (1,185:1 ratio)
-- 
-- Problem: Multi-feed IN() query with ORDER BY across different feeds
-- is causing inefficient index usage and excessive row scanning
--
-- Current problematic query:
-- SELECT e.*, f.title as feed_title, f.feed_url 
-- FROM rss_entries e 
-- JOIN rss_feeds f ON e.feed_id = f.id 
-- WHERE e.feed_id IN (1,2,3,4,5,...) 
-- ORDER BY e.pub_date DESC, e.id DESC 
-- LIMIT 31 OFFSET 0;

-- SOLUTION 1: Add specialized composite index for multi-feed pagination
-- This index will be optimized for the exact query pattern
ALTER TABLE rss_entries ADD INDEX idx_multi_feed_pagination (pub_date DESC, id DESC, feed_id);

-- SOLUTION 2: Alternative approach - feed-specific index with ID for uniqueness
-- This ensures sorting efficiency even with multiple feeds
ALTER TABLE rss_entries ADD INDEX idx_pubdate_id_feed (pub_date DESC, id DESC, feed_id);

-- SOLUTION 3: Remove any redundant indexes that might be confusing the optimizer
-- Check what indexes currently exist:
SHOW INDEX FROM rss_entries WHERE Key_name LIKE '%feed%' OR Key_name LIKE '%pub%';

-- Expected performance improvement:
-- • Rows read should drop from 61,629 to ~100-200 (near 1:1 ratio)
-- • Query time should improve significantly
-- • P-scores should decrease dramatically

-- NOTE: Only apply ONE of the above index solutions
-- Test with SOLUTION 1 first, as it's specifically designed for this query pattern