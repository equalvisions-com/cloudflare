import { useCallback, useRef, useState, useEffect } from 'react';
import { useConvex } from 'convex/react';
import { api } from '@/convex/_generated/api';
// Removed SWR - now using SSE for real-time updates
import type { 
  RSSEntriesDisplayEntry, 
  QueueBatchStatus,
  QueueFeedRefreshResult 
} from '@/lib/types';

// Retry utility for network operations
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries - 1) break;
      
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

interface UseRSSEntriesQueueRefreshProps {
  isActive: boolean;
  isRefreshing: boolean;
  hasRefreshed: boolean;
  hasInitialized: boolean;
  isMountedRef: React.MutableRefObject<boolean>;
  preRefreshNewestEntryDateRef: React.MutableRefObject<string | undefined>;
  entriesStateRef: React.MutableRefObject<RSSEntriesDisplayEntry[]>;
  initialData: {
    entries: RSSEntriesDisplayEntry[];
    hasMore?: boolean;
    totalEntries?: number;
    postTitles?: string[];
    feedUrls?: string[];
    mediaTypes?: string[];
  };
  currentPostTitles: string[];
  currentFeedUrls: string[];
  currentMediaTypes: string[];
  setRefreshing: (refreshing: boolean) => void;
  setHasRefreshed: (hasRefreshed: boolean) => void;
  setRefreshError: (error: string | null) => void;
  setFetchError: (error: Error | null) => void;
  setEntries: (entries: RSSEntriesDisplayEntry[]) => void;
  setCurrentPage: (page: number) => void;
  setHasMore: (hasMore: boolean) => void;
  setTotalEntries: (total: number) => void;
  setPostTitles: (titles: string[]) => void;
  setFeedUrls: (urls: string[]) => void;
  setMediaTypes: (types: string[]) => void;
  setNewEntries: (entries: RSSEntriesDisplayEntry[]) => void;
  setNotification: (show: boolean, count?: number, images?: string[]) => void;
  prependEntries: (entries: RSSEntriesDisplayEntry[]) => void;
  createManagedTimeout: (callback: () => void, delay: number) => void;
}

/**
 * SCALABLE RSS refresh hook using SWR + Cloudflare Queues
 * 
 * Key scalability features:
 * - Uses SWR's built-in polling with exponential backoff
 * - Pauses polling when page is hidden (saves resources)  
 * - Smart deduplication prevents duplicate requests
 * - Automatic cleanup on unmount
 * - No complex custom state management
 */

// Enrich SSE entries with Convex post metadata
async function enrichSSEEntriesWithConvex(
  flatEntries: any[], 
  currentPostTitles: string[],
  convex: any
): Promise<RSSEntriesDisplayEntry[]> {
  try {
    console.log('🔄 SSE: Enriching entries with Convex data...', { entriesCount: flatEntries.length });
    
    // Get post data from Convex using post titles from worker
    const posts = await convex.query(api.posts.getByTitles, { titles: currentPostTitles });
    
    console.log('✅ SSE: Fetched Convex posts:', { postsCount: posts.length });
    
    // Create a map of post title to post data  
    const postMap = new Map(
      posts.map((post: any) => [post.title, post])
    );
    
    // Transform entries with proper enrichment
    return flatEntries.map((flatEntry: any) => {
      // Try to find matching post by checking if any current post titles match
      // Since we don't have direct mapping, we'll use a best-effort approach
      let matchingPost: any = null;
      for (const title of currentPostTitles) {
        const post: any = postMap.get(title);
        if (post && post.mediaType === flatEntry.media_type) {
          matchingPost = post;
          break;
        }
      }
      
      return {
        entry: {
          title: flatEntry.title,
          link: flatEntry.link,
          description: flatEntry.description || '',
          pubDate: flatEntry.pub_date,
          guid: flatEntry.guid,
          image: flatEntry.image,
          feedUrl: matchingPost?.feedUrl || '',
          mediaType: flatEntry.media_type
        },
        initialData: {
          likes: { isLiked: false, count: 0 },
          comments: { count: 0 },
          retweets: { isRetweeted: false, count: 0 },
          bookmarks: { isBookmarked: false }
        },
        postMetadata: {
          title: matchingPost?.title || (flatEntry.media_type === 'newsletter' ? 'Newsletter' : 'Podcast'),
          featuredImg: matchingPost?.featuredImg || flatEntry.image,
          mediaType: flatEntry.media_type,
          verified: matchingPost?.verified || false,
          postSlug: matchingPost?.postSlug,
          categorySlug: matchingPost?.categorySlug
        }
      };
    });
    
  } catch (error) {
    console.error('❌ SSE: Failed to enrich entries with Convex:', error);
    
    // Fallback to basic structure if enrichment fails
    return flatEntries.map((flatEntry: any) => ({
      entry: {
        title: flatEntry.title,
        link: flatEntry.link,
        description: flatEntry.description || '',
        pubDate: flatEntry.pub_date,
        guid: flatEntry.guid,
        image: flatEntry.image,
        feedUrl: '',
        mediaType: flatEntry.media_type
      },
      initialData: {
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 },
        bookmarks: { isBookmarked: false }
      },
      postMetadata: {
        title: flatEntry.media_type === 'newsletter' ? 'Newsletter' : 'Podcast',
        featuredImg: flatEntry.image,
        mediaType: flatEntry.media_type,
        verified: false
      }
    }));
  }
}

export const useRSSEntriesQueueRefresh = ({
  isActive,
  isRefreshing,
  hasRefreshed,
  hasInitialized,
  isMountedRef,
  preRefreshNewestEntryDateRef,
  entriesStateRef,
  initialData,
  currentPostTitles,
  currentFeedUrls,
  currentMediaTypes,
  setRefreshing,
  setHasRefreshed,
  setRefreshError,
  setFetchError,
  setEntries,
  setCurrentPage,
  setHasMore,
  setTotalEntries,
  setPostTitles,
  setFeedUrls,
  setMediaTypes,
  setNewEntries,
  setNotification,
  prependEntries,
  createManagedTimeout,
}: UseRSSEntriesQueueRefreshProps) => {
  const convex = useConvex();

  // SSE state for real-time batch tracking
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // SSE connection management (defined after dependencies)
  
  // Process successful refresh results  
  const handleSuccessfulRefresh = useCallback((result: QueueFeedRefreshResult) => {
    setHasRefreshed(true);
    setRefreshing(false);
    setRefreshError(null);
    
    // Update post metadata
    if (result.postTitles?.length) setPostTitles(result.postTitles);
    if (result.totalEntries !== undefined) setTotalEntries(result.totalEntries);
    
    // Handle new entries
    if (result.refreshedAny && result.entries?.length) {
      const validEntries = result.entries.filter((entry: any) => 
        entry?.entry?.guid && entry?.entry?.title && entry?.postMetadata
      );
      
      if (validEntries.length > 0) {
        const { trulyNewEntries, featuredImages } = processNewEntries(validEntries);
        
        // Immediately prepend new entries to the feed
        if (trulyNewEntries.length > 0) {
          prependEntries(trulyNewEntries);
          
          // Show notification badge as indicator only (entries already added)
          setNotification(true, trulyNewEntries.length, featuredImages);
        }
      }
    }
  }, [setHasRefreshed, setRefreshing, setRefreshError, setPostTitles, setTotalEntries, setNotification, prependEntries]);

  // Process new entries (filter duplicates, sort by date)
  const processNewEntries = useCallback((validEntries: RSSEntriesDisplayEntry[]) => {
    const preRefreshDate = preRefreshNewestEntryDateRef.current;
    
    let trulyNewEntries: RSSEntriesDisplayEntry[];
    
    if (!preRefreshDate) {
      // No previous entries, add all
      trulyNewEntries = validEntries;
    } else {
      // Filter for truly new entries (published after our newest entry)
      trulyNewEntries = validEntries.filter(entry => {
        const entryDate = new Date(entry.entry.pubDate).getTime();
        const preRefreshDateTime = new Date(preRefreshDate).getTime();
        return entryDate > preRefreshDateTime;
      });
    }

    if (trulyNewEntries.length > 0) {
      // Sort by publication date (newest first)
      trulyNewEntries.sort((a, b) => {
        return new Date(b.entry.pubDate).getTime() - new Date(a.entry.pubDate).getTime();
      });
      
      console.log('🎉 QUEUE REFRESH: Found', trulyNewEntries.length, 'truly new entries');
      console.log('🎉 QUEUE REFRESH: Truly new entries:', trulyNewEntries);
    } else {
      console.log('⚠️ QUEUE REFRESH: No truly new entries found after filtering');
    }

    // Extract featured images for notification
    const featuredImages = trulyNewEntries
      .slice(0, 3) // Take only first 3 entries
      .map((entry: any) => {
        return entry.postMetadata?.featuredImg || entry.entry?.image || '';
      })
      .filter(Boolean);

    return { trulyNewEntries, featuredImages };
  }, []);

  // Clean up SSE connection
  const cleanupSSE = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('🔌 SSE: Closing connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setActiveBatchId(null);
  }, []);

  // SSE connection management
  const connectToSSE = useCallback((batchId: string) => {
    // Cleanup existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    console.log(`📡 SSE: Connecting to batch stream for ${batchId}`);
    
    const eventSource = new EventSource(`/api/batch-stream/${batchId}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log(`🔗 SSE: Connected to batch ${batchId}`);
    };
    
    eventSource.onmessage = (event) => {
      if (!isMountedRef.current) return;
      
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log(`✅ SSE: Connected to batch ${data.batchId}`);
          return;
        }
        
        if (data.type === 'timeout') {
          console.warn(`⏰ SSE: Timeout for batch ${data.batchId}`);
          setRefreshError('Processing timeout - please try again');
          setRefreshing(false);
          cleanupSSE();
          return;
        }
        
        if (data.type === 'error') {
          console.error(`❌ SSE: Error for batch ${data.batchId}:`, data.error);
          setRefreshError(data.error || 'Stream error');
          setRefreshing(false);
          cleanupSSE();
          return;
        }
        
        // Handle batch status updates
        if (data.batchId && data.status) {
          console.log(`📊 SSE: Batch ${data.batchId} status: ${data.status}`);
          
          if (data.status === 'completed') {
            console.log('✅ SSE: Batch completed with real-time update');
            console.log('📦 SSE: Received completion data:', data);
            
            // Enrich entries with Convex post data
            enrichSSEEntriesWithConvex(data.entries || [], currentPostTitles, convex)
              .then(enrichedEntries => {
                const completionResult = {
                  batchId: data.batchId,
                  success: true,
                  refreshedAny: (data.newEntriesCount || 0) > 0,
                  entries: enrichedEntries,
                  newEntriesCount: data.newEntriesCount || 0,
                  totalEntries: data.newEntriesCount || 0,
                  postTitles: currentPostTitles,
                  refreshTimestamp: data.refreshTimestamp,
                  processingTimeMs: data.processingTimeMs
                };
                
                console.log('🔄 SSE: Processing completion result:', completionResult);
                handleSuccessfulRefresh(completionResult);
                cleanupSSE();
              })
              .catch(error => {
                console.error('❌ SSE: Failed to enrich entries:', error);
                setRefreshError('Failed to enrich entries');
                setRefreshing(false);
                cleanupSSE();
              });
            return; // Early return to avoid the duplicate code below
            
          } else if (data.status === 'failed') {
            console.error('❌ SSE: Batch failed:', data.error);
            setRefreshError(data.error || 'Processing failed');
            setRefreshing(false);
            cleanupSSE();
          }
          // For 'queued' and 'processing' statuses, just continue listening
        }
        
      } catch (parseError) {
        console.error('❌ SSE: Failed to parse message:', parseError);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('❌ SSE: Connection error:', error);
      
      // Only set error if we're still mounted and refreshing
      if (isMountedRef.current && isRefreshing) {
        setRefreshError('Connection lost - please try again');
        setRefreshing(false);
      }
      
      cleanupSSE();
    };
    
  }, [isMountedRef, isRefreshing, handleSuccessfulRefresh, setRefreshError, setRefreshing, cleanupSSE]);

  // Pause/resume polling based on page visibility (HUGE resource saver)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && activeBatchId) {
        console.log('📱 Pausing polling - page hidden');
      } else if (!document.hidden && activeBatchId) {
        console.log('📱 Resuming SSE - page visible');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeBatchId]);

  // Get refresh request body
  const getRefreshRequestBody = useCallback(() => {
    const existingGuids = entriesStateRef.current.map(entry => entry.entry.guid);
    const newestEntryDate = preRefreshNewestEntryDateRef.current;

    return {
      postTitles: currentPostTitles || [],
      feedUrls: currentFeedUrls || [],
      mediaTypes: currentMediaTypes || [],
      existingGuids,
      newestEntryDate,
      priority: 'normal' as const
    };
  }, [currentPostTitles, currentFeedUrls, currentMediaTypes]);

  // Trigger one-time refresh (main action)
  const triggerOneTimeRefresh = useCallback(async () => {
    if (isRefreshing || hasRefreshed || !isMountedRef.current) return;
    if (!currentPostTitles?.length || !currentFeedUrls?.length) return;

    setRefreshing(true);
    setRefreshError(null);

    try {
      const refreshRequestBody = getRefreshRequestBody();
      
      // Send to queue with retry logic
      const queueResponse = await retryWithBackoff(async () => {
        const response = await fetch('/api/queue-refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(refreshRequestBody),
        });
        
        if (!response.ok) {
          throw new Error(`Queue API error: ${response.status}`);
        }
        
        return await response.json();
      });

      if (!isMountedRef.current) return;

      if (queueResponse.success) {
        if (queueResponse.processedDirectly) {
          // Direct processing completed immediately
          console.log('⚡ Direct processing - immediate results');
          
          if (queueResponse.result?.result) {
            handleSuccessfulRefresh(queueResponse.result.result);
          } else {
            setRefreshing(false);
            setHasRefreshed(true);
          }
          
        } else if (queueResponse.batchId) {
          // Queue processing - start SSE connection for real-time updates
          console.log('📡 Starting SSE stream for batch:', queueResponse.batchId);
          setActiveBatchId(queueResponse.batchId);
          connectToSSE(queueResponse.batchId);
        }
      } else {
        setRefreshError(queueResponse.error || 'Refresh failed');
        setRefreshing(false);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setRefreshError(error instanceof Error ? error.message : 'Refresh failed');
        setRefreshing(false);
      }
    }
  }, [isRefreshing, hasRefreshed, currentPostTitles, currentFeedUrls, getRefreshRequestBody, 
      setRefreshing, setRefreshError, handleSuccessfulRefresh, connectToSSE]);

  // Handle when followed posts update (reset refresh state)
  const handleFollowedPostsUpdate = useCallback((
    newPostTitles: string[], 
    newFeedUrls: string[], 
    newMediaTypes?: string[]
  ) => {
    if (hasRefreshed) {
      setHasRefreshed(false);
    }
  }, [hasRefreshed, setHasRefreshed]);

  // Handle refresh attempt
  const handleRefreshAttempt = useCallback(() => {
    if (!hasRefreshed && !isRefreshing) {
      triggerOneTimeRefresh();
    }
  }, [hasRefreshed, isRefreshing, triggerOneTimeRefresh]);

  // Cleanup function
  const cleanup = useCallback(() => {
    isMountedRef.current = false;
    cleanupSSE(); // Close SSE connection and clear batch
  }, [cleanupSSE]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    triggerOneTimeRefresh,
    handleFollowedPostsUpdate,
    handleRefreshAttempt,
    cleanup,
    
    // Debugging/monitoring info
    getCurrentBatch: () => activeBatchId,
    isStreaming: () => eventSourceRef.current !== null,
    streamReadyState: () => eventSourceRef.current?.readyState || -1,
  };
};