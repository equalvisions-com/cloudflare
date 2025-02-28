-- SQL to delete all RSS entries related to Libsyn feeds

-- First, find all feed IDs that contain 'libsyn' in the feed_url
SELECT id, feed_url, title FROM rss_feeds WHERE feed_url LIKE '%libsyn%';

-- Delete all entries from those feeds
DELETE FROM rss_entries 
WHERE feed_id IN (
  SELECT id FROM rss_feeds WHERE feed_url LIKE '%libsyn%'
);

-- Optionally, if you also want to delete the feed definitions:
-- DELETE FROM rss_feeds WHERE feed_url LIKE '%libsyn%';

-- Alternative: If you want to delete entries that have 'libsyn' in their link or guid
-- (This might catch entries from non-Libsyn feeds that link to Libsyn content)
DELETE FROM rss_entries 
WHERE link LIKE '%libsyn%' OR guid LIKE '%libsyn%';

-- If you want to delete entries with Libsyn images:
DELETE FROM rss_entries 
WHERE image LIKE '%libsyn%';

-- IMPORTANT: Before running these DELETE statements in production,
-- it's recommended to first run the SELECT queries to verify what will be deleted 