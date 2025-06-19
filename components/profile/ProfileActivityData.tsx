import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { cache } from "react";

// Import the client component
import { UserProfileTabsWithErrorBoundary } from "./UserProfileTabs";

interface ProfileActivityDataProps {
  userId: Id<"users">;
  username: string;
  name?: string;
  profileImage?: string | null;
}

// Types for activity items - must match UserProfileTabs.tsx exactly
type ActivityItem = {
  type: "comment" | "retweet";
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
  verified?: boolean;
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

// Cache the initial data fetching using the new batch query
export const getInitialActivityData = cache(async (userId: Id<"users">) => {
  try {
    const startTime = Date.now();
    
    // Use the new optimized batch query
    const result = await fetchQuery(api.users.getProfileActivityData, { 
      userId,
      limit: 30
    });
    
    // For now, we'll need to handle any external API calls for entry details
    // since our batch query can't directly access external APIs
    const activities = result.activities.activities;
    const guids = activities.map((activity: { entryGuid: string }) => activity.entryGuid);
    
    // Get Convex post metadata from the batch query
    let postMetadata: Record<string, any> = result.entryDetails as Record<string, any> || {};
    
    // Fetch ALL RSS entries from PlanetScale to get the full entry details
    // We'll merge the Convex post metadata with this data
    let entryDetails: Record<string, RSSEntry> = {};
    
    if (guids.length > 0) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/entries/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guids }),
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.entries && Array.isArray(data.entries)) {
            // First map entries to their guids
            entryDetails = Object.fromEntries(
              data.entries.map((entry: RSSEntry) => [entry.guid, entry])
            );
            
            // Now enrich each entry with post metadata
            for (const guid in entryDetails) {
              if (postMetadata[guid]) {
                // Extract post metadata
                const metadata = {
                  post_title: postMetadata[guid].post_title,
                  post_featured_img: postMetadata[guid].post_featured_img,
                  post_media_type: postMetadata[guid].post_media_type,
                  category_slug: postMetadata[guid].category_slug,
                  post_slug: postMetadata[guid].post_slug,
                  verified: postMetadata[guid].verified,
                };
                
                // Only keep metadata fields that actually have values
                const cleanedMetadata = Object.fromEntries(
                  Object.entries(metadata).filter(([_, value]) => !!value)
                );
                
                if (Object.keys(cleanedMetadata).length > 0) {
                  // Merge the RSS entry with the post metadata
                  entryDetails[guid] = {
                    ...entryDetails[guid],
                    ...cleanedMetadata
                  };
                }
              }
            }
          }
        }
      } catch (error) {
        // Error handling for PlanetScale API call
      }
    }
    
    // As a backup, try to enrich entries with post data if we have feed_title available
    // This is for cases where the Convex batch enrichment failed
    const feedTitles = [...new Set(
      Object.values(entryDetails)
        .map((entry: any) => entry?.feed_title)
        .filter(Boolean)
    )];
    
    if (feedTitles.length > 0) {
      try {
        const postsStartTime = Date.now();
        
        const posts = await fetchQuery(api.posts.getByTitles, { titles: feedTitles });
        
        if (posts.length > 0) {
          // Create a map of feed title to post
          const feedTitleToPostMap = new Map(
            posts.map((post: any) => [post.title, post])
          );
          
          // Enrich entry details with post data
          for (const guid in entryDetails) {
            const entry = entryDetails[guid];
            // Only enrich entries that don't already have post metadata
            if (entry && entry.feed_title && !entry.post_slug) {
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
      } catch (error) {
        // Error handling for Convex post data fetch
      }
    }
    
    // Ensure the activities match the ActivityItem type
    const typedActivities: ActivityItem[] = activities.map((activity: any) => ({
      ...activity,
      type: activity.type as "comment" | "retweet"
    }));
    
    return {
      activities: typedActivities,
      totalCount: result.activities.totalCount,
      hasMore: result.activities.hasMore,
      entryDetails,
      entryMetrics: Object.fromEntries(
        Object.entries(result.entryMetrics).map(([guid, metrics]: [string, any]) => [
          guid,
          {
            likes: { isLiked: false, count: metrics.likeCount || 0 },
            comments: { count: metrics.commentCount || 0 },
            retweets: { isRetweeted: false, count: metrics.retweetCount || 0 }
          }
        ])
      )
    };
  } catch (error) {
    // Error handling for initial activity data fetch
    // Return empty data instead of null to avoid loading state
    return {
      activities: [],
      totalCount: 0,
      hasMore: false,
      entryDetails: {} as Record<string, RSSEntry>,
      entryMetrics: {}
    };
  }
});

