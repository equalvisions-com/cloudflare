-- PlanetScale Index Cleanup - Remove Redundant Indexes
-- These are causing high P-scores due to query optimizer overhead

-- ❌ DROP: These are now redundant (covered by composite indexes)

-- 1. Drop idx_pub_date - covered by idx_feed_pubdate
ALTER TABLE rss_entries DROP INDEX idx_pub_date;

-- 2. Drop idx_feed_id - covered by idx_feed_pubdate  
ALTER TABLE rss_entries DROP INDEX idx_feed_id;

-- 3. Drop idx_guid - only keep if you do single GUID lookups (rare)
-- ALTER TABLE rss_entries DROP INDEX idx_guid;  -- Uncomment if you don't need single GUID queries

-- ✅ KEEP: These are essential and optimal
-- ✅ idx_feed_pubdate (feed_id, pub_date DESC) - Main pagination queries
-- ✅ idx_created_at (created_at) - Queue consumer queries
-- ✅ idx_feed_pubdate_composite (feed_id, pub_date DESC, id) - Complex pagination
-- ✅ unique_entry (feed_id, guid) - Prevents duplicates (UNIQUE constraint)
-- ✅ PRIMARY KEY (id) - Auto-increment primary key

-- 📊 EXPECTED RESULT:
-- - P-scores should drop by 30-50%
-- - Query performance will remain the same or improve
-- - Less index maintenance overhead on writes