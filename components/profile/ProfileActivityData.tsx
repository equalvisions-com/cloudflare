import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { cache } from "react";

// Import the client component
import { UserActivityFeed } from "./UserActivityFeed";

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

// Cache the initial data fetching
export const getInitialActivityData = cache(async (userId: Id<"users">) => {
  try {
    console.log(`🔍 SERVER: Fetching initial activity data for user: ${userId}`);
    
    // Fetch only the first 30 items, similar to RSS feed implementation
    const result = await fetchQuery(api.userActivity.getUserActivityFeed, { 
      userId,
      skip: 0,
      limit: 30
    }) as { activities: ActivityItem[]; totalCount: number; hasMore: boolean };
    
    console.log(`🚀 SERVER: Fetched ${result.activities.length} initial activities`);
    
    // Extract GUIDs from activities to fetch entry details
    const guids = result.activities.map(activity => activity.entryGuid);
    
    // If we have GUIDs, fetch entry details from PlanetScale
    let entryDetails: Record<string, RSSEntry> = {};
    
    if (guids.length > 0) {
      try {
        console.log(`🔍 SERVER: Fetching entry details for ${guids.length} GUIDs`);
        
        // Fetch entry details from our API route
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/entries/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ guids }),
          cache: 'no-store'
        });
        
        if (!response.ok) {
          console.warn(`⚠️ SERVER: Failed to fetch entry details: ${response.status}`);
        } else {
          const data = await response.json();
          
          // Create a map of guid to entry details
          entryDetails = Object.fromEntries(
            data.entries.map((entry: RSSEntry) => [entry.guid, entry])
          );
          
          console.log(`✅ SERVER: Fetched details for ${Object.keys(entryDetails).length} entries`);
          
          // Extract feed titles to fetch post data from Convex
          const feedTitles = [...new Set(data.entries
            .map((entry: RSSEntry) => entry.feed_title)
            .filter(Boolean) as string[])];
          
          if (feedTitles.length > 0) {
            try {
              console.log(`🔍 SERVER: Fetching post data for ${feedTitles.length} feed titles`);
              
              // Fetch posts from Convex
              const posts = await fetchQuery(api.posts.getByTitles, { titles: feedTitles });
              
              // Create a map of feed title to post
              const feedTitleToPostMap = new Map(
                posts.map((post: ConvexPost) => [post.title, post])
              );
              
              console.log(`✅ SERVER: Fetched ${posts.length} posts from Convex`);
              console.log('Posts from Convex:', posts.map(post => ({
                title: post.title,
                categorySlug: post.categorySlug,
                postSlug: post.postSlug
              })));
              
              // Enrich entry details with post data
              for (const guid in entryDetails) {
                const entry = entryDetails[guid];
                if (entry.feed_title) {
                  const post = feedTitleToPostMap.get(entry.feed_title);
                  console.log('Matching post for feed_title:', entry.feed_title, post ? {
                    title: post.title,
                    categorySlug: post.categorySlug,
                    postSlug: post.postSlug
                  } : 'No matching post');
                  
                  if (post) {
                    entry.post_title = post.title;
                    entry.post_featured_img = post.featuredImg;
                    entry.post_media_type = post.mediaType;
                    entry.category_slug = post.categorySlug;
                    entry.post_slug = post.postSlug;
                    
                    console.log('Updated entry:', {
                      guid,
                      post_title: entry.post_title,
                      category_slug: entry.category_slug,
                      post_slug: entry.post_slug
                    });
                  }
                }
              }
            } catch (error) {
              console.error("⚠️ SERVER: Error fetching post data from Convex:", error);
            }
          }
        }
      } catch (error) {
        // Log the error but continue with empty entry details
        console.error("⚠️ SERVER: Error fetching entry details:", error);
      }
    }
    
    return {
      activities: result.activities,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      entryDetails
    };
  } catch (error) {
    console.error("❌ SERVER: Error fetching initial activity data:", error);
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
  // Fetch initial data - only the first 30 items
  const initialData = await getInitialActivityData(userId);
  
  return (
    <div className="mt-0">
      <UserActivityFeed 
        userId={userId} 
        username={username} 
        initialData={initialData}
        pageSize={30}
      />
    </div>
  );
} 