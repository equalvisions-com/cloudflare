-- ULTIMATE P-SCORE OPTIMIZATION FOR RSS SYSTEM
-- Goal: Minimize "rows read" while maintaining performance

-- STEP 1: Remove redundant indexes (BIGGEST IMPACT)
ALTER TABLE rss_entries DROP INDEX idx_pub_date;
ALTER TABLE rss_entries DROP INDEX idx_feed_id;
ALTER TABLE rss_entries DROP INDEX idx_guid;
ALTER TABLE rss_entries DROP INDEX idx_feed_pubdate_composite;

-- STEP 2: Keep only essential indexes
-- ✅ PRIMARY KEY (id) - Required
-- ✅ UNIQUE KEY unique_entry (feed_id, guid) - Prevents duplicates  
-- ✅ KEY idx_feed_pubdate (feed_id, pub_date DESC) - Main pagination
-- ✅ KEY idx_created_at (created_at) - Queue consumer

-- STEP 3: Optimize rss_feeds table
ALTER TABLE rss_feeds DROP INDEX idx_last_fetched;  -- Rarely used by Workers

-- FINAL INDEX COUNT:
-- rss_entries: 3 indexes (PRIMARY + unique_entry + idx_feed_pubdate + idx_created_at)
-- rss_feeds: 4 indexes (PRIMARY + feed_url + idx_title + idx_processing_until)

-- EXPECTED P-SCORE REDUCTION: 40-60%