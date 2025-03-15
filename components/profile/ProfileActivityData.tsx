import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { cache } from "react";

// Import the client component
import { UserProfileTabsWithErrorBoundary } from "./UserProfileTabs";

interface ProfileActivityDataProps {
  userId: Id<"users">;
  username: string;
}

// Types for activity items
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

// Type for RSS entry from PlanetScale
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

// Type for Convex post
type ConvexPost = {
  _id: Id<"posts">;
  title: string;
  featuredImg: string;
  mediaType: string;
  categorySlug: string;
  postSlug: string;
};

// Helper function to fetch entry details from PlanetScale
async function fetchEntryDetails(guids: string[]) {
  if (!guids.length) return {};
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/entries/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ guids }),
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch entry details: ${response.status}`);
      return {};
    }
    
    const data = await response.json();
    return data.entries;
  } catch (error) {
    console.error("Error fetching entry details:", error);
    return {};
  }
}

// Helper function to fetch post data from Convex
async function fetchPostData(feedTitles: string[]) {
  if (!feedTitles.length) return [];
  
  try {
    console.log(`[Convex] Fetching post data for ${feedTitles.length} feed titles`);
    const postsStartTime = Date.now();
    
    const posts = await fetchQuery(api.posts.getByTitles, { titles: feedTitles });
    
    console.log(`[Convex] Fetched ${posts.length} posts in ${Date.now() - postsStartTime}ms`);
    return posts;
  } catch (error) {
    console.error("Error fetching post data from Convex:", error);
    return [];
  }
}

// Enhanced function to fetch and process entry details with parallel post fetching
async function fetchAndProcessEntryDetails(guids: string[]) {
  if (!guids.length) return {};
  
  try {
    // Step 1: Fetch entry details
    const entries = await fetchEntryDetails(guids);
    
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return {};
    }
    
    // Step 2: Create a map of guid to entry details
    const entryDetails = Object.fromEntries(
      entries.map((entry: RSSEntry) => [entry.guid, entry])
    );
    
    // Step 3: Extract feed titles to fetch post data from Convex
    const feedTitles = [...new Set(entries
      .map((entry: RSSEntry) => entry.feed_title)
      .filter(Boolean) as string[])];
    
    if (feedTitles.length > 0) {
      // Step 4: Fetch posts from Convex
      const posts = await fetchPostData(feedTitles);
      
      // Step 5: Create a map of feed title to post
      const feedTitleToPostMap = new Map(
        posts.map((post: ConvexPost) => [post.title, post])
      );
      
      // Step 6: Enrich entry details with post data
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
    }
    
    return entryDetails;
  } catch (error) {
    console.error("Error processing entry details:", error);
    return {};
  }
}

// Cache the initial data fetching
export const getInitialActivityData = cache(async (userId: Id<"users">) => {
  try {
    console.log(`[Convex] Fetching activity data (comments and retweets) for user: ${userId}`);
    const startTime = Date.now();
    
    // Fetch only the first 30 items, similar to RSS feed implementation
    const result = await fetchQuery(api.userActivity.getUserActivityFeed, { 
      userId,
      skip: 0,
      limit: 30
    }) as { activities: ActivityItem[]; totalCount: number; hasMore: boolean };
    
    console.log(`[Convex] Fetched ${result.activities.length} activities (comments and retweets) in ${Date.now() - startTime}ms`);
    
    // Extract GUIDs from activities to fetch entry details
    const guids = result.activities.map(activity => activity.entryGuid);
    
    // Fetch and process entry details in a single step
    const entryDetails = await fetchAndProcessEntryDetails(guids);
    
    return {
      activities: result.activities,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      entryDetails
    };
  } catch (error) {
    console.error("Error fetching initial activity data:", error);
    // Return empty data instead of null to avoid loading state
    return {
      activities: [],
      totalCount: 0,
      hasMore: false,
      entryDetails: {}
    };
  }
});

// Cache the initial likes data fetching
export const getInitialLikesData = cache(async (userId: Id<"users">) => {
  try {
    console.log(`[Convex] Fetching likes data for user: ${userId}`);
    const startTime = Date.now();
    
    // Fetch only the first 30 likes directly using the dedicated query
    const result = await fetchQuery(api.userActivity.getUserLikes, { 
      userId,
      skip: 0,
      limit: 30
    }) as { activities: ActivityItem[]; totalCount: number; hasMore: boolean };
    
    console.log(`[Convex] Fetched ${result.activities.length} likes in ${Date.now() - startTime}ms`);
    
    // Extract GUIDs from activities to fetch entry details
    const guids = result.activities.map(activity => activity.entryGuid);
    
    // Fetch and process entry details in a single step
    const entryDetails = await fetchAndProcessEntryDetails(guids);
    
    return {
      activities: result.activities,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      entryDetails
    };
  } catch (error) {
    console.error("Error fetching initial likes data:", error);
    // Return empty data instead of null to avoid loading state
    return {
      activities: [],
      totalCount: 0,
      hasMore: false,
      entryDetails: {}
    };
  }
});

/**
 * Server component that fetches initial activity data and renders the client component
 */
export async function ProfileActivityData({ userId, username }: ProfileActivityDataProps) {
  // Fetch only activity data initially - likes will be loaded on demand
  const activityData = await getInitialActivityData(userId);
  
  return (
    <div className="mt-0">
      <UserProfileTabsWithErrorBoundary 
        userId={userId} 
        username={username} 
        activityData={activityData}
        likesData={null} // Pass null to indicate likes should be loaded on demand
        pageSize={30}
      />
    </div>
  );
} 