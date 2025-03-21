import { getReadConnection, getWriteConnection, executeRead, executeWrite } from './database';

// Create a connection to PlanetScale for backward compatibility
// This will continue to work with existing code but defaults to the write connection
export const db = getWriteConnection();

// Function to fetch RSS entries from PlanetScale with date filtering
export async function fetchRssEntriesFromPlanetScale(feedIds: number[], maxAgeHours: number = 48) {
  if (!feedIds.length) return [];

  try {
    const placeholders = feedIds.map(() => '?').join(',');
    const query = `
      SELECT 
        e.id, 
        e.feed_id, 
        e.guid, 
        e.title, 
        e.link, 
        e.description, 
        e.pub_date, 
        e.image,
        f.feed_url
      FROM 
        rss_entries e
      JOIN 
        rss_feeds f ON e.feed_id = f.id
      WHERE 
        e.feed_id IN (${placeholders})
        AND e.pub_date > DATE_SUB(NOW(), INTERVAL ? HOUR)
      ORDER BY 
        e.pub_date DESC
    `;

    // Pass the maxAgeHours directly to the query
    const params = [...feedIds, maxAgeHours];
    
    // Use read replica for this query
    const result = await executeRead(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching RSS entries from PlanetScale:', error);
    return [];
  }
}

// Function to get feed IDs from feed URLs
export async function getFeedIdsByUrls(feedUrls: string[]) {
  if (!feedUrls.length) return [];

  try {
    const placeholders = feedUrls.map(() => '?').join(',');
    const query = `
      SELECT id, feed_url
      FROM rss_feeds
      WHERE feed_url IN (${placeholders})
    `;

    // Use read replica for this query
    const result = await executeRead(query, feedUrls);
    return result.rows;
  } catch (error) {
    console.error('Error fetching feed IDs from PlanetScale:', error);
    return [];
  }
}