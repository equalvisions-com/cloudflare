import { checkAndRefreshFeeds } from "@/lib/rss.server";
import { executeRead } from "@/lib/database";
import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

// Add Edge Runtime configuration
export const runtime = 'edge';
// Mark as dynamic to ensure fresh data
export const dynamic = 'force-dynamic';
// Disable revalidation
export const revalidate = 0;

// Helper function to log only in development
const devLog = (message: string, data?: unknown) => {
  // TEMPORARILY ENABLE LOGS IN PRODUCTION FOR DEBUGGING
  // if (process.env.NODE_ENV !== 'production') {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  // }
};

// Helper function to log errors in both environments
const errorLog = (message: string, error?: unknown) => {
  if (error) {
    console.error(message, error);
  } else {
    console.error(message);
  }
};

export async function POST(request: Request) {
  try {
    const { postTitles, feedUrls, mediaTypes, existingGuids = [], newestEntryDate } = await request.json();
    
    // More detailed logging of inputs
    devLog('📥 API: Received refresh request with', {
      postTitlesCount: postTitles?.length || 0,
      feedUrlsCount: feedUrls?.length || 0,
      mediaTypesCount: mediaTypes?.length || 0,
      existingGuidsCount: existingGuids?.length || 0,
      newestEntryDate: newestEntryDate || 'Not provided'
    });
    
    // Validate that at least one of postTitles or feedUrls is provided
    if ((!postTitles || !Array.isArray(postTitles) || postTitles.length === 0) &&
        (!feedUrls || !Array.isArray(feedUrls) || feedUrls.length === 0)) {
      errorLog('❌ API: Both postTitles and feedUrls arrays are missing or empty');
      return NextResponse.json(
        { success: false, error: 'Invalid input: Either postTitles or feedUrls must be provided and cannot be empty' },
        { status: 400 }
      );
    }
    
    // Get authentication token
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Normalize the arrays to ensure they have matching lengths
    // Remove duplicates from feedUrls and mediaTypes
    const uniqueFeedUrls = feedUrls ? [...new Set(feedUrls)] : [];
    const uniqueMediaTypes = mediaTypes && Array.isArray(mediaTypes) ? [...mediaTypes] : [];
    
    // Log the mediaTypes we received in the request
    devLog('📊 API: Received mediaTypes array:', {
      mediaTypesInRequest: mediaTypes, 
      uniqueMediaTypes,
      count: uniqueMediaTypes.length
    });
    
    // Ensure we have valid postTitles and feedUrls arrays
    let normalizedPostTitles = postTitles && postTitles.length > 0 ? postTitles : [];
    
    // If we have postTitles but no feedUrls, or if feedUrls is shorter than postTitles,
    // we'll need to handle this special case
    let normalizedFeedUrls: string[] = [];
    // Use a more specific type that accepts both string and null
    let normalizedMediaTypesArray: Array<string | null> = [];
    
    if (normalizedPostTitles.length > 0) {
      // Case 1: We have postTitles, derive normalized arrays from them
      normalizedMediaTypesArray = normalizedPostTitles.map((title: string, index: number) => {
        // Preserve original mediaType if available
        return index < uniqueMediaTypes.length ? uniqueMediaTypes[index] : null;
      });
      
      if (uniqueFeedUrls.length > 0) {
        // If we have both postTitles and feedUrls, match them
        normalizedFeedUrls = normalizedPostTitles.map((title: string, index: number) => {
          return uniqueFeedUrls[index % uniqueFeedUrls.length] || '';
        });
      } else {
        // If we only have postTitles but no feedUrls, create empty placeholders
        normalizedFeedUrls = normalizedPostTitles.map(() => '');
      }
    } else if (uniqueFeedUrls.length > 0) {
      // Case 2: We only have feedUrls, derive normalized arrays from them
      normalizedPostTitles = (uniqueFeedUrls as string[]).map((url: string) => {
        // Extract a title from the URL if possible, otherwise use the URL
        try {
          const urlObj = new URL(url);
          return urlObj.hostname.replace(/^www\./, '');
        } catch (e) {
          // If URL parsing fails, just use the string itself
          return url;
        }
      });
      
      normalizedFeedUrls = uniqueFeedUrls as string[];
      
      normalizedMediaTypesArray = (uniqueFeedUrls as string[]).map((url: string, index: number) => {
        // Preserve original mediaType if available
        return uniqueMediaTypes.length > index ? uniqueMediaTypes[index] : null;
      });
    }
    
    devLog('🔄 API: Using normalized arrays...', { 
      normalizedPostTitles, 
      normalizedFeedUrls,
      normalizedMediaTypesArray,
      originalMediaTypes: uniqueMediaTypes // Log original for comparison
    });
    
    // Get information about which feeds need refreshing (for logging purposes only)
    // We'll refresh/create feeds regardless of the result
    const feedsToRefresh = await checkFeedsNeedingRefresh(postTitles);
    if (feedsToRefresh.length > 0) {
      devLog(`🔄 API: Found ${feedsToRefresh.length}/${postTitles.length} feeds needing refresh`);
    } else {
      devLog('⏭️ API: All existing feeds were refreshed within the last 4 hours');
    }
    
    let refreshedAny = false;
    
    // Check if any feeds are new (don't exist yet)
    const allExistingFeeds = await getAllExistingFeeds(postTitles);
    const newFeeds = postTitles.filter((title: string) => !allExistingFeeds.includes(title));
    
    if (newFeeds.length > 0) {
      devLog(`🆕 API: Found ${newFeeds.length} new feeds to create: ${newFeeds.join(', ')}`);
      refreshedAny = true;
    }
    
    // Only consider it a refresh if we have new feeds or some feeds need refreshing
    if (feedsToRefresh.length > 0 || newFeeds.length > 0) {
      // Always call checkAndRefreshFeeds to both refresh existing feeds AND create new ones
      devLog(`🔄 API: Checking and refreshing feeds, will create missing ones if needed`);
      
      // Convert array to all strings (replacing null with undefined) to match function signature
      const stringMediaTypes = normalizedMediaTypesArray.map(mt => mt === null ? undefined : mt) as string[] | undefined;
      
      await checkAndRefreshFeeds(postTitles, normalizedFeedUrls, stringMediaTypes);
      refreshedAny = true;
    } else {
      devLog('⏭️ API: Skipping refresh - no feeds need refreshing and no new feeds');
    }
    
    // Only get new entries if we actually refreshed anything
    // Define a type for the result of getNewEntriesExcludingGuids
    interface EntriesResult {
      entries: Array<{
        entry: {
          guid: string;
          title: string;
          link: string;
          pubDate: string;
          description?: string;
          content?: string;
          image?: string;
          mediaType?: string;
          feedTitle?: string;
          feedUrl: string;
        };
        initialData: {
          likes: { isLiked: boolean; count: number };
          comments: { count: number };
          retweets?: { isRetweeted: boolean; count: number };
        };
        postMetadata: any;
      }>;
      totalEntries: number;
      hasMore: boolean;
    }
    
    // Initialize with proper typing
    let newEntries: EntriesResult = { entries: [], totalEntries: 0, hasMore: false };
    
    if (refreshedAny) {
      // Get new entries excluding existing ones and older than newestEntryDate
      // We only check for new entries if we refreshed something
      newEntries = await getNewEntriesExcludingGuids(postTitles, existingGuids, newestEntryDate);
      
      // Log information about new entries by feed
      if (newEntries.entries.length > 0) {
        // Group entries by feed title for better logging
        const entriesByFeed = new Map<string, number>();
        newEntries.entries.forEach(e => {
          const feedTitle = e.entry.feedTitle || 'Unknown';
          entriesByFeed.set(feedTitle, (entriesByFeed.get(feedTitle) || 0) + 1);
        });
        
        // Log a summary of entries by feed
        devLog('📊 API: New entries by feed:');
        entriesByFeed.forEach((count, feed) => {
          devLog(`   - ${feed}: ${count} new entries`);
        });
        
        // Sort array for consistent ordering
        const sortedSummary = Array.from(entriesByFeed.entries())
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .map(([feed, count]) => `${feed} (${count})`)
          .join(', ');
        
        devLog(`✅ API: Found ${newEntries.entries.length} new entries - ${sortedSummary}`);
      } else {
        devLog('✅ API: No new entries found after refresh');
      }
    } else {
      devLog('⏭️ API: Skipping entry check since no feeds were refreshed or created');
    }
    
    // Return combined result
    const responseData = { 
      success: true, 
      refreshedAny,
      entries: refreshedAny ? newEntries.entries : [],
      newEntriesCount: refreshedAny ? newEntries.entries.length : 0,
      totalEntries: refreshedAny ? newEntries.totalEntries : 0, // Include total entry count for client state update
      postTitles: normalizedPostTitles, // Include the full list of post titles for client state
      refreshTimestamp: new Date().toISOString()
    };
    
    // SERVERLESS DEBUG: Add comprehensive logging of the response
    devLog('🔄 SERVERLESS: Final API response structure:', {
      success: responseData.success,
      refreshedAny: responseData.refreshedAny,
      entriesCount: responseData.entries.length,
      newEntriesCount: responseData.newEntriesCount,
      totalEntries: responseData.totalEntries,
      postTitlesCount: responseData.postTitles.length,
      hasEntries: responseData.entries.length > 0,
      firstEntryGuid: responseData.entries.length > 0 ? responseData.entries[0].entry.guid : 'N/A',
      firstEntryTitle: responseData.entries.length > 0 ? responseData.entries[0].entry.title : 'N/A'
    });
    
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    errorLog('❌ API: Error refreshing feeds:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh feeds' },
      { status: 500 }
    );
  }
}

