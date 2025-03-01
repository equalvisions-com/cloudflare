import { redis } from './redis';
import { fetchRssEntriesFromPlanetScale, getFeedIdsByUrls } from './planetscale';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import orderBy from 'lodash/orderBy';

// Define the Redis keys
const FEATURED_ENTRIES_KEY = 'featured_entries';
const REFRESH_LOCK_KEY = 'featured_entries_lock';
// Cache expiration time: 4 hours in seconds
const CACHE_EXPIRATION = 4 * 60 * 60;
// Lock expiration: 60 seconds (increased for better visibility)
const LOCK_EXPIRATION = 60;

// Interface for RSS entry from PlanetScale
interface RssEntry {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  feed_url: string;
  // Add other entry properties as needed
}

// Interface for featured entries
export interface FeaturedEntry {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  feed_url: string;
  post_title?: string; // From Convex post
  category?: string;   // From Convex post
}

// Function to get featured entries from Redis or fetch them if needed
export async function getFeaturedEntries(): Promise<FeaturedEntry[]> {
  try {
    // Check if we have cached entries
    const cachedEntries = await redis.get<FeaturedEntry[]>(FEATURED_ENTRIES_KEY);
    
    if (cachedEntries) {
      console.log(`Using cached featured entries from Redis (${cachedEntries.length} entries)`);
      return cachedEntries;
    }
    
    console.log('No cached entries found in Redis, checking for lock');
    
    // Check if a lock exists
    const lockExists = await redis.get(REFRESH_LOCK_KEY);
    
    if (!lockExists) {
      // No lock exists, try to acquire it
      console.log('No lock exists, attempting to acquire lock');
      
      // Set the lock with expiration
      await redis.set(REFRESH_LOCK_KEY, `locked_at_${new Date().toISOString()}`, { ex: LOCK_EXPIRATION });
      
      // Double-check that we got the lock (in case of race conditions)
      const lockValue = await redis.get<string>(REFRESH_LOCK_KEY);
      
      if (lockValue && lockValue.startsWith('locked_at_')) {
        try {
          console.log('Lock acquired, fetching fresh data');
          // We got the lock, so we'll fetch and cache the data
          const entries = await fetchAndCacheFeaturedEntries();
          
          // Release the lock
          await redis.del(REFRESH_LOCK_KEY);
          console.log('Lock released after fetching data');
          
          return entries;
        } catch (error) {
          // Make sure to release the lock even if there's an error
          await redis.del(REFRESH_LOCK_KEY);
          console.log('Lock released after error');
          throw error;
        }
      }
    }
    
    // We didn't get the lock or it already exists, which means another process is already fetching
    console.log('Another process is already fetching data, waiting...');
    
    // Wait a short time and check if the cache has been populated
    for (let i = 0; i < 10; i++) {
      // Wait 500ms between checks (increased for better visibility)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if the cache has been populated
      const refreshedEntries = await redis.get<FeaturedEntry[]>(FEATURED_ENTRIES_KEY);
      
      if (refreshedEntries) {
        console.log(`Cache was refreshed by another process (${refreshedEntries.length} entries)`);
        return refreshedEntries;
      }
    }
    
    // If we've waited and still no cache, fetch directly (fallback)
    console.log('Waited too long for cache refresh, fetching directly');
    return await fetchAndCacheFeaturedEntries();
  } catch (error) {
    console.error('Error getting featured entries:', error);
    return [];
  }
}

// Function to fetch featured entries from Convex and PlanetScale and cache them
export async function fetchAndCacheFeaturedEntries(): Promise<FeaturedEntry[]> {
  try {
    console.log('Fetching featured posts from Convex and entries from PlanetScale');
    
    // Create a Convex client
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    
    // Get featured posts from Convex
    const featuredPosts = await convex.query(api.featured.getFeaturedPosts);
    
    if (!featuredPosts || featuredPosts.length === 0) {
      console.log('No featured posts found in Convex');
      return [];
    }
    
    // Extract feed URLs from featured posts
    const feedUrls = featuredPosts.map(post => post.feedUrl);
    
    // Get feed IDs from PlanetScale
    const feedsData = await getFeedIdsByUrls(feedUrls);
    
    if (!feedsData || feedsData.length === 0) {
      console.log('No matching feeds found in PlanetScale');
      return [];
    }
    
    // Create a map of feed URLs to feed IDs and collect feed IDs
    const feedIds: number[] = [];
    
    // Use type assertion to handle the external data type
    (feedsData as Array<{ id: number }>).forEach(feed => {
      feedIds.push(feed.id);
    });
    
    // Fetch entries from PlanetScale for these feed IDs
    // The database query already filters for the last 24 hours
    const entries = await fetchRssEntriesFromPlanetScale(feedIds);
    
    if (!entries || entries.length === 0) {
      console.log('No entries found in PlanetScale for featured posts');
      return [];
    }
    
    console.log(`Retrieved ${entries.length} entries from the last 24 hours`);
    
    // Create a map of feed URLs to post data
    const feedUrlToPostMap = new Map();
    featuredPosts.forEach(post => {
      feedUrlToPostMap.set(post.feedUrl, {
        title: post.title,
        category: post.category
      });
    });
    
    // Enrich entries with post data using type assertion for the external data
    const enrichedEntries = (entries as Array<RssEntry>).map(entry => ({
      ...entry,
      post_title: feedUrlToPostMap.get(entry.feed_url)?.title,
      category: feedUrlToPostMap.get(entry.feed_url)?.category
    }));
    
    // Sort entries by publication date (newest first) using Lodash's orderBy
    const sortedEntries = orderBy(
      enrichedEntries,
      [(entry) => new Date(entry.pub_date).getTime()],
      ['desc']
    );
    
    // Store the sorted list in Redis with expiration
    await redis.set(FEATURED_ENTRIES_KEY, sortedEntries, { ex: CACHE_EXPIRATION });
    
    console.log(`Cached ${sortedEntries.length} entries to Redis with ${CACHE_EXPIRATION} seconds expiration`);
    
    return sortedEntries;
  } catch (error) {
    console.error('Error fetching and caching featured entries:', error);
    return [];
  }
}
