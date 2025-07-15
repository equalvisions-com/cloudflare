import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";

// Use Edge runtime for this API route
export const runtime = 'edge';

// Import types
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
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
  verified?: boolean;
};

interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
  bookmarks: { isBookmarked: boolean };
}

interface LikesResponse {
  activities: ActivityItem[];
  totalCount: number;
  hasMore: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get userId, currentUserId and pagination parameters from request body
    const body = await request.json();
    const { userId, currentUserId, skip = 0, limit = 30 } = body;
    
    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid userId parameter' },
        { status: 400 }
      );
    }

    // Try to get authentication token (for authenticated queries)
    const token = await convexAuthNextjsToken();

    // Use the userId directly from the request body
    const targetUserId = userId as Id<"users">;
    
    // Use currentUserId from sidebar context if provided, otherwise fallback to targetUserId
    const effectiveCurrentUserId = currentUserId ? currentUserId as Id<"users"> : targetUserId;

    // Fetch paginated likes data from Convex  
    const result = await fetchQuery(
      api.userActivity.getUserLikes,
      { 
        userId: targetUserId, 
        skip, 
        limit 
      },
      token ? { token } : undefined // Use token if available, otherwise public access
    ) as LikesResponse;

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
    let entryMetrics: Record<string, InteractionStates> = {};
    if (guids.length > 0) {
      try {
        console.log(`🔍 API: Fetching metrics for ${guids.length} entries`);
        const metricsStartTime = Date.now();
        
        // Fetch metrics from Convex
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
      entryMetrics
    });
  } catch (error) {
    console.error("Error fetching likes data:", error);
    return NextResponse.json(
      { error: "Failed to fetch likes data" },
      { status: 500 }
    );
  }
} 