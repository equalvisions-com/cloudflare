import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";

// Use Edge runtime for this API route
export const runtime = 'edge';

// Import types from UserLikesFeed
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

// Define the route context type with async params
interface RouteContext {
  params: Promise<{ userId: string }>;
}

// Helper function to fetch entry details from PlanetScale
async function fetchEntryDetails(guids: string[], baseUrl: string) {
  if (!guids.length) return { entries: [] };
  
  try {
    console.log(`📡 Fetching ${guids.length} entries from PlanetScale`);
    const startTime = Date.now();
    
    const response = await fetch(`${baseUrl}/api/entries/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ guids }),
      next: { revalidate: 60 }
    });
    
    if (!response.ok) {
      console.error(`❌ API response error: ${response.status}`);
      return { entries: [] };
    }
    
    const data = await response.json();
    console.log(`✅ Fetched ${data.entries?.length || 0} entries in ${Date.now() - startTime}ms`);
    return data;
  } catch (error) {
    console.error("❌ Error fetching entry details:", error);
    return { entries: [] };
  }
}

// Helper function to fetch post data from Convex
async function fetchPostData(feedTitles: string[]) {
  if (!feedTitles.length) return [];
  
  try {
    console.log(`📡 Fetching post data for ${feedTitles.length} feed titles`);
    const postsStartTime = Date.now();
    
    const posts = await fetchQuery(
      api.posts.getByTitles, 
      { titles: feedTitles }
    );
    
    console.log(`✅ Fetched ${posts.length} posts in ${Date.now() - postsStartTime}ms`);
    return posts;
  } catch (error) {
    console.error("❌ Error fetching post data from Convex:", error);
    return [];
  }
}

// Enhanced function to fetch and process entry details with parallel post fetching
async function fetchAndProcessEntryDetails(guids: string[], baseUrl: string) {
  if (!guids.length) return {};
  
  try {
    // Step 1: Fetch entry details
    const data = await fetchEntryDetails(guids, baseUrl);
    
    if (!data.entries || !Array.isArray(data.entries) || data.entries.length === 0) {
      return {};
    }
    
    // Step 2: Create a map of guid to entry details
    const entryDetails = Object.fromEntries(
      data.entries.map((entry: RSSEntry) => [entry.guid, entry])
    );
    
    // Step 3: Extract feed titles to fetch post data from Convex
    const feedTitles = [...new Set(data.entries
      .map((entry: RSSEntry) => entry.feed_title)
      .filter(Boolean) as string[])];
    
    if (feedTitles.length > 0) {
      const posts = await fetchPostData(feedTitles);
      
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
    }
    
    return entryDetails;
  } catch (error) {
    console.error("❌ Error processing entry details:", error);
    return {};
  }
}

export async function GET(
  request: NextRequest, 
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Await the params to get the actual values
    const { userId } = await context.params;
    
    // Validate userId format
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid userId parameter' },
        { status: 400 }
      );
    }

    // Get pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    console.log(`📡 Fetching public likes data for user: ${userId}, skip: ${skip}, limit: ${limit}`);
    const startTime = Date.now();
    
    // Fetch activity data from Convex - this is a PUBLIC query, no auth required
    const result = await fetchQuery(
      api.userActivity.getUserLikes,
      { userId: userId as Id<"users">, skip, limit }
    ) as ActivityResponse;
    
    console.log(`✅ Fetched ${result.activities.length} likes in ${Date.now() - startTime}ms`);

    // Extract GUIDs from activities to fetch entry details
    const guids = result.activities.map((activity: ActivityItem) => activity.entryGuid);
    
    // Fetch and process entry details in a single step
    const entryDetails = await fetchAndProcessEntryDetails(guids, request.nextUrl.origin);

    // ✅ RESTORED: Fetch entry metrics for pagination (same pattern as Activity route)
    // Server provides initial metrics for fast rendering, client hook provides reactive updates
    let entryMetrics: Record<string, InteractionStates> = {};
    if (guids.length > 0) {
      try {
        console.log(`🔍 API: Fetching metrics for ${guids.length} entries`);
        const metricsStartTime = Date.now();
        
        // Get auth token for Convex query
        const token = await convexAuthNextjsToken();
        
        // Fetch metrics from Convex (no comment likes needed for likes feed)
        const metrics = await fetchQuery(
          api.entries.batchGetEntriesMetrics,
          { entryGuids: guids, includeCommentLikes: false },
          { token }
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
      activities: result.activities,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      entryDetails,
      entryMetrics
    });
  } catch (error) {
    console.error("❌ Error fetching public likes data:", error);
    return NextResponse.json(
      { error: "Failed to fetch likes data" },
      { status: 500 }
    );
  }
} 