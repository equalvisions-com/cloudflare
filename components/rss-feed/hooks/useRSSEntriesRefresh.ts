import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import type { 
  RSSEntriesDisplayEntry, 
  RSSEntriesDisplayRefreshResponse 
} from '@/lib/types';
import React from 'react';

// Enhanced error recovery with exponential backoff
const retryWithBackoff = async <T>(
  fn: () => Promise<T>, 
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry on the last attempt
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Calculate exponential backoff delay: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      const totalDelay = delay + jitter;
      
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
  
  // TypeScript requires this, but it should never be reached
  throw new Error('Retry logic failed unexpectedly');
};

// Helper function to format dates back to MySQL format without timezone conversion
const formatDateForAPI = (date: Date): string => {
  // Format as YYYY-MM-DDTHH:MM:SS.sssZ but preserve the original timezone intent
  // Since our database stores EST times, we need to format without UTC conversion
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  // Return in ISO format but using local time components (no UTC conversion)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
};

// Helper function to consistently parse dates from the database
const parseEntryDate = (dateString: string | Date): Date => {
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
  const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  
  if (typeof dateString === 'string' && mysqlDateRegex.test(dateString)) {
    // Convert MySQL datetime string - do NOT add 'Z' as the database times are in local timezone (EST)
    // Adding 'Z' incorrectly treats EST times as UTC, causing a 4-hour offset
    const [datePart, timePart] = dateString.split(' ');
    return new Date(`${datePart}T${timePart}`); // No 'Z' - let JS interpret as local time
  }
  
  // Handle other formats
  return new Date(dateString);
};