// Cache the initial likes data fetching using the new batch query
export const getInitialLikesData = cache(async (userId: Id<"users">) => {
  try {
    const startTime = Date.now();
    
    // Use the new optimized batch query
    const result = await fetchQuery(api.users.getProfileLikesData, { 
      userId,
      limit: 30
    });
    
    // For now, we'll need to handle any external API calls for entry details
    // since our batch query can't directly access external APIs
    const likes = result.activities.activities;
    const guids = likes.map((like: { entryGuid: string }) => like.entryGuid);
    
    // Get Convex post metadata from the batch query
    let postMetadata: Record<string, any> = result.entryDetails as Record<string, any> || {};
    
    // Fetch ALL RSS entries from PlanetScale to get the full entry details
    // We'll merge the Convex post metadata with this data
    let entryDetails: Record<string, RSSEntry> = {};
    
    if (guids.length > 0) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/entries/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guids }),
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.entries && Array.isArray(data.entries)) {
            // First map entries to their guids
            entryDetails = Object.fromEntries(
              data.entries.map((entry: RSSEntry) => [entry.guid, entry])
            );
            
            // Now enrich each entry with post metadata
            for (const guid in entryDetails) {
              if (postMetadata[guid]) {
                // Extract post metadata
                const metadata = {
                  post_title: postMetadata[guid].post_title,
                  post_featured_img: postMetadata[guid].post_featured_img,
                  post_media_type: postMetadata[guid].post_media_type,
                  category_slug: postMetadata[guid].category_slug,
                  post_slug: postMetadata[guid].post_slug,
                  verified: postMetadata[guid].verified,
                };
                
                // Only keep metadata fields that actually have values
                const cleanedMetadata = Object.fromEntries(
                  Object.entries(metadata).filter(([_, value]) => !!value)
                );
                
                if (Object.keys(cleanedMetadata).length > 0) {
                  // Merge the RSS entry with the post metadata
                  entryDetails[guid] = {
                    ...entryDetails[guid],
                    ...cleanedMetadata
                  };
                }
              }
            }
          }
        }
      } catch (error) {
        // Error handling for PlanetScale API call
      }
    }
    
    // As a backup, try to enrich entries with post data if we have feed_title available
    // This is for cases where the Convex batch enrichment failed
    const feedTitles = [...new Set(
      Object.values(entryDetails)
        .map((entry: any) => entry?.feed_title)
        .filter(Boolean)
    )];
    
    if (feedTitles.length > 0) {
      try {
        const posts = await fetchQuery(api.posts.getByTitles, { titles: feedTitles });
        
        if (posts.length > 0) {
          // Create a map of feed title to post
          const feedTitleToPostMap = new Map(
            posts.map((post: any) => [post.title, post])
          );
          
          // Enrich entry details with post data
          for (const guid in entryDetails) {
            const entry = entryDetails[guid];
            // Only enrich entries that don't already have post metadata
            if (entry && entry.feed_title && !entry.post_slug) {
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
      } catch (error) {
        // Error handling for Convex post data fetch
      }
    }
    
    // Ensure the likes match the ActivityItem type
    const typedLikes: ActivityItem[] = likes.map((like: any) => ({
      ...like,
      type: "like" as "comment" | "retweet" // This might need adjustment based on your type
    }));
    
    return {
      activities: typedLikes,
      totalCount: result.activities.totalCount,
      hasMore: result.activities.hasMore,
      entryDetails,
      entryMetrics: Object.fromEntries(
        Object.entries(result.entryMetrics).map(([guid, metrics]: [string, any]) => [
          guid,
          {
            likes: { isLiked: false, count: metrics.likeCount || 0 },
            comments: { count: metrics.commentCount || 0 },
            retweets: { isRetweeted: false, count: metrics.retweetCount || 0 }
          }
        ])
      )
    };
  } catch (error) {
    // Error handling for initial likes data fetch
    // Return empty data instead of null to avoid loading state
    return {
      activities: [],
      totalCount: 0,
      hasMore: false,
      entryDetails: {} as Record<string, RSSEntry>,
      entryMetrics: {}
    };
  }
});

/**
 * Server component that fetches initial activity data and renders the client component
 */
export async function ProfileActivityData({ userId, username, name, profileImage }: ProfileActivityDataProps) {
  // Fetch only activity data initially - likes will be loaded on demand
  const activityData = await getInitialActivityData(userId);
  
  // Optionally we could prefetch likes data here too if we wanted both tabs ready immediately
  // const likesData = await getInitialLikesData(userId);
  
  return (
    <div className="mt-0">
      <UserProfileTabsWithErrorBoundary 
        userId={userId} 
        username={username}
        name={name || username}
        profileImage={profileImage}
        activityData={activityData}
        likesData={null} // Pass null to indicate likes should be loaded on demand
        pageSize={30}
      />
    </div>
  );
} 