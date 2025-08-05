-- URGENT: Fix Multi-Feed Query Performance Issue
-- 
-- PROBLEM IDENTIFIED:
-- Query: SELECT e.*, f.title as feed_title, f.feed_url FROM rss_entries e JOIN rss_feeds f ON e.feed_id = f.id WHERE e.feed_id IN (<elements>) ORDER BY e.pub_date DESC, e.id DESC LIMIT ?, ?
-- Performance: 61,629 rows read for 52 rows returned (1,185:1 ratio)
-- Frequency: 40 executions (high-traffic pagination)
--
-- ROOT CAUSE:
-- Multi-feed IN() clause with ORDER BY across different feeds forces MySQL to scan
-- large portions of the table because existing indexes can't efficiently sort
-- across multiple feed partitions.

-- SOLUTION APPLIED:
-- 1. Code optimized to use UNION ALL approach (reduces rows read to ~200-500)
-- 2. Add supporting index for optimal performance:

-- Check current indexes first:
SHOW INDEX FROM rss_entries WHERE Key_name LIKE '%feed%' OR Key_name LIKE '%pub%';

-- Add optimized index for multi-feed pagination:
ALTER TABLE rss_entries ADD INDEX idx_multi_feed_pagination (pub_date DESC, id DESC, feed_id);

-- EXPECTED RESULTS AFTER APPLYING:
-- • Rows read: 61,629 → ~200-500 (97% reduction)
-- • Query performance: Significantly faster
-- • P-scores: Dramatic reduction
-- • User experience: Smooth pagination

-- MONITORING:
-- After applying, monitor the same query pattern in PlanetScale insights
-- The rows read should drop dramatically for this query pattern