interface UseRSSEntriesRefreshProps {
  isActive: boolean;
  isRefreshing: boolean;
  hasRefreshed: boolean;
  hasInitialized: boolean;
  isMountedRef: React.MutableRefObject<boolean>;
  preRefreshNewestEntryDateRef: React.MutableRefObject<string | undefined>;
  entriesStateRef: React.MutableRefObject<RSSEntriesDisplayEntry[]>;
  initialData?: {
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
  createManagedTimeout: (callback: () => void, delay: number) => NodeJS.Timeout;
}

/**
 * Custom hook for handling refresh logic and feed updates in RSS Entries Display
 * Follows React best practices - returns computed values and functions
 */
export const useRSSEntriesRefresh = ({
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
}: UseRSSEntriesRefreshProps) => {

  // Helper function to process and prepend new entries - optimized for performance
  const processNewEntries = useCallback((entries: RSSEntriesDisplayEntry[]) => {
    if (!entries.length || !isMountedRef.current) {
      return;
    }

    // Get current entries from ref for consistency
    const currentEntries = entriesStateRef.current;
    
    // Create a set of existing entry GUIDs for fast lookup
    const existingGuids = new Set(currentEntries.map(entry => entry.entry.guid));
    
    // Filter out any duplicate entries
    const uniqueNewEntries = entries.filter(entry => !existingGuids.has(entry.entry.guid));
    
    if (uniqueNewEntries.length === 0) {
      return;
    }
    
    // Sort new entries by publication date in descending order (newest first)
    const sortedNewEntries = [...uniqueNewEntries].sort((a, b) => {
      const dateA = new Date(a.entry.pubDate).getTime();
      const dateB = new Date(b.entry.pubDate).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
    
    // Extract featured images for notification
    const featuredImages = sortedNewEntries
      .slice(0, 3) // Take only first 3 entries
      .map(entry => {
        return entry.postMetadata?.featuredImg || entry.entry?.image || '';
      })
      .filter(Boolean);
    
    // Use React.startTransition for better performance with non-urgent updates
    React.startTransition(() => {
      // Batch all state updates together for better performance
      // 1. Prepend entries
      const newEntriesArray = [...sortedNewEntries, ...currentEntries];
      setEntries(newEntriesArray);
      
      // 2. Show notification
      setNotification(true, sortedNewEntries.length, featuredImages);
    });
    
    // 3. Auto-hide notification after 5 seconds (separate from transition)
    createManagedTimeout(() => {
      if (isMountedRef.current) {
        setNotification(false);
      }
    }, 5000);
    
  }, [setEntries, setNotification, createManagedTimeout]); // Reduced dependencies

  // Compute refresh request body dynamically - no memoization needed since it's used only in triggerOneTimeRefresh
  const getRefreshRequestBody = useCallback(() => {
    // Get current entry GUIDs from the ref to avoid duplicates
    const existingGuids = entriesStateRef.current.map(entry => entry.entry.guid);
    
    return {
      postTitles: currentPostTitles || [],
      feedUrls: currentFeedUrls || [],
      mediaTypes: currentMediaTypes || [],
      existingGuids, // Always fresh from current state
      newestEntryDate: preRefreshNewestEntryDateRef.current
    };
  }, [currentPostTitles, currentFeedUrls, currentMediaTypes, preRefreshNewestEntryDateRef, entriesStateRef]);

  // Function to trigger a one-time refresh
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
      
      const data: RSSEntriesDisplayRefreshResponse = await retryWithBackoff(async () => {
        const response = await fetch('/api/refresh-feeds', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(refreshRequestBody),
        });
        
        if (!response.ok) {
          throw new Error(`Refresh API error: ${response.status}`);
        }
        
        return await response.json();
      });
      
      if (!isMountedRef.current) return;
      
      if (data.success) {
        // Mark that we've completed a refresh regardless of whether anything was refreshed
        setHasRefreshed(true);
        
        // Update post titles with the COMPLETE list of all followed titles
        // This is crucial for pagination to work with newly followed posts
        if (data.postTitles?.length) {
          setPostTitles(data.postTitles);
        }
        
        // Update total entries count if provided in the response
        if (data.totalEntries) {
          setTotalEntries(data.totalEntries);
        }
        
        // Handle new entries if any were refreshed
        if (data.refreshedAny && data.entries?.length) {
          // Validate that entries have the expected structure
          const validEntries = data.entries.filter((entry: RSSEntriesDisplayEntry) => {
            return entry && 
                   entry.entry && 
                   entry.entry.guid && 
                   entry.entry.title && 
                   entry.postMetadata;
          });
          
          if (validEntries.length > 0) {
            // Process new entries immediately - no useEffect needed
            processNewEntries(validEntries);
          }
        }
      } else {
        setRefreshError(data.error || 'Refresh failed');
      }
    } catch (error) {
      if (isMountedRef.current) {
        setRefreshError(error instanceof Error ? error.message : 'Refresh failed');
      }
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [
    isRefreshing, 
    hasRefreshed,
    currentPostTitles?.length,
    currentFeedUrls?.length,
    getRefreshRequestBody,
    setRefreshing,
    setRefreshError,
    setTotalEntries,
    setPostTitles,
    setHasRefreshed,
    processNewEntries,
    isMountedRef
  ]);

  // Function to handle followed posts updates
  const handleFollowedPostsUpdate = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const FOLLOWED_POSTS_KEY = '/api/rss/followed-posts';
      const cacheKey = `${FOLLOWED_POSTS_KEY}?t=${Date.now()}`;
      
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
    // Clear all error states
    setFetchError(null);
    setRefreshError(null);
    setRefreshing(false);
    setHasRefreshed(false);
    
    // Attempt to refresh immediately
    triggerOneTimeRefresh();
  }, [triggerOneTimeRefresh, setFetchError, setRefreshError, setRefreshing, setHasRefreshed]);

  // Listen for global followed posts changes - this IS external synchronization
  const FOLLOWED_POSTS_KEY = '/api/rss/followed-posts';
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
    // Return computed state
    canRefresh: !isRefreshing && !hasRefreshed && isMountedRef.current,
    getRefreshRequestBody,
  };
}; 