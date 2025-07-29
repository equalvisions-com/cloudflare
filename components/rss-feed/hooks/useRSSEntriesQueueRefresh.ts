import { useCallback, useRef } from 'react';
import useSWR from 'swr';
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
      
      if (attempt === maxRetries - 1) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
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
    totalEntries?: number;
    hasMore?: boolean;
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
  createManagedTimeout: (callback: () => void, delay: number) => void;
}

/**
 * Enhanced RSS refresh hook using Cloudflare Queues for batching and better performance
 * This replaces the direct API call approach with a queue-based system
 */
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
  createManagedTimeout,
}: UseRSSEntriesQueueRefreshProps) => {

  // Track current batch for polling
  const currentBatchRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number>(0);
  const maxPollTimeMs = 30000; // 30 seconds maximum polling

  // Helper function to get refresh request body
  const getRefreshRequestBody = useCallback(() => {
    // Get all existing entry GUIDs to prevent duplicates
    const existingGuids = entriesStateRef.current.map(entryWithData => entryWithData.entry.guid);
    
    // Get the newest entry date to filter for new content only
    const newestEntryDate = preRefreshNewestEntryDateRef.current;
    
    return {
      postTitles: currentPostTitles,
      feedUrls: currentFeedUrls,
      mediaTypes: currentMediaTypes,
      existingGuids,
      newestEntryDate,
      priority: 'normal' as const
    };
  }, [currentPostTitles, currentFeedUrls, currentMediaTypes, entriesStateRef, preRefreshNewestEntryDateRef]);

  // Helper function to process new entries
  const processNewEntries = useCallback((entries: RSSEntriesDisplayEntry[]) => {
    if (!entries.length || !isMountedRef.current) {
      return;
    }

    // Store current newest entry date before adding new entries
    if (entries.length > 0) {
      // Find the newest entry from the new entries
      const newestEntry = entries[0]; // Entries should be sorted by pubDate DESC
      preRefreshNewestEntryDateRef.current = newestEntry.entry.pubDate;
    }

    // Set new entries for notification
    setNewEntries(entries);

    // Create images array for notification
    const images = entries
      .slice(0, 3) // Only show first 3 images
      .map(entry => entry.postMetadata?.featuredImg || entry.entry.image)
      .filter(Boolean) as string[];

    // Show notification with count and images
    setNotification(true, entries.length, images);

    // Auto-hide notification after 10 seconds
    createManagedTimeout(() => {
      if (isMountedRef.current) {
        setNotification(false);
      }
    }, 10000);
  }, [isMountedRef, preRefreshNewestEntryDateRef, setNewEntries, setNotification, createManagedTimeout]);

  // Poll for batch completion
  const pollBatchStatus = useCallback(async (batchId: string) => {
    try {
      // Check if we've been polling too long
      const pollTime = Date.now() - pollStartTimeRef.current;
      if (pollTime > maxPollTimeMs) {
        // Stop polling and fallback to direct processing
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        currentBatchRef.current = null;
        
        if (isMountedRef.current) {
          console.log('⚠️ Queue timeout - falling back to direct refresh');
          // Fallback to direct refresh
          try {
            const directResponse = await fetch('/api/refresh-feeds', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(getRefreshRequestBody()),
            });
            
            if (directResponse.ok) {
              const data = await directResponse.json();
              if (data.success) {
                setHasRefreshed(true);
                if (data.postTitles?.length) setPostTitles(data.postTitles);
                if (data.totalEntries) setTotalEntries(data.totalEntries);
                if (data.refreshedAny && data.entries?.length) {
                  processNewEntries(data.entries);
                }
              }
            }
          } catch (fallbackError) {
            setRefreshError('Refresh failed - please try again');
          }
          setRefreshing(false);
        }
        return;
      }

      const response = await fetch(`/api/queue-refresh?batchId=${batchId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to check batch status: ${response.status}`);
      }
      
      const batchStatus: QueueBatchStatus = await response.json();
      
      if (batchStatus.status === 'completed') {
        // Clear polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        currentBatchRef.current = null;

        if (!isMountedRef.current) return;

        // Process the result
        if (batchStatus.result) {
          const result = batchStatus.result;
          
          // Mark refresh as completed
          setHasRefreshed(true);
          
          // Update post titles with the complete list
          if (result.postTitles?.length) {
            setPostTitles(result.postTitles);
          }
          
          // Update total entries count if provided
          if (result.totalEntries) {
            setTotalEntries(result.totalEntries);
          }
          
          // Handle new entries if any were refreshed
          if (result.refreshedAny && result.entries?.length) {
            // Validate entries structure
            const validEntries = result.entries.filter((entry: RSSEntriesDisplayEntry) => {
              return entry && 
                     entry.entry && 
                     entry.entry.guid && 
                     entry.entry.title && 
                     entry.postMetadata;
            });
            
            if (validEntries.length > 0) {
              processNewEntries(validEntries);
            }
          }
        }
        
        setRefreshing(false);
        
      } else if (batchStatus.status === 'failed') {
        // Clear polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        currentBatchRef.current = null;

        if (isMountedRef.current) {
          setRefreshError(batchStatus.error || 'Queue processing failed');
          setRefreshing(false);
        }
      }
      // Continue polling if status is 'queued' or 'processing'
      
    } catch (error) {
      console.error('Error polling batch status:', error);
      // Don't stop polling on individual poll errors, but limit retries
    }
  }, [isMountedRef, setHasRefreshed, setPostTitles, setTotalEntries, processNewEntries, setRefreshing, setRefreshError, getRefreshRequestBody]);

  // Main queue-based refresh function
  const triggerOneTimeRefresh = useCallback(async () => {
    // Guard clauses - early returns for invalid states
    if (isRefreshing || hasRefreshed || !isMountedRef.current) {
      return;
    }
    
    // Prevent API calls with empty data that would cause 400 errors
    if (!currentPostTitles?.length || !currentFeedUrls?.length) {
      return;
    }
    
    setRefreshing(true);
    setRefreshError(null);
    
    try {
      // Get fresh request body with current state
      const refreshRequestBody = getRefreshRequestBody();
      
      // Send to queue instead of direct processing
      const queueResponse = await retryWithBackoff(async () => {
        const response = await fetch('/api/queue-refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(refreshRequestBody),
        });
        
        if (!response.ok) {
          throw new Error(`Queue API error: ${response.status}`);
        }
        
        return await response.json();
      });
      
      if (!isMountedRef.current) return;
      
      if (queueResponse.success && queueResponse.batchId) {
        // Store batch ID for tracking
        currentBatchRef.current = queueResponse.batchId;
        pollStartTimeRef.current = Date.now(); // Record when polling started
        
        // Start polling for completion
        pollIntervalRef.current = setInterval(() => {
          if (currentBatchRef.current) {
            pollBatchStatus(currentBatchRef.current);
          }
        }, 2000); // Poll every 2 seconds
        
        // Initial poll
        setTimeout(() => {
          if (currentBatchRef.current) {
            pollBatchStatus(currentBatchRef.current);
          }
        }, 1000); // Wait 1 second before first poll
        
        // Quick fallback if queue processing fails
        setTimeout(() => {
          if (currentBatchRef.current && isMountedRef.current) {
            console.log('⚠️ Queue taking too long - using direct fallback');
            // Trigger fallback after 10 seconds instead of 30
            const pollTime = Date.now() - pollStartTimeRef.current;
            if (pollTime > 10000) { // 10 seconds
              pollBatchStatus(currentBatchRef.current);
            }
          }
        }, 10000); // Quick fallback after 10 seconds
        
      } else {
        setRefreshError(queueResponse.error || 'Failed to queue refresh');
        setRefreshing(false);
      }
      
    } catch (error) {
      if (isMountedRef.current) {
        setRefreshError(error instanceof Error ? error.message : 'Refresh failed');
        setRefreshing(false);
      }
    }
  }, [
    isRefreshing, 
    hasRefreshed,
    currentPostTitles,
    currentFeedUrls,
    getRefreshRequestBody,
    setRefreshing,
    setRefreshError,
    pollBatchStatus,
    isMountedRef
  ]);

  // Function to handle followed posts updates (unchanged from original)
  const handleFollowedPostsUpdate = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const FOLLOWED_POSTS_KEY = '/api/rss?refresh=true';
      const cacheKey = `${FOLLOWED_POSTS_KEY}&t=${Date.now()}`;
      
      const data = await retryWithBackoff(async () => {
        const response = await fetch(cacheKey);
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        return await response.json();
      });
      
      if (!isMountedRef.current || !data) return;
      
      // Update metadata first
      if (data.postTitles) {
        setPostTitles(data.postTitles);
      }
      
      if (data.totalEntries) {
        setTotalEntries(data.totalEntries);
      }
      
      // Update entries if available
      if (data.entries?.length) {
        setEntries(data.entries);
        setCurrentPage(1);
        setHasMore(!!data.hasMore);
        setHasRefreshed(false); // Allow refresh again
      }
    } catch (error) {
      // Error is handled gracefully - no console output in production
    }
  }, [setPostTitles, setTotalEntries, setEntries, setCurrentPage, setHasMore, setHasRefreshed, isMountedRef]);

  // Function to handle refresh attempts
  const handleRefreshAttempt = useCallback(() => {
    // Clear any ongoing polls
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    currentBatchRef.current = null;
    
    // Clear all error states
    setFetchError(null);
    setRefreshError(null);
    setRefreshing(false);
    setHasRefreshed(false);
    
    // Attempt to refresh immediately
    triggerOneTimeRefresh();
  }, [triggerOneTimeRefresh, setFetchError, setRefreshError, setRefreshing, setHasRefreshed]);

  // Cleanup function for polling
  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    currentBatchRef.current = null;
  }, []);

  // Listen for global followed posts changes
  const FOLLOWED_POSTS_KEY = '/api/rss?refresh=true';
  useSWR(FOLLOWED_POSTS_KEY, null, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 0,
    onSuccess: handleFollowedPostsUpdate
  });

  return {
    triggerOneTimeRefresh,
    handleFollowedPostsUpdate,
    handleRefreshAttempt,
    cleanup,
    // Expose current batch status for debugging
    getCurrentBatch: () => currentBatchRef.current,
    isPolling: () => pollIntervalRef.current !== null
  };
}; 