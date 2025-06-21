import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { cache, Suspense, useCallback, useRef, useEffect } from "react";

// Import the client component
import { UserProfileTabsWithErrorBoundary } from "./UserProfileTabs";

// Import centralized types
import { 
  ActivityItem, 
  EntriesRSSEntry, 
  ProfileFeedData,
  InteractionStates,
  ProfileActivityDataConvexPost,
  ProfileActivityDataConvexActivity,
  ProfileActivityDataConvexLike,
  ProfileActivityDataPostMetadata,
  ProfileActivityDataConvexResult,
  ProfileActivityDataConvexLikesResult
} from "@/lib/types";

// Edge Runtime compatible configuration
export const runtime = 'edge';

interface ProfileActivityDataProps {
  readonly userId: Id<"users">;
  readonly username: string;
  readonly name?: string;
  readonly profileImage?: string | null;
}

// Retry configuration for robust network handling
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  timeoutMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // Start with 1 second
  maxDelay: 8000,  // Max 8 seconds between retries
  timeoutMs: 10000 // 10 second timeout per attempt
};

// Request deduplication cache - module level for sharing across component instances
const requestCache = new Map<string, Promise<ProfileFeedData>>();

// Memory management: Prevent cache from growing too large in edge cases
const MAX_CACHE_SIZE = 500; // Reasonable limit for concurrent requests

const cleanupRequestCache = () => {
  if (requestCache.size > MAX_CACHE_SIZE) {
    // Remove oldest 50% of entries to prevent unbounded growth
    const entries = Array.from(requestCache.keys());
    const toDelete = entries.slice(0, Math.floor(entries.length * 0.5));
    toDelete.forEach(key => requestCache.delete(key));
  }
};

function ProfileActivityLoading() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response | null> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      
      // Set timeout for this attempt
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, config.timeoutMs);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      
      // If successful, return the response
      if (response.ok) {
        return response;
      }
      
      // If it's a server error (5xx) or rate limit (429), retry
      if (response.status >= 500 || response.status === 429) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      // For client errors (4xx), don't retry
      if (response.status >= 400) {
        return null;
      }
      
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If this was the last attempt, break
      if (attempt === config.maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        config.maxDelay
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
}

async function enrichEntryDetails(
  guids: string[],
  postMetadata: Record<string, ProfileActivityDataPostMetadata>,
  retryConfig: Partial<RetryConfig> = {}
): Promise<Record<string, EntriesRSSEntry>> {
  if (guids.length === 0) return {};
  
  let entryDetails: Record<string, EntriesRSSEntry> = {};
  
  try {
    const response = await fetchWithRetry(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/entries/batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guids }),
        cache: 'no-store'
      },
      {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 4000,
        timeoutMs: 8000,
        ...retryConfig
      }
    );
    
    if (response) {
      const data = await response.json();
      if (data?.entries && Array.isArray(data.entries)) {
        entryDetails = Object.fromEntries(
          data.entries.map((entry: EntriesRSSEntry) => [entry.guid, entry])
        );
      }
    }
  } catch (error) {
    // Continue with empty data
  }
  
  for (const guid of Object.keys(entryDetails)) {
    const metadata = postMetadata[guid];
    if (metadata) {
      const entry = entryDetails[guid];
      
      // Only create new object if enrichment is needed
      const needsEnrichment = !entry.post_title || !entry.post_slug;
      if (needsEnrichment) {
        const enrichedEntry = Object.assign({}, entry, {
          ...(metadata.post_title && { post_title: metadata.post_title }),
          ...(metadata.post_featured_img && { post_featured_img: metadata.post_featured_img }),
          ...(metadata.post_media_type && { post_media_type: metadata.post_media_type }),
          ...(metadata.category_slug && { category_slug: metadata.category_slug }),
          ...(metadata.post_slug && { post_slug: metadata.post_slug }),
          ...(metadata.verified && { verified: metadata.verified })
        });
        
        entryDetails[guid] = enrichedEntry;
      }
    }
  }
  
  return entryDetails;
}

