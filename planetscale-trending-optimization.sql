-- PlanetScale Trending Query Optimization
-- 
-- ISSUE: Trending API was doing GROUP BY on entire rss_entries table
-- This could cause performance issues as the table grows
--
-- SOLUTION APPLIED:
-- 1. Scope the GROUP BY to only requested feeds (INNER JOIN with WHERE clause first)
-- 2. This reduces the dataset before grouping, making it much more efficient
--
-- OLD PROBLEMATIC QUERY:
-- SELECT feed_id, MAX(pub_date) as latest_pub_date
-- FROM rss_entries  -- ❌ Full table scan
-- GROUP BY feed_id
--
-- NEW OPTIMIZED QUERY:
-- SELECT re.feed_id, MAX(re.pub_date) as latest_pub_date
-- FROM rss_entries re
-- INNER JOIN rss_feeds rf ON re.feed_id = rf.id
-- WHERE rf.feed_url IN (?,?,?)  -- ✅ Scope first, then group
-- GROUP BY re.feed_id

-- SUPPORTING INDEX for trending queries:
-- This index optimizes the feed_id + pub_date operations
ALTER TABLE rss_entries ADD INDEX idx_feed_pubdate_trending (feed_id, pub_date DESC);

-- EXPECTED PERFORMANCE IMPROVEMENT:
-- • 70-90% faster execution for trending queries
-- • Scales better as rss_entries table grows
-- • Reduces impact on other database operations

-- MONITORING:
-- Check PlanetScale insights after deployment to confirm improvement
-- The trending query should show dramatically reduced "rows read"