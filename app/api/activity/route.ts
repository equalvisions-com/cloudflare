import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";

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
};

interface ActivityResponse {
  activities: ActivityItem[];
  totalCount: number;
  hasMore: boolean;
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
      console.error("Failed to get auth token:", error);
      return null;
    });

    // Fetch paginated activity data from Convex
    const result = await fetchQuery(
      api.userActivity.getUserActivityFeed,
      { userId, skip, limit },
      token ? { token } : undefined
    ) as ActivityResponse;

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

    return NextResponse.json({
      ...result,
      entryDetails
    });
  } catch (error) {
    console.error("Error fetching activity data:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity data" },
      { status: 500 }
    );
  }
} 