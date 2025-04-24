import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";

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
}

interface ActivityResponse {
  activities: ActivityItem[];
  totalCount: number;
  hasMore: boolean;
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
async function fetchPostData(feedTitles: string[], token: string | null | undefined) {
  if (!feedTitles.length) return [];
  
  try {
    console.log(`📡 Fetching post data for ${feedTitles.length} feed titles`);
    const postsStartTime = Date.now();
    
    const posts = await fetchQuery(
      api.posts.getByTitles, 
      { titles: feedTitles },
      token ? { token } : undefined
    );
    
    console.log(`✅ Fetched ${posts.length} posts in ${Date.now() - postsStartTime}ms`);
    return posts;
  } catch (error) {
    console.error("❌ Error fetching post data from Convex:", error);
    return [];
  }
}

// Enhanced function to fetch and process entry details with parallel post fetching
async function fetchAndProcessEntryDetails(guids: string[], baseUrl: string, token: string | null | undefined) {
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
      // Step 4: Fetch posts from Convex
      const posts = await fetchPostData(feedTitles, token);
      
      // Step 5: Create a map of feed title to post
      const feedTitleToPostMap = new Map(
        posts.map((post: any) => [post.title, post])
      );
      
      // Step 6: Enrich entry details with post data
      for (const guid in entryDetails) {
        const entry = entryDetails[guid];
        if (entry.feed_title) {
          const post = feedTitleToPostMap.get(entry.feed_title);
          
          if (post) {
            // Get the featured image from the correct field
            const featuredImg = post.featuredImage || post.featuredImg;
            
            // Get the slug from the correct field
            const slug = post.slug || post.postSlug;
            
            // Update entry with post metadata
            entry.post_title = post.title;
            entry.post_featured_img = featuredImg;
            entry.post_media_type = post.mediaType;
            entry.category_slug = post.categorySlug;
            entry.post_slug = slug;
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userIdStr = searchParams.get("userId");
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    if (!userIdStr) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    // Convert string to Convex ID
    const userId = userIdStr as Id<"users">;

    // Get auth token for authenticated requests
    const token = await convexAuthNextjsToken().catch((error) => {
      console.error("❌ Failed to get auth token:", error);
      return null;
    });

    console.log(`📡 Fetching likes data for user: ${userId}, skip: ${skip}, limit: ${limit}`);
    const startTime = Date.now();
    
    // Fetch activity data from Convex with a larger limit since we'll filter
    const result = await fetchQuery(
      api.userActivity.getUserLikes,
      { userId, skip, limit },
      token ? { token } : undefined
    ) as ActivityResponse;
    
    console.log(`✅ Fetched ${result.activities.length} likes in ${Date.now() - startTime}ms`);

    // Extract GUIDs from activities to fetch entry details
    const guids = result.activities.map((activity: ActivityItem) => activity.entryGuid);
    
    // Fetch and process entry details in a single step
    const entryDetails = await fetchAndProcessEntryDetails(guids, request.nextUrl.origin, token);
    
    // Fetch entry metrics for all guids
    let entryMetrics: Record<string, InteractionStates> = {};
    if (guids.length > 0) {
      try {
        console.log(`📡 Fetching metrics for ${guids.length} entries`);
        const metricsStartTime = Date.now();
        
        // Fetch metrics from Convex
        const metrics = await fetchQuery(
          api.entries.batchGetEntriesMetrics,
          { entryGuids: guids },
          token ? { token } : undefined
        );
        
        // Create a map of guid to metrics
        entryMetrics = Object.fromEntries(
          guids.map((guid, index) => [guid, metrics[index] as InteractionStates])
        );
        
        console.log(`✅ Fetched metrics in ${Date.now() - metricsStartTime}ms`);
      } catch (error) {
        console.error("❌ Error fetching entry metrics:", error);
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
    console.error("❌ Error fetching likes data:", error);
    return NextResponse.json(
      { error: "Failed to fetch likes data" },
      { status: 500 }
    );
  }
} 