// Function to check which feeds need refreshing (older than 4 hours)
async function checkFeedsNeedingRefresh(postTitles: string[]): Promise<string[]> {
  try {
    if (!postTitles || postTitles.length === 0) {
      return [];
    }
    
    // Define how old is "stale" - 4 hours
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    
    // Create placeholders for the SQL query
    const placeholders = postTitles.map(() => '?').join(',');
    
    // Query to find which feeds need refreshing
    const query = `
      SELECT title
      FROM rss_feeds
      WHERE title IN (${placeholders})
      AND (last_fetched IS NULL OR last_fetched < ?)
    `;
    
    const result = await executeRead(query, [...postTitles, fourHoursAgo]);
    
    // Extract titles of feeds needing refresh
    const staleFeeds = (result.rows as { title: string }[]).map(row => row.title);
    
    devLog(`Found ${staleFeeds.length} stale feeds that need refreshing:`, staleFeeds);
    
    return staleFeeds;
  } catch (error) {
    errorLog('Error checking feeds needing refresh:', error);
    return []; // Return empty array on error to be safe
  }
}

// Helper function to get only new entries excluding existing ones
async function getNewEntriesExcludingGuids(
  postTitles: string[], 
  existingGuids: string[] = [],
  newestEntryDate?: string
) {
  try {
    if (!postTitles || postTitles.length === 0) {
      return { entries: [], totalEntries: 0, hasMore: false };
    }
    
    // Create a set of existing GUIDs for efficient lookup
    const existingGuidsSet = new Set(existingGuids);
    
    // First get the last_fetched timestamps for all feeds to determine what's truly new
    const titlePlaceholders = postTitles.map(() => '?').join(',');
    
    // Get the last_fetched timestamps for all requested feeds
    const feedsQuery = `
      SELECT id, title, last_fetched 
      FROM rss_feeds 
      WHERE title IN (${titlePlaceholders})
    `;
    
    const feedsResult = await executeRead(feedsQuery, [...postTitles]);
    const feeds = feedsResult.rows as { id: number; title: string; last_fetched: string }[];
    
    // Check if we have any feeds
    if (!feeds || feeds.length === 0) {
      devLog(`No feeds found for titles: ${postTitles.join(', ')}`);
      return { entries: [], totalEntries: 0, hasMore: false };
    }
    
    // Parse the newest entry date if provided, or use a reasonable fallback
    let newestTimestamp: number | null = null;
    if (newestEntryDate) {
      try {
        newestTimestamp = new Date(newestEntryDate).getTime();
        devLog(`Using client-provided newest entry date: ${newestEntryDate}`);
      } catch (e) {
        devLog(`Error parsing newestEntryDate: ${e}`);
        newestTimestamp = null;
      }
    }
    
    // Get the oldest last_fetched time as our cutoff to determine what's truly new
    // With this approach, we'll only get entries created after the last refresh
    const oldestLastFetched = Math.min(...feeds.map(feed => Number(feed.last_fetched)));
    
    // If we don't have a valid last_fetched (e.g., new feeds), use a reasonable default (1 hour ago)
    const cutoffTimestamp = isNaN(oldestLastFetched) || oldestLastFetched === 0 
      ? Date.now() - (60 * 60 * 1000) // 1 hour ago as fallback
      : oldestLastFetched;
      
    // Log detailed debug information about timestamps
    devLog(`Feed last_fetched timestamps: ${feeds.map(f => `${f.title}: ${new Date(Number(f.last_fetched)).toISOString()}`).join(', ')}`);
    devLog(`Using cutoff timestamp for new entries: ${new Date(cutoffTimestamp).toISOString()}`);
    
    // Instead of using the created_at field (which might have values from when the entry was initially 
    // added to the database), we'll get all entries and filter them client-side since most feeds will 
    // have already been fetched recently, and we already know the entries to exclude by GUID.
    // This provides a more reliable filtering mechanism.
    
    // Build a query that gets only entries for these feeds without the timestamp filter
    const entriesQuery = `
      SELECT e.*, f.title as feed_title, f.feed_url
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE f.title IN (${titlePlaceholders})
      ORDER BY e.pub_date DESC
    `;
    
    // Execute query for all entries
    const entriesResult = await executeRead(entriesQuery, [...postTitles]);
    const entries = entriesResult.rows as any[];
    
    devLog(`Retrieved ${entries.length} total entries for these feeds`);
    
    // Since most feeds are already refreshed, the first filtering step is to exclude
    // entries we've already seen (by GUID)
    const uniqueEntries = entries.filter(entry => !existingGuidsSet.has(entry.guid));
    
    devLog(`Filtered to ${uniqueEntries.length} entries not in client after excluding ${existingGuids.length} existing GUIDs`);
    
    // SERVERLESS DEBUG: Log sample of unique entries found
    if (uniqueEntries.length > 0) {
      devLog('🔄 SERVERLESS: Sample of unique entries found:', {
        totalUnique: uniqueEntries.length,
        sampleEntries: uniqueEntries.slice(0, 3).map(e => ({
          guid: e.guid,
          title: e.title,
          feedTitle: e.feed_title,
          pubDate: e.pub_date,
          createdAt: e.created_at
        }))
      });
    } else {
      devLog('🔄 SERVERLESS: No unique entries found after GUID filtering');
      devLog('🔄 SERVERLESS: Existing GUIDs sample:', existingGuids.slice(0, 5));
      devLog('🔄 SERVERLESS: Database entries sample:', entries.slice(0, 3).map(e => ({
        guid: e.guid,
        title: e.title,
        feedTitle: e.feed_title
      })));
    }
    
    // IF uniqueEntries is excessively large (e.g., >100), this suggests that:
    // 1. We have feeds that were recently created and all entries are appearing as "new"
    // 2. The client might only have the first page of entries loaded
    
    // In this case, we'll restrict to truly new entries based on additional criteria:
    let filteredEntries = uniqueEntries;
    
    // Only apply the extra filtering if we have excessive entries
    if (uniqueEntries.length > 100) {
      devLog(`Large number of new entries detected (${uniqueEntries.length}), applying additional filtering`);
      
      // Check for new feeds (feeds with last_fetched close to now)
      const newlyCreatedFeeds = feeds.filter(feed => {
        // A feed is considered "new" if it was created in the last 10 minutes
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        return Number(feed.last_fetched) > tenMinutesAgo;
      });
      
      // If we have new feeds, we need a special approach
      if (newlyCreatedFeeds.length > 0) {
        devLog(`Detected ${newlyCreatedFeeds.length} newly created feeds, restricting entries to first page for these`);
        
        // For new feeds, only return the most recent entries (equivalent to the first page)
        const entriesByFeed = new Map<string, any[]>();
        
        // Group entries by feed title
        for (const entry of uniqueEntries) {
          if (!entriesByFeed.has(entry.feed_title)) {
            entriesByFeed.set(entry.feed_title, []);
          }
          entriesByFeed.get(entry.feed_title)!.push(entry);
        }
        
        // For each feed, only take the 30 most recent entries if it's a new feed
        const limitedEntries: any[] = [];
        
        for (const feed of feeds) {
          const feedEntries = entriesByFeed.get(feed.title) || [];
          
          // Sort entries by pub_date (newest first)
          feedEntries.sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime());
          
          // For new feeds, limit to 30 entries (first page equivalent)
          // For existing feeds with a proper last_fetched, include all entries
          const isNewFeed = newlyCreatedFeeds.some(f => f.title === feed.title);
          
          if (isNewFeed) {
            limitedEntries.push(...feedEntries.slice(0, 30));
            devLog(`Including first 30 entries for new feed: ${feed.title}`);
          } else {
            // For existing feeds, include entries created after the last_fetched time
            const feedLastFetched = Number(feed.last_fetched);
            
            // Get entries newer than the feed's last_fetched timestamp
            const newFeedEntries = feedEntries.filter(entry => {
              const entryDate = new Date(entry.created_at).getTime();
              return entryDate > feedLastFetched;
            });
            
            if (newFeedEntries.length > 0) {
              limitedEntries.push(...newFeedEntries);
              devLog(`Including ${newFeedEntries.length} truly new entries for existing feed: ${feed.title}`);
            } else {
              devLog(`No new entries for existing feed: ${feed.title}`);
            }
          }
        }
        
        filteredEntries = limitedEntries;
      } else {
        // No new feeds - actually use created_at/updated_at to filter
        filteredEntries = uniqueEntries.filter(entry => {
          const entryCreatedAt = new Date(entry.created_at).getTime();
          const entryUpdatedAt = new Date(entry.updated_at).getTime();
          
          // Entry is new if it was created or updated after the cutoff
          return entryCreatedAt > cutoffTimestamp || entryUpdatedAt > cutoffTimestamp;
        });
        
        devLog(`Filtered to ${filteredEntries.length} entries created/updated after the cutoff timestamp`);
      }
    }
    
    // This is where we'll add the chronological filter
    if (newestTimestamp && filteredEntries.length > 0) {
      // Further filter entries to only those newer than the newest entry in initial data
      const chronologicalEntries = filteredEntries.filter(entry => {
        const entryDate = new Date(entry.pub_date).getTime();
        return entryDate > newestTimestamp!;
      });
      
      if (chronologicalEntries.length !== filteredEntries.length) {
        devLog(`🔄 SERVERLESS: Chronological filter: ${filteredEntries.length} -> ${chronologicalEntries.length} entries (filtered out ${filteredEntries.length - chronologicalEntries.length} entries older than ${new Date(newestTimestamp).toISOString()})`);
        filteredEntries = chronologicalEntries;
      } else {
        devLog(`🔄 SERVERLESS: Chronological filter: No entries filtered out (all ${filteredEntries.length} entries are newer than ${new Date(newestTimestamp).toISOString()})`);
      }
    } else if (newestTimestamp) {
      devLog(`🔄 SERVERLESS: Chronological filter skipped: no filteredEntries (${filteredEntries.length})`);
    } else {
      devLog(`🔄 SERVERLESS: Chronological filter skipped: no newestTimestamp provided`);
    }
    
    // SERVERLESS DEBUG: Log final filtering results
    devLog(`🔄 SERVERLESS: Final filtering results:`, {
      originalEntries: entries.length,
      afterGuidFilter: uniqueEntries.length,
      afterAllFilters: filteredEntries.length,
      willReturn: Math.min(filteredEntries.length, 50)
    });
    
    if (filteredEntries.length === 0) {
      devLog('🔄 SERVERLESS: No new entries after applying all filters - returning empty result');
      return { entries: [], totalEntries: 0, hasMore: false };
    }
    
    // Limit the number of new entries we return and ensure proper ordering
    const limitedEntries = filteredEntries
      .sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime())
      .slice(0, 50); // Limit to 50 new entries at a time
    
    devLog(`🔄 SERVERLESS: Limited entries to ${limitedEntries.length} (from ${filteredEntries.length} filtered entries)`);
    
    // Get authentication token for Convex queries
    const token = await convexAuthNextjsToken();
    if (!token) {
      devLog('🔄 SERVERLESS: No auth token available - returning empty result');
      return { entries: [], totalEntries: 0, hasMore: false };
    }
    
    // Map the entries to the expected format
    const mappedEntries = limitedEntries.map(entry => ({
      guid: entry.guid,
      title: entry.title,
      link: entry.link,
      pubDate: entry.pub_date,
      description: entry.description,
      content: entry.content,
      image: entry.image,
      mediaType: entry.media_type,
      feedTitle: entry.feed_title,
      feedUrl: entry.feed_url
    }));
    
    devLog(`🔄 SERVERLESS: Mapped ${mappedEntries.length} entries to expected format`);
    
    // Get unique entry guids for batch query
    const guids = mappedEntries.map(entry => entry.guid);
    
    // Batch fetch entry data for all entries at once
    const entryData = await fetchQuery(
      api.entries.batchGetEntryData,
      { entryGuids: guids },
      { token }
    );
    
    devLog(`🔄 SERVERLESS: Fetched entry data for ${entryData?.length || 0} entries from Convex`);
    
    // Fetch post metadata
    const feedUrls = [...new Set(mappedEntries.map(entry => entry.feedUrl))];
    const postMetadata = await fetchQuery(
      api.posts.getPostsByFeedUrls,
      { feedUrls },
      { token }
    );
    
    devLog(`🔄 SERVERLESS: Fetched post metadata for ${postMetadata?.length || 0} feeds from Convex`);
    
    // Create a map of feed URLs to post metadata
    const postMetadataMap = new Map();
    if (postMetadata && Array.isArray(postMetadata)) {
      postMetadata.forEach(post => {
        postMetadataMap.set(post.feedUrl, {
          title: post.title,
          featuredImg: post.featuredImg,
          mediaType: post.mediaType,
          postSlug: post.postSlug,
          categorySlug: post.categorySlug,
          verified: post.verified
        });
      });
    }
    
    // Combine all data efficiently
    const entriesWithPublicData = mappedEntries.map((entry, index) => {
      // Create a safe fallback for post metadata
      const feedUrl = entry.feedUrl;
      // Retrieve the full metadata including verified status
      const metadata = postMetadataMap.get(feedUrl);
      
      const fallbackMetadata = {
        title: entry.feedTitle || entry.title || '',
        featuredImg: entry.image || '',
        mediaType: entry.mediaType || null,
        postSlug: '',
        categorySlug: '',
        verified: false
      };
      
      return {
        entry,
        initialData: entryData[index] || {
          likes: { isLiked: false, count: 0 },
          comments: { count: 0 },
          retweets: { isRetweeted: false, count: 0 }
        },
        // Use the retrieved metadata or the fallback
        postMetadata: metadata || fallbackMetadata 
      };
    });
    
    const hasMoreNewEntries = filteredEntries.length > limitedEntries.length;
    devLog(`🔄 SERVERLESS: Returning ${entriesWithPublicData.length} new entries (has more: ${hasMoreNewEntries})`);
    
    // SERVERLESS DEBUG: Log final result structure
    const result = {
      entries: entriesWithPublicData,
      totalEntries: filteredEntries.length,
      hasMore: hasMoreNewEntries
    };
    
    devLog(`🔄 SERVERLESS: Final getNewEntriesExcludingGuids result:`, {
      entriesCount: result.entries.length,
      totalEntries: result.totalEntries,
      hasMore: result.hasMore,
      sampleEntry: result.entries.length > 0 ? {
        guid: result.entries[0].entry.guid,
        title: result.entries[0].entry.title,
        feedTitle: result.entries[0].entry.feedTitle
      } : null
    });
    
    return result;
  } catch (error) {
    errorLog('❌ Error querying new entries:', error);
    return { entries: [], totalEntries: 0, hasMore: false };
  }
}

// Function to get all existing feeds
async function getAllExistingFeeds(postTitles: string[]): Promise<string[]> {
  try {
    if (!postTitles || postTitles.length === 0) {
      return [];
    }
    
    // Create placeholders for the SQL query
    const placeholders = postTitles.map(() => '?').join(',');
    
    // Query to find which feeds already exist
    const query = `
      SELECT title
      FROM rss_feeds
      WHERE title IN (${placeholders})
    `;
    
    const result = await executeRead(query, [...postTitles]);
    
    // Extract titles of existing feeds
    const existingFeeds = (result.rows as { title: string }[]).map(row => row.title);
    
    devLog(`Found ${existingFeeds.length} existing feeds out of ${postTitles.length} requested`);
    
    return existingFeeds;
  } catch (error) {
    errorLog('Error checking existing feeds:', error);
    return []; // Return empty array on error to be safe
  }
} 