function extractValidUniqueGuids(activities: ProfileActivityDataConvexActivity[]): string[] {
  const seen = new Set<string>();
  const validGuids: string[] = [];
  
  for (const activity of activities) {
    if (activity?.entryGuid && !seen.has(activity.entryGuid)) {
      seen.add(activity.entryGuid);
      validGuids.push(activity.entryGuid);
    }
  }
  
  return validGuids;
}

function extractValidUniqueFeedTitles(entries: EntriesRSSEntry[]): string[] {
  const seen = new Set<string>();
  const validTitles: string[] = [];
  
  for (const entry of entries) {
    if (entry?.feed_title && !entry.post_slug && !seen.has(entry.feed_title)) {
      seen.add(entry.feed_title);
      validTitles.push(entry.feed_title);
    }
  }
  
  return validTitles;
}

async function performBackupEnrichment(
  entryDetails: Record<string, EntriesRSSEntry>
): Promise<void> {
  const entriesNeedingEnrichment = Object.values(entryDetails).filter(
    (entry: EntriesRSSEntry) => entry?.feed_title && !entry.post_slug
  );
  
  if (entriesNeedingEnrichment.length === 0) return;
  
  try {
    const feedTitles = extractValidUniqueFeedTitles(entriesNeedingEnrichment);
    
    if (feedTitles.length === 0) return;
    
    const posts = await fetchQuery(api.posts.getByTitles, { titles: feedTitles });
    
    if (posts?.length > 0) {
      const postMap = new Map<string, ProfileActivityDataConvexPost>();
      for (const post of posts as ProfileActivityDataConvexPost[]) {
        postMap.set(post.title, post);
      }
      
      for (const entry of entriesNeedingEnrichment) {
        if (entry.feed_title) {
          const post = postMap.get(entry.feed_title);
          if (post) {
            entry.post_title = post.title;
            entry.post_featured_img = post.featuredImg;
            entry.post_media_type = post.mediaType;
            entry.category_slug = post.categorySlug;
            entry.post_slug = post.postSlug;
            entry.verified = true;
          }
        }
      }
    }
  } catch (error) {
    // Backup enrichment failure is non-critical
  }
}

// Request deduplication wrapper for getInitialActivityData
const getInitialActivityDataWithDedup = async (userId: Id<"users">): Promise<ProfileFeedData> => {
  const cacheKey = `activity-${userId}`;
  const existingRequest = requestCache.get(cacheKey);
  
  if (existingRequest) {
    return existingRequest;
  }
  
  // Cleanup cache if needed before adding new entry
  cleanupRequestCache();
  
  const promise = getInitialActivityData(userId).finally(() => {
    requestCache.delete(cacheKey);
  });
  
  requestCache.set(cacheKey, promise);
  return promise;
};

export const getInitialActivityData = cache(async (userId: Id<"users">): Promise<ProfileFeedData> => {
  try {
    const resultPromise = fetchQuery(api.users.getProfileActivityData, { 
      userId,
      limit: 30
    });
    
    const result = await resultPromise;
    
    if (!result?.activities?.activities?.length) {
      return {
        activities: [],
        totalCount: 0,
        hasMore: false,
        entryDetails: {}
      };
    }
    
    const activities = result.activities.activities;
    
    const validGuids = extractValidUniqueGuids(activities);
    const postMetadata: Record<string, ProfileActivityDataPostMetadata> = result.entryDetails as Record<string, ProfileActivityDataPostMetadata> || {};
    
    const entryDetailsPromise = enrichEntryDetails(validGuids, postMetadata);
    const entryDetails = await entryDetailsPromise;
    
    await performBackupEnrichment(entryDetails);
    
    const typedActivities: ActivityItem[] = activities
      .filter(Boolean)
      .filter((activity: ProfileActivityDataConvexActivity) => 
        activity.entryGuid && 
        activity.type && 
        (activity.type === "comment" || activity.type === "retweet")
      )
      .map((activity: ProfileActivityDataConvexActivity) => activity as unknown as ActivityItem);
    
    return {
      activities: typedActivities,
      totalCount: result.activities.totalCount,
      hasMore: result.activities.hasMore,
      entryDetails
    };
  } catch (error) {
    return {
      activities: [],
      totalCount: 0,
      hasMore: false,
      entryDetails: {}
    };
  }
});

// Request deduplication wrapper for getInitialLikesData
const getInitialLikesDataWithDedup = async (userId: Id<"users">): Promise<ProfileFeedData> => {
  const cacheKey = `likes-${userId}`;
  const existingRequest = requestCache.get(cacheKey);
  
  if (existingRequest) {
    return existingRequest;
  }
  
  // Cleanup cache if needed before adding new entry
  cleanupRequestCache();
  
  const promise = getInitialLikesData(userId).finally(() => {
    requestCache.delete(cacheKey);
  });
  
  requestCache.set(cacheKey, promise);
  return promise;
};

export const getInitialLikesData = cache(async (userId: Id<"users">): Promise<ProfileFeedData> => {
  try {
    const resultPromise = fetchQuery(api.users.getProfileLikesData, { 
      userId,
      limit: 30
    });
    
    const result = await resultPromise;
    
    if (!result?.activities?.activities?.length) {
      return {
        activities: [],
        totalCount: 0,
        hasMore: false,
        entryDetails: {}
      };
    }
    
    const likes = result.activities.activities;
    
    const validGuids = extractValidUniqueGuids(likes as unknown as ProfileActivityDataConvexActivity[]);
    
    const postMetadata: Record<string, ProfileActivityDataPostMetadata> = result.entryDetails as Record<string, ProfileActivityDataPostMetadata> || {};
    
    const entryDetails = await enrichEntryDetails(validGuids, postMetadata, {
      maxRetries: 2,
      timeoutMs: 8000
    });
    
    await performBackupEnrichment(entryDetails);
    
    const typedLikes: ActivityItem[] = likes
        .filter(Boolean)
      .filter((like: ProfileActivityDataConvexLike) => like.entryGuid)
      .map((like: ProfileActivityDataConvexLike) => like as unknown as ActivityItem);
    
    return {
      activities: typedLikes,
      totalCount: result.activities.totalCount,
      hasMore: result.activities.hasMore,
      entryDetails
    };
  } catch (error) {
    return {
      activities: [],
      totalCount: 0,
      hasMore: false,
      entryDetails: {}
    };
  }
});

async function ProfileActivityDataWithData({ userId, username, name, profileImage }: ProfileActivityDataProps) {
  try {
    // FIXED: Remove redundant cache call - use deduplication wrapper instead
    const activityData = await getInitialActivityDataWithDedup(userId);
  
    return (
      <div className="mt-0">
        <UserProfileTabsWithErrorBoundary 
          userId={userId} 
          username={username}
          name={name || username}
          profileImage={profileImage}
          activityData={activityData}
          likesData={null}
          pageSize={30}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Unable to load profile activity
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Something went wrong while loading the activity data.
          </p>
        </div>
      </div>
    );
  }
}

/**
 * Edge Runtime compatible server component for profile activity data.
 * 
 * Features:
 * - Request deduplication to prevent duplicate concurrent requests
 * - Shared data enrichment logic between tabs
 * - Memory-efficient object creation
 * - Retry logic with exponential backoff
 * - Lazy loading for likes data
 * 
 * Optimized for high-concurrency scenarios and Edge deployment.
 */
export async function ProfileActivityData(props: ProfileActivityDataProps) {
  return (
    <Suspense fallback={<ProfileActivityLoading />}>
      <ProfileActivityDataWithData {...props} />
    </Suspense>
  );
}

export default ProfileActivityData; 