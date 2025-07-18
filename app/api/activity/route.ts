import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";
import { validateHeaders } from '@/lib/headers';

// Use Edge runtime for this API route
export const runtime = 'edge';

// Import types from UserActivityFeed
type ActivityItem = {
  type: "like" | "comment" | "retweet";
  timestamp: number;
  entryGuid: string;
  feedUrl: string;
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  _id: string;
};

type RSSEntry = {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  feed_title?: string;
  feed_url?: string;
  mediaType?: string;
  // Additional fields from Convex posts
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
  verified?: boolean;
};

// Define the shape of interaction states for batch metrics
interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
  bookmarks: { isBookmarked: boolean };
}

interface ActivityResponse {
  activities: ActivityItem[];
  totalCount: number;
  hasMore: boolean;
}

export async function POST(request: NextRequest) {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // Get userId, currentUserId and pagination parameters from request body
    const body = await request.json();
    const { userId, currentUserId, skip = 0, limit = 30 } = body;

    // UserId is required - this endpoint works by userId for efficiency
    if (!userId) {
      return NextResponse.json(
        { error: 'UserId parameter is required' },
        { status: 400 }
      );
    }

    // Try to get authentication token (for authenticated queries)
    const token = await convexAuthNextjsToken();

    // Use the provided userId directly (no lookup needed)
    const targetUserId = userId as Id<"users">;
    
    // Use currentUserId from sidebar context if provided, otherwise fallback to targetUserId
    const effectiveCurrentUserId = currentUserId ? currentUserId as Id<"users"> : targetUserId;

    // Fetch paginated activity data from Convex
    const result = await fetchQuery(
      api.userActivity.getUserActivityFeed,
      { 
        userId: targetUserId, 
        currentUserId: effectiveCurrentUserId, // Use provided currentUserId for interaction states
        skip, 
        limit 
      },
      token ? { token } : undefined // Use token if available, otherwise public access
    ) as ActivityResponse & {
      commentReplies?: Record<string, any[]>;
      commentLikes?: Record<string, { commentId: string; isLiked: boolean; count: number; }>;
    };

    // Extract GUIDs from activities to fetch entry details
    const guids = result.activities.map((activity: ActivityItem) => activity.entryGuid);
    
    // If we have GUIDs, fetch entry details from PlanetScale
    let entryDetails: Record<string, RSSEntry> = {};
    
    if (guids.length > 0) {
      try {
        console.log(`🔍 API: Fetching entry details for ${guids.length} GUIDs`);
        
        // Fetch entry details from our API route
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/entries/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ guids }),
        });
        
        if (!response.ok) {
          console.error(`Failed to fetch entry details: ${response.status}`);
        } else {
          const data = await response.json();
          
          // Create a map of guid to entry details
          entryDetails = Object.fromEntries(
            data.entries.map((entry: RSSEntry) => [entry.guid, entry])
          );
          
          console.log(`✅ API: Fetched details for ${Object.keys(entryDetails).length} entries`);
          
          // Extract feed titles to fetch post data from Convex
          const feedTitles = [...new Set(data.entries
            .map((entry: RSSEntry) => entry.feed_title)
            .filter(Boolean) as string[])];
          
          if (feedTitles.length > 0) {
            try {
              console.log(`🔍 API: Fetching post data for ${feedTitles.length} feed titles`);
              
              // Fetch posts from Convex
              const posts = await fetchQuery(
                api.posts.getByTitles, 
                { titles: feedTitles },
                token ? { token } : undefined
              );
              
              console.log(`✅ API: Fetched ${posts.length} posts from Convex`);
              
              // Create a map of feed title to post data
              const feedTitleToPostMap = new Map(
                posts.map(post => [post.title, post])
              );
              
              // Enrich entry details with post data
              for (const guid in entryDetails) {
                const entry = entryDetails[guid];
                if (entry.feed_title) {
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
            } catch (error) {
              console.error("⚠️ API: Error fetching post data from Convex:", error);
            }
          }
        }
      } catch (error) {
        // Log the error but continue with empty entry details
        console.error("⚠️ API: Error fetching entry details:", error);
      }
    }
    
    // Fetch entry metrics for pagination (same pattern as RSS/Featured feeds)
    // Server provides initial metrics for fast rendering, client hook provides reactive updates
    let entryMetrics: Record<string, InteractionStates> = {};
    if (guids.length > 0) {
      try {
        console.log(`🔍 API: Fetching metrics for ${guids.length} entries`);
        const metricsStartTime = Date.now();
        
        // Fetch metrics from Convex with comment likes for activity feed
        // Use currentUserId from sidebar context if provided, otherwise use authenticated token
        const metrics = await fetchQuery(
          api.entries.batchGetEntriesMetrics,
          { entryGuids: guids, includeCommentLikes: true },
          token ? { token } : undefined
        );
        
        // Create a map of guid to metrics
        entryMetrics = Object.fromEntries(
          guids.map((guid, index) => [guid, metrics[index] as InteractionStates])
        );
        
        console.log(`✅ API: Fetched metrics in ${Date.now() - metricsStartTime}ms`);
      } catch (error) {
        console.error("⚠️ API: Error fetching entry metrics:", error);
      }
    }

    return NextResponse.json({
      ...result,
      entryDetails,
      entryMetrics,
      // Include comment likes data from the updated getUserActivityFeed query
      commentLikes: result.commentLikes || {}
    });
  } catch (error) {
    console.error("Error fetching activity data:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity data" },
      { status: 500 }
    );
  }
} 