// Client-side interface definitions only
export interface RSSItem {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  guid: string;
  image?: string;
  feedUrl: string;
}

interface RSSEntryResponse {
  entries: Array<{ entry: RSSItem }>;
}

// Format RSS key to match Convex schema
export function formatRSSKey(postTitle: string): string {
  return `rss.${postTitle.replace(/\s+/g, '_')}`;
}

// Client-side function to fetch RSS entries from the API
export async function getRSSEntries(postTitle: string, feedUrl: string): Promise<RSSItem[]> {
  try {
    const response = await fetch(
      `/api/rss/${encodeURIComponent(postTitle)}?feedUrl=${encodeURIComponent(feedUrl)}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS entries: ${response.statusText}`);
    }
    
    const data = await response.json() as RSSEntryResponse;
    return data.entries.map((item) => item.entry);
  } catch (error) {
    console.error(`Error fetching RSS entries for ${postTitle}:`, error);
    return [];
  }
}

// Client-side function to fetch merged RSS entries
export async function getMergedRSSEntries(
  rssKeys: string[], 
  offset: number = 0, 
  limit: number = 30
): Promise<RSSItem[] | null> {
  try {
    if (!rssKeys || rssKeys.length === 0) return null;
    
    // Convert RSS keys to post titles
    const postTitles = rssKeys.map(key => key.replace(/^rss\./, '').replace(/_/g, ' '));
    
    // Fetch merged entries from the API
    const response = await fetch(
      `/api/rss?postTitles=${encodeURIComponent(JSON.stringify(postTitles))}&offset=${offset}&limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch merged RSS entries: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.entries;
  } catch (error) {
    console.error('Error merging RSS entries:', error);
    return null;
  }
} 