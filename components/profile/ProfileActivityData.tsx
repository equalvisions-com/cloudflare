import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { cache, Suspense } from "react";

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

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  userId: string;
}

interface SharedDataCache {
  entryDetails: Map<string, EntriesRSSEntry>;
  postMetadata: Map<string, ProfileActivityDataConvexPost>;
  lastCleanup: number;
}

// Global cache for sharing enriched data between tabs and users
const SHARED_CACHE: SharedDataCache = {
  entryDetails: new Map(),
  postMetadata: new Map(),
  lastCleanup: Date.now()
};

// Cache configuration
const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5 minutes TTL
  MAX_ENTRIES: 1000,   // Max 1000 cached entries
  CLEANUP_INTERVAL: 10 * 60 * 1000 // Clean every 10 minutes
};

function cleanupCache(): void {
  const now = Date.now();
  
  // Only cleanup if interval has passed
  if (now - SHARED_CACHE.lastCleanup < CACHE_CONFIG.CLEANUP_INTERVAL) {
    return;
  }
  
  const cutoff = now - CACHE_CONFIG.TTL;
  let cleanedEntries = 0;
  let cleanedPosts = 0;
  
  // Clean entry details cache
  for (const [key, entry] of SHARED_CACHE.entryDetails.entries()) {
    if (!entry || now - cutoff > CACHE_CONFIG.TTL) {
      SHARED_CACHE.entryDetails.delete(key);
      cleanedEntries++;
    }
  }
  
  // Clean post metadata cache
  for (const [key, post] of SHARED_CACHE.postMetadata.entries()) {
    if (!post || now - cutoff > CACHE_CONFIG.TTL) {
      SHARED_CACHE.postMetadata.delete(key);
      cleanedPosts++;
    }
  }
  
  // Enforce max size limits
  if (SHARED_CACHE.entryDetails.size > CACHE_CONFIG.MAX_ENTRIES) {
    const entriesToDelete = SHARED_CACHE.entryDetails.size - CACHE_CONFIG.MAX_ENTRIES;
    const entries = Array.from(SHARED_CACHE.entryDetails.keys()).slice(0, entriesToDelete);
    entries.forEach(key => SHARED_CACHE.entryDetails.delete(key));
    cleanedEntries += entries.length;
  }
  
  if (SHARED_CACHE.postMetadata.size > CACHE_CONFIG.MAX_ENTRIES) {
    const postsToDelete = SHARED_CACHE.postMetadata.size - CACHE_CONFIG.MAX_ENTRIES;
    const posts = Array.from(SHARED_CACHE.postMetadata.keys()).slice(0, postsToDelete);
    posts.forEach(key => SHARED_CACHE.postMetadata.delete(key));
    cleanedPosts += posts.length;
  }
  
  SHARED_CACHE.lastCleanup = now;
}

// Loading fallback component (server-side safe)
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
  
  // Clean cache before processing
  cleanupCache();
  
  let entryDetails: Record<string, EntriesRSSEntry> = {};
  const uncachedGuids: string[] = [];
  
  for (const guid of guids) {
    const cached = SHARED_CACHE.entryDetails.get(guid);
    if (cached) {
      entryDetails[guid] = cached;
    } else {
      uncachedGuids.push(guid);
    }
  }
  
  // Only fetch uncached entries
  if (uncachedGuids.length > 0) {
    try {
      const response = await fetchWithRetry(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/entries/batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guids: uncachedGuids }),
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
          const newEntries = Object.fromEntries(
            data.entries.map((entry: EntriesRSSEntry) => [entry.guid, entry])
          );
          
          // Add to main result
          Object.assign(entryDetails, newEntries);
          
          // Cache the new entries
          for (const [guid, entry] of Object.entries(newEntries)) {
            SHARED_CACHE.entryDetails.set(guid, entry);
          }
        }
      }
    } catch (error) {
      // Continue with cached data only
    }
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
        
        // Update cache with enriched data
        SHARED_CACHE.entryDetails.set(guid, enrichedEntry);
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
    
    // Check cache for post metadata first
    const cachedPosts = new Map<string, ProfileActivityDataConvexPost>();
    const uncachedTitles: string[] = [];
    
    for (const title of feedTitles) {
      const cached = SHARED_CACHE.postMetadata.get(title);
      if (cached) {
        cachedPosts.set(title, cached);
      } else {
        uncachedTitles.push(title);
      }
    }
    
    // Fetch uncached posts
    if (uncachedTitles.length > 0) {
      const posts = await fetchQuery(api.posts.getByTitles, { titles: uncachedTitles });
      
      if (posts?.length > 0) {
        for (const post of posts as ProfileActivityDataConvexPost[]) {
          cachedPosts.set(post.title, post);
          SHARED_CACHE.postMetadata.set(post.title, post);
        }
      }
    }
    
    for (const entry of entriesNeedingEnrichment) {
      if (entry.feed_title) {
        const post = cachedPosts.get(entry.feed_title);
        if (post) {
          entry.post_title = post.title;
          entry.post_featured_img = post.featuredImg;
          entry.post_media_type = post.mediaType;
          entry.category_slug = post.categorySlug;
          entry.post_slug = post.postSlug;
          entry.verified = true;
          
          // Update cache
          SHARED_CACHE.entryDetails.set(entry.guid, entry);
        }
      }
    }
  } catch (error) {
    // Backup enrichment failure is non-critical
  }
}

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
    getInitialActivityData(userId);
    const activityData = await getInitialActivityData(userId);
    
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
 * - Intelligent caching with automatic cleanup
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