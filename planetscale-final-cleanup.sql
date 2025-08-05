-- FINAL INDEX CLEANUP - Remove only the OLD redundant indexes
-- DO NOT touch the new indexes we just added!

-- ❌ REMOVE OLD REDUNDANT INDEXES:
ALTER TABLE rss_entries DROP INDEX idx_pub_date;     -- OLD - redundant 
ALTER TABLE rss_entries DROP INDEX idx_feed_id;      -- OLD - redundant
ALTER TABLE rss_entries DROP INDEX idx_guid;         -- OLD - rarely used
ALTER TABLE rss_feeds DROP INDEX idx_last_fetched;   -- OLD - rarely used

-- 🤔 OPTIONAL - Test removing this if P-scores still high:
-- ALTER TABLE rss_entries DROP INDEX idx_feed_pubdate_composite;

-- ✅ KEEP ALL THESE (the good ones we added):
-- ✅ idx_feed_pubdate (feed_id, pub_date DESC) - ESSENTIAL
-- ✅ idx_created_at (created_at) - ESSENTIAL  
-- ✅ idx_processing_until (processing_until) - ESSENTIAL
-- ✅ idx_title (title) - ESSENTIAL
-- ✅ unique_entry (feed_id, guid) - ESSENTIAL
-- ✅ PRIMARY KEYs - ESSENTIAL

-- FINAL RESULT:
-- rss_entries: 4-5 indexes (down from 7-8)
-- rss_feeds: 4 indexes (down from 5)