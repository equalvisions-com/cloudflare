// Client-side interface definitions only
export interface RSSItem {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  guid: string;
  image?: string;
  feedUrl: string;
  mediaType?: string;
}

// Import RSSEntryResponse from centralized types
import type { RSSEntryResponse } from './types';

// Format RSS key to match Convex schema
export function formatRSSKey(postTitle: string): string {
  return `rss.${postTitle.replace(/\s+/g, '_')}`;
}

// Client-side function to fetch RSS entries from the API
export async function getRSSEntries(postTitle: string, feedUrl: string, mediaType?: string): Promise<RSSItem[]> {
  try {
    const url = new URL(`/api/rss/${encodeURIComponent(postTitle)}`, window.location.origin);
    url.searchParams.append('feedUrl', encodeURIComponent(feedUrl));
    if (mediaType) {
      url.searchParams.append('mediaType', encodeURIComponent(mediaType));
    }
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS entries: ${response.statusText}`);
    }
    
    const data = await response.json() as RSSEntryResponse;
    return data.entries.map((item) => item.entry);
  } catch (error) {

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
    const url = new URL('/api/rss', window.location.origin);
    url.searchParams.append('postTitles', encodeURIComponent(JSON.stringify(postTitles)));
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('limit', limit.toString());
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Failed to fetch merged RSS entries: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.entries;
  } catch (error) {

    return null;
  }
} 