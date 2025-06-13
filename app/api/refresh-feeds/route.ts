import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { executeRead } from '@/lib/database';
import { checkAndRefreshFeeds } from '@/lib/rss.server';

// Add Edge Runtime configuration
export const runtime = 'edge';
// Mark as dynamic to ensure fresh data
export const dynamic = 'force-dynamic';
// Disable revalidation
export const revalidate = 0;

// Helper function to log only in development
const devLog = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

// Helper function to log errors
const errorLog = (message: string, error?: unknown) => {
  if (error) {
    console.error(message, error);
  } else {
    console.error(message);
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { postTitles, feedUrls, mediaTypes, existingGuids = [], newestEntryDate } = body;
    
    devLog('📥 API: Received refresh request with', {
      postTitlesCount: postTitles?.length || 0,
      feedUrlsCount: feedUrls?.length || 0,
      mediaTypesCount: mediaTypes?.length || 0,
      existingGuidsCount: existingGuids?.length || 0,
      newestEntryDate
    });

    // Validate input
    if (!postTitles || !Array.isArray(postTitles) || postTitles.length === 0) {
      return Response.json({ success: false, error: 'Invalid postTitles - must be non-empty array' }, { status: 400 });
    }

    if (!feedUrls || !Array.isArray(feedUrls) || feedUrls.length === 0) {
      return Response.json({ success: false, error: 'Invalid feedUrls - must be non-empty array' }, { status: 400 });
    }

    if (postTitles.length !== feedUrls.length) {
      return Response.json({ success: false, error: 'postTitles and feedUrls arrays must have the same length' }, { status: 400 });
    }

    // Normalize arrays to ensure consistent data
    const normalizedPostTitles = postTitles.map((title: string) => String(title).trim());
    const normalizedFeedUrls = feedUrls.map((url: string) => String(url).trim());
    const normalizedMediaTypesArray = mediaTypes ? mediaTypes.map((type: string) => String(type).trim()) : [];

    // Check which feeds need refreshing (older than 4 hours)
    const staleFeedTitles = await checkFeedsNeedingRefresh(normalizedPostTitles);
    
    if (staleFeedTitles.length === 0) {
      devLog('✅ API: All feeds are up to date, no refresh needed');
      return Response.json({ 
        success: true, 
        refreshedAny: false,
        entries: [],
        newEntriesCount: 0,
        totalEntries: 0,
        postTitles: normalizedPostTitles,
        refreshTimestamp: new Date().toISOString()
      });
    }

    devLog(`Found ${staleFeedTitles.length} stale feeds that need refreshing:`, staleFeedTitles);
    
    let refreshedAny = false;
    
    // Check if any feeds are new (don't exist yet)
    const allExistingFeeds = await getAllExistingFeeds(normalizedPostTitles);
    const newFeeds = normalizedPostTitles.filter((title: string) => !allExistingFeeds.includes(title));
    
    if (newFeeds.length > 0) {
      devLog(`🆕 API: Found ${newFeeds.length} new feeds to create: ${newFeeds.join(', ')}`);
      refreshedAny = true;
    }
    
    // Only consider it a refresh if we have new feeds or some feeds need refreshing
    if (staleFeedTitles.length > 0 || newFeeds.length > 0) {
      // Always call checkAndRefreshFeeds to both refresh existing feeds AND create new ones
      devLog(`🔄 API: Checking and refreshing feeds, will create missing ones if needed`);
      
      // Convert array to all strings (replacing null with undefined) to match function signature
      const stringMediaTypes = normalizedMediaTypesArray.map((mt: any) => mt === null ? undefined : mt) as string[] | undefined;
      
      await checkAndRefreshFeeds(normalizedPostTitles, normalizedFeedUrls, stringMediaTypes);
      refreshedAny = true;
    } else {
      devLog('⏭️ API: Skipping refresh - no feeds need refreshing and no new feeds');
    }
    
    // Get new entries that were inserted during this refresh cycle
    let newEntries: any = { entries: [], totalEntries: 0, hasMore: false };
    
    if (refreshedAny) {
      // Get new entries excluding existing ones
      newEntries = await getNewEntriesFromRefresh(normalizedPostTitles, existingGuids, newestEntryDate);
      
      if (newEntries.entries.length > 0) {
        devLog(`✅ API: Found ${newEntries.entries.length} new entries from refresh`);
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
      totalEntries: refreshedAny ? newEntries.totalEntries : 0,
      postTitles: normalizedPostTitles,
      refreshTimestamp: new Date().toISOString()
    };
    
    devLog('🔄 SERVERLESS: Final API response structure:', {
      success: responseData.success,
      refreshedAny: responseData.refreshedAny,
      entriesCount: responseData.entries.length,
      newEntriesCount: responseData.newEntriesCount,
      totalEntries: responseData.totalEntries,
      sampleEntry: responseData.entries.length > 0 ? {
        guid: responseData.entries[0].entry.guid,
        title: responseData.entries[0].entry.title,
        feedTitle: responseData.entries[0].entry.feedTitle
      } : null
    });
    
    return Response.json(responseData);
  } catch (error) {
    errorLog('❌ API: Error in refresh-feeds:', error);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to check which feeds need refreshing
async function checkFeedsNeedingRefresh(postTitles: string[]): Promise<string[]> {
  try {
    if (!postTitles || postTitles.length === 0) {
      return [];
    }
    
    // Create placeholders for the SQL query
    const placeholders = postTitles.map(() => '?').join(',');
    
    // Query to find feeds that need refreshing (older than 4 hours)
    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    const query = `
      SELECT title
      FROM rss_feeds
      WHERE title IN (${placeholders}) AND last_fetched < ?
    `;
    
    const result = await executeRead(query, [...postTitles, fourHoursAgo]);
    
    // Extract titles of feeds that need refreshing
    const staleFeedTitles = (result.rows as { title: string }[]).map(row => row.title);
    
    devLog(`Found ${staleFeedTitles.length} feeds needing refresh out of ${postTitles.length} requested`);
    
    return staleFeedTitles;
  } catch (error) {
    errorLog('Error checking feeds needing refresh:', error);
    return []; // Return empty array on error to be safe
  }
}

// Helper function to get all existing feeds
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
    
    // Extract titles of feeds already existing
    const existingFeeds = (result.rows as { title: string }[]).map(row => row.title);
    
    devLog(`Found ${existingFeeds.length} existing feeds:`, existingFeeds);
    
    return existingFeeds;
  } catch (error) {
    errorLog('Error querying existing feeds:', error);
    return []; // Return empty array on error to be safe
  }
}

// Helper function to get new entries from refresh
async function getNewEntriesFromRefresh(
  postTitles: string[], 
  existingGuids: string[],
  newestEntryDate?: string
) {
  try {
    if (!postTitles || postTitles.length === 0) {
      return { entries: [], totalEntries: 0, hasMore: false };
    }
    
    // Create a set of existing GUIDs for efficient lookup
    const existingGuidsSet = new Set(existingGuids);
    
    // CRITICAL FIX: Instead of getting ALL entries from the database,
    // we need to get only entries that were inserted in the last few minutes
    // This ensures we only return entries that were actually inserted during this refresh cycle
    
    const titlePlaceholders = postTitles.map(() => '?').join(',');
    
    // Get entries that were created in the last 5 minutes (during this refresh cycle)
    // This is much more accurate than trying to filter all historical entries
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    
    const entriesQuery = `
      SELECT e.*, f.title as feed_title, f.feed_url
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE f.title IN (${titlePlaceholders})
        AND e.created_at >= ?
      ORDER BY e.pub_date DESC
    `;
    
    const entriesResult = await executeRead(entriesQuery, [...postTitles, fiveMinutesAgo]);
    const entries = entriesResult.rows as any[];
    
    devLog(`Retrieved ${entries.length} recently created entries (created in last 5 minutes) for these feeds`);
    
    // Filter out entries we've already seen (by GUID) - these are the truly new ones
    const uniqueEntries = entries.filter(entry => !existingGuidsSet.has(entry.guid));
    
    devLog(`Filtered to ${uniqueEntries.length} truly new entries after excluding ${existingGuids.length} existing GUIDs`);
    
    let filteredEntries = uniqueEntries;
    
    // Apply chronological filter ONLY if we have a valid newestEntryDate
    if (newestEntryDate && filteredEntries.length > 0) {
      try {
        // Parse the client's newest entry date
        const clientNewestDate = new Date(newestEntryDate);
        
        // Validate the date
        if (isNaN(clientNewestDate.getTime())) {
          devLog(`⚠️ Invalid newestEntryDate: ${newestEntryDate}, skipping chronological filter`);
        } else {
          const clientNewestTimestamp = clientNewestDate.getTime();
          
          // Debug: Log the filtering criteria
          devLog(`🔄 SERVERLESS: Chronological filter - client newest entry:`, {
            newestEntryDate,
            clientNewestTimestamp,
            sampleEntryDates: filteredEntries.slice(0, 3).map(e => ({
              title: e.title,
              pubDate: e.pub_date,
              timestamp: new Date(e.pub_date).getTime()
            }))
          });
          
          // Filter entries to only include those NEWER than the client's newest entry
          // Use EXACT comparison - no buffers or timezone adjustments
          const chronologicalEntries = filteredEntries.filter(entry => {
            try {
              // Parse the entry's publication date
              const entryDate = new Date(entry.pub_date);
              
              // Skip invalid dates
              if (isNaN(entryDate.getTime())) {
                devLog(`⚠️ Invalid entry date: ${entry.pub_date} for entry: ${entry.title}`);
                return false;
              }
              
              const entryTimestamp = entryDate.getTime();
              
              // EXACT comparison: only include entries that are strictly newer
              return entryTimestamp > clientNewestTimestamp;
            } catch (e) {
              devLog(`⚠️ Error parsing entry date ${entry.pub_date}: ${e}`);
              return false;
            }
          });
          
          devLog(`🔄 SERVERLESS: Chronological filter: ${filteredEntries.length} -> ${chronologicalEntries.length} entries (showing only entries newer than ${newestEntryDate})`);
          
          // Log which entries were filtered out for debugging
          if (chronologicalEntries.length < filteredEntries.length) {
            const filteredOut = filteredEntries.length - chronologicalEntries.length;
            devLog(`🔄 SERVERLESS: Filtered out ${filteredOut} entries that were not newer than client's newest entry`);
            
            // Show a sample of filtered out entries for debugging
            const sampleFilteredOut = filteredEntries
              .filter(entry => {
                const entryTimestamp = new Date(entry.pub_date).getTime();
                return entryTimestamp <= clientNewestTimestamp;
              })
              .slice(0, 3)
              .map(e => ({
                title: e.title,
                pubDate: e.pub_date,
                timestamp: new Date(e.pub_date).getTime(),
                isOlderThanClient: new Date(e.pub_date).getTime() <= clientNewestTimestamp
              }));
            
            devLog(`🔄 SERVERLESS: Sample filtered out entries:`, sampleFilteredOut);
          }
          
          filteredEntries = chronologicalEntries;
        }
      } catch (e) {
        devLog(`⚠️ Error in chronological filtering: ${e}`);
        // Continue without chronological filtering if there's an error
      }
    } else {
      devLog(`🔄 SERVERLESS: Skipping chronological filter - newestEntryDate: ${newestEntryDate}, entries: ${filteredEntries.length}`);
    }
    
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
    
    // Get unique entry guids for batch query
    const guids = mappedEntries.map(entry => entry.guid);
    
    // Batch fetch entry data for all entries at once
    const entryData = await fetchQuery(
      api.entries.batchGetEntryData,
      { entryGuids: guids },
      { token }
    );
    
    // Fetch post metadata
    const feedUrls = [...new Set(mappedEntries.map(entry => entry.feedUrl))];
    const postMetadata = await fetchQuery(
      api.posts.getPostsByFeedUrls,
      { feedUrls },
      { token }
    );
    
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
      const feedUrl = entry.feedUrl;
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
        postMetadata: metadata || fallbackMetadata 
      };
    });
    
    const hasMoreNewEntries = filteredEntries.length > limitedEntries.length;
    
    const result = {
      entries: entriesWithPublicData,
      totalEntries: filteredEntries.length,
      hasMore: hasMoreNewEntries
    };
    
    devLog(`🔄 SERVERLESS: Final result:`, {
      entriesCount: result.entries.length,
      totalEntries: result.totalEntries,
      hasMore: result.hasMore
    });
    
    return result;
  } catch (error) {
    errorLog('❌ Error querying new entries:', error);
    return { entries: [], totalEntries: 0, hasMore: false };
  }
} 