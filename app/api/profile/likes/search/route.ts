import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";
import { validateHeaders } from '@/lib/headers';
import type { APIActivityItem, APIRSSEntry } from "@/lib/types";
import { executeRead } from "@/lib/database";

// Use Edge runtime for this API route
export const runtime = 'edge';

interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
  bookmarks: { isBookmarked: boolean };
}

interface LikesResponse {
  activities: APIActivityItem[];
  totalCount: number;
  hasMore: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // Get userId, currentUserId, query and pagination parameters from request body
    const body = await request.json();
    const { userId, currentUserId, query, skip = 0, limit = 30 } = body;
    
    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid userId parameter' },
        { status: 400 }
      );
    }

    // Query is required for search
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Try to get authentication token (for authenticated queries)
    const token = await convexAuthNextjsToken();

    // Use the userId directly from the request body
    const targetUserId = userId as Id<"users">;
    
    // Use currentUserId from sidebar context if provided, otherwise fallback to targetUserId
    const effectiveCurrentUserId = currentUserId ? currentUserId as Id<"users"> : targetUserId;

    // Step 1: Fetch user likes from Convex with pagination
    // Get extra items to enable +1 pagination pattern for search
    const fetchLimit = Math.min(1000, (skip + limit) * 2); // Fetch enough for search and pagination
    const result = await fetchQuery(
      api.userActivity.getUserLikes,
      { 
        userId: targetUserId, 
        skip: 0, 
        limit: fetchLimit 
      },
      token ? { token } : undefined
    ) as LikesResponse;

    if (!result.activities.length) {
      return NextResponse.json({
        activities: [],
        totalCount: 0,
        hasMore: false,
        entryDetails: {},
        interactionStates: {}
      });
    }

    // Extract GUIDs from activities to search
    const guids = result.activities.map((activity: APIActivityItem) => activity.entryGuid);
    
    // Step 2: Search entries in PlanetScale that match the query
    let matchingEntryDetails: Record<string, APIRSSEntry> = {};
    let matchingGuids: string[] = [];

    if (guids.length > 0) {
      try {
        // Create placeholders for the SQL query
        const placeholders = guids.map(() => '?').join(',');
        const searchTerm = `%${query}%`;
        
        const searchQuery = `
          SELECT e.*, f.title as feed_title, f.feed_url, f.media_type as mediaType
          FROM rss_entries e
          LEFT JOIN rss_feeds f ON e.feed_id = f.id
          WHERE e.guid IN (${placeholders})
          AND (
            e.title LIKE ?
            OR e.description LIKE ?
            OR f.title LIKE ?
          )
        `;
        
        const searchResult = await executeRead(
          searchQuery, 
          [...guids, searchTerm, searchTerm, searchTerm]
        );
        
        // Map entries by GUID
        const rows = searchResult.rows as any[];
        matchingEntryDetails = Object.fromEntries(
          rows.map(row => [row.guid, {
            id: row.id,
            feed_id: row.feed_id,
            guid: row.guid,
            title: row.title,
            link: row.link,
            description: row.description,
            pub_date: row.pub_date,
            image: row.image,
            feed_title: row.feed_title,
            feed_url: row.feed_url,
            mediaType: row.mediaType
          }])
        );
        
        matchingGuids = Object.keys(matchingEntryDetails);
      } catch (error) {
        console.error("Error searching liked entries:", error);
      }
    }

    // Step 3: Filter activities to only those that matched the search
    const allFilteredActivities = result.activities.filter(
      activity => matchingGuids.includes(activity.entryGuid)
    );
    
    // Step 3a: Apply +1 pagination pattern
    const startIndex = skip;
    const endIndex = skip + limit + 1; // Get one extra to check if there are more
    const paginatedActivities = allFilteredActivities.slice(startIndex, endIndex);
    
    // Check if there are more results
    const hasMore = paginatedActivities.length > limit;
    
    // Return only the requested number of items (remove the +1 extra)
    const filteredActivities = paginatedActivities.slice(0, limit);

    // Step 4: Enrich with post data from Convex
    try {
      if (Object.keys(matchingEntryDetails).length > 0) {
        const feedTitles = [...new Set(Object.values(matchingEntryDetails)
          .map(entry => entry.feed_title)
          .filter(Boolean) as string[])];
        
        if (feedTitles.length > 0) {
          const posts = await fetchQuery(api.posts.getByTitles, { titles: feedTitles });
          
          if (posts.length > 0) {
            const feedTitleToPostMap = new Map(
              posts.map((post: any) => [post.title, post])
            );
            
            // Enrich entry details with post data
            for (const guid in matchingEntryDetails) {
              const entry = matchingEntryDetails[guid];
              if (entry && entry.feed_title) {
                const post = feedTitleToPostMap.get(entry.feed_title);
                
                if (post) {
                  entry.post_title = post.title;
                  entry.post_featured_img = post.featuredImg;
                  entry.post_media_type = post.mediaType;
                  entry.category_slug = post.categorySlug;
                  entry.post_slug = post.postSlug;
                  entry.verified = post.verified;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching post data:", error);
    }
    
    // Step 5: Get interaction states for matched entries
    let interactionStates: Record<string, InteractionStates> = {};
    try {
      if (matchingGuids.length > 0) {
        const metrics = await fetchQuery(api.entries.batchGetEntriesMetrics, { 
          entryGuids: matchingGuids,
          includeCommentLikes: true
        });
        
        // Create interaction states map
        matchingGuids.forEach((guid, index) => {
          if (metrics[index]) {
            interactionStates[guid] = metrics[index];
          }
        });
      }
    } catch (error) {
      console.error("Error fetching entry metrics:", error);
    }
    
    return NextResponse.json({
      activities: filteredActivities,
      totalCount: allFilteredActivities.length, // Total count of all search results
      hasMore, // Proper hasMore based on +1 pagination pattern
      entryDetails: matchingEntryDetails,
      entryMetrics: interactionStates // Use entryMetrics field name for consistency
    });
  } catch (error) {
    console.error('Error searching user likes:', error);
    return NextResponse.json(
      { error: 'Failed to search user likes' },
      { status: 500 }
    );
  }
}