import { useCallback, useRef, useState, useEffect } from 'react';
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
    hasMore: boolean;
    totalEntries: number;
    postTitles: string[];
    feedUrls: string[];
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
 * SCALABLE RSS refresh hook using SWR + Cloudflare Queues
 * 
 * Key scalability features:
 * - Uses SWR's built-in polling with exponential backoff
 * - Pauses polling when page is hidden (saves resources)  
 * - Smart deduplication prevents duplicate requests
 * - Automatic cleanup on unmount
 * - No complex custom state management
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

  // Simple state for tracking active batch
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [pollAttempt, setPollAttempt] = useState(0);
  
  // Smart polling interval: exponential backoff (1s → 2s → 4s → 8s → max 30s)
  const getPollingInterval = useCallback((attempt: number): number => {
    return Math.min(1000 * Math.pow(2, attempt), 30000);
  }, []);
  
  // Only poll when we have an active batch AND page is visible
  const shouldPoll = activeBatchId !== null && isActive && !document.hidden;
  
  // SWR handles all the heavy lifting: caching, deduplication, retries, etc.
  const { data: batchStatus, error: pollError } = useSWR(
    shouldPoll ? `/api/queue-refresh?batchId=${activeBatchId}` : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Polling failed: ${response.status}`);
      return response.json() as QueueBatchStatus;
    },
    {
      // SWR configuration for scalable polling
      refreshInterval: shouldPoll ? getPollingInterval(pollAttempt) : 0,
      revalidateOnFocus: false,        // Don't poll on focus (saves resources)
      revalidateOnReconnect: true,     // Resume when connection restored
      dedupingInterval: 1000,          // Prevent duplicate requests within 1s
      errorRetryCount: 3,              // Auto-retry failed requests
      errorRetryInterval: 2000,        // 2s between retries
      
      onSuccess: (data) => {
        if (!data || !isMountedRef.current) return;
        
        if (data.status === 'completed') {
          console.log('✅ Batch completed via SWR polling');
          
          // Stop polling
          setActiveBatchId(null);
          setPollAttempt(0);
          
          if (data.result?.success) {
            handleSuccessfulRefresh(data.result);
          } else {
            setRefreshError(data.result?.error || 'Processing failed');
            setRefreshing(false);
          }
          
        } else if (data.status === 'failed') {
          console.error('❌ Batch failed:', data.error);
          
          // Stop polling
          setActiveBatchId(null);
          setPollAttempt(0);
          setRefreshError(data.error || 'Processing failed');
          setRefreshing(false);
          
        } else {
          // Still processing - increase poll interval (exponential backoff)
          setPollAttempt(prev => prev + 1);
        }
      },
      
      onError: (error) => {
        console.error('🔄 Polling error:', error);
        setPollAttempt(prev => prev + 1); // Slow down on errors
      }
    }
  );

  // Process successful refresh results
  const handleSuccessfulRefresh = useCallback((result: QueueFeedRefreshResult) => {
    setHasRefreshed(true);
    setRefreshing(false);
    setRefreshError(null);
    
    // Update post metadata
    if (result.postTitles?.length) setPostTitles(result.postTitles);
    if (result.totalEntries) setTotalEntries(result.totalEntries);
    
    // Handle new entries
    if (result.refreshedAny && result.entries?.length) {
      const validEntries = result.entries.filter((entry: any) => 
        entry?.entry?.guid && entry?.entry?.title && entry?.postMetadata
      );
      
      if (validEntries.length > 0) {
        processNewEntries(validEntries);
        setNotification(true, validEntries.length);
      }
    }
  }, [setHasRefreshed, setRefreshing, setRefreshError, setPostTitles, setTotalEntries, setNotification]);

  // Process new entries (filter duplicates, sort by date)
  const processNewEntries = useCallback((validEntries: RSSEntriesDisplayEntry[]) => {
    const preRefreshDate = preRefreshNewestEntryDateRef.current;
    
    if (!preRefreshDate) {
      // No previous entries, add all
      setNewEntries(validEntries);
      return;
    }

    // Filter for truly new entries (published after our newest entry)
    const trulyNewEntries = validEntries.filter(entry => {
      const entryDate = new Date(entry.entry.pubDate).getTime();
      const preRefreshDateTime = new Date(preRefreshDate).getTime();
      return entryDate > preRefreshDateTime;
    });

    if (trulyNewEntries.length > 0) {
      // Sort by publication date (newest first)
      trulyNewEntries.sort((a, b) => {
        return new Date(b.entry.pubDate).getTime() - new Date(a.entry.pubDate).getTime();
      });
      
      setNewEntries(trulyNewEntries);
    }
  }, [setNewEntries]);

  // Pause/resume polling based on page visibility (HUGE resource saver)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && activeBatchId) {
        console.log('📱 Pausing polling - page hidden');
      } else if (!document.hidden && activeBatchId) {
        console.log('📱 Resuming polling - page visible');
        setPollAttempt(0); // Reset to fast polling when coming back
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
      postTitles: currentPostTitles,
      feedUrls: currentFeedUrls,
      mediaTypes: currentMediaTypes,
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
    setPollAttempt(0);

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
          // Queue processing - start SWR polling
          console.log('🔄 Starting SWR polling for batch:', queueResponse.batchId);
          setActiveBatchId(queueResponse.batchId);
          // SWR will automatically start polling due to shouldPoll becoming true
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
      setRefreshing, setRefreshError, handleSuccessfulRefresh]);

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
    setActiveBatchId(null); // This stops SWR polling automatically
    setPollAttempt(0);
  }, []);

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
    isPolling: () => shouldPoll,
    pollAttempt,
    pollInterval: shouldPoll ? getPollingInterval(pollAttempt) : 0,
  };
};