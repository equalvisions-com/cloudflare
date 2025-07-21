import { useCallback, useRef, useEffect } from 'react';
import type { 
  RSSEntriesDisplayEntry
} from '@/lib/types';

interface UseRSSEntriesInitializationProps {
  hasInitialized: boolean;
  isMountedRef: React.MutableRefObject<boolean>;
  preRefreshNewestEntryDateRef: React.MutableRefObject<string | undefined>;
  entriesStateRef: React.MutableRefObject<RSSEntriesDisplayEntry[]>;
  currentPageRef: React.MutableRefObject<number>;
  hasMoreRef: React.MutableRefObject<boolean>;
  totalEntriesRef: React.MutableRefObject<number>;
  postTitlesRef: React.MutableRefObject<string[]>;
  feedMetadataCache: React.MutableRefObject<Record<string, RSSEntriesDisplayEntry['postMetadata']>>;
  initialData?: {
    entries: RSSEntriesDisplayEntry[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
    feedUrls?: string[];
    mediaTypes?: string[];
  };
  initialize: (data: {
    entries: RSSEntriesDisplayEntry[];
    totalEntries: number;
    hasMore: boolean;
    postTitles: string[];
    feedUrls: string[];
    mediaTypes: string[];
  }) => void;
}

interface UseRSSEntriesInitializationReturn {
  canInitialize: boolean;
  performInitialization: () => void;
  isBfCacheRestoration: boolean;
}

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



/**
 * Custom hook for handling RSS entries initialization
 * Manages the initial data setup and determines when initialization should occur
 * Enhanced with bfcache support for proper restoration
 */
export const useRSSEntriesInitialization = ({
  hasInitialized,
  isMountedRef,
  preRefreshNewestEntryDateRef,
  entriesStateRef,
  currentPageRef,
  hasMoreRef,
  totalEntriesRef,
  postTitlesRef,
  feedMetadataCache,
  initialData,
  initialize,
}: UseRSSEntriesInitializationProps): UseRSSEntriesInitializationReturn => {
  
  // bfcache detection and tracking
  const isBfCacheRestorationRef = useRef(false);
  const pageShowHandledRef = useRef(false);

  // Detect bfcache restoration
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !pageShowHandledRef.current) {
        // Page restored from bfcache
        isBfCacheRestorationRef.current = true;
        pageShowHandledRef.current = true;
        
        // Reset initialization flag to force re-initialization
        if (hasInitialized) {
          // Clear current state to force fresh initialization
          entriesStateRef.current = [];
          currentPageRef.current = 1;
          hasMoreRef.current = true;
          totalEntriesRef.current = 0;
          postTitlesRef.current = [];
          feedMetadataCache.current = {};
          preRefreshNewestEntryDateRef.current = undefined;
        }
        
        // Reset bfcache flag after processing
        setTimeout(() => {
          isBfCacheRestorationRef.current = false;
          pageShowHandledRef.current = false;
        }, 1000);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [hasInitialized, entriesStateRef, currentPageRef, hasMoreRef, totalEntriesRef, postTitlesRef, feedMetadataCache, preRefreshNewestEntryDateRef]);

  // Determine if initialization should occur
  const canInitialize = !hasInitialized || isBfCacheRestorationRef.current;

  // Process metadata cache from initial data
  const processMetadataCache = useCallback(() => {
    if (!initialData?.entries) return;
    
    // Build metadata cache from initial data
    const cache: Record<string, any> = {};
    initialData.entries.forEach((entry: RSSEntriesDisplayEntry) => {
      if (entry?.entry?.feedUrl && entry?.postMetadata) {
        cache[entry.entry.feedUrl] = entry.postMetadata;
      }
    });
    
    feedMetadataCache.current = { ...feedMetadataCache.current, ...cache };
  }, [initialData?.entries, feedMetadataCache]);

  // Perform initialization with enhanced bfcache support
  const performInitialization = useCallback(() => {
    if (!canInitialize || !isMountedRef.current || !initialData) return;

    try {
      // Process metadata cache first
      processMetadataCache();

      // Validate initial data structure
      const entries = initialData.entries || [];
      const totalEntries = initialData.totalEntries || entries.length;
      const hasMore = initialData.hasMore ?? (entries.length < totalEntries);
      const postTitles = initialData.postTitles || [];
      const feedUrls = initialData.feedUrls || [];
      const mediaTypes = initialData.mediaTypes || [];

      // Set pre-refresh newest entry date for refresh logic
      if (entries.length > 0) {
        const sortedEntries = [...entries].sort((a, b) => {
          const dateA = new Date(a.entry.pubDate).getTime();
          const dateB = new Date(b.entry.pubDate).getTime();
          return dateB - dateA; // Newest first
        });
        
        if (sortedEntries[0]) {
          preRefreshNewestEntryDateRef.current = sortedEntries[0].entry.pubDate;
        }
      }

      // Update all refs with initialized data
      entriesStateRef.current = entries;
      currentPageRef.current = 1;
      hasMoreRef.current = hasMore;
      totalEntriesRef.current = totalEntries;
      postTitlesRef.current = postTitles;

      // Initialize the component state via callback
      initialize({
        entries,
        totalEntries,
        hasMore,
        postTitles,
        feedUrls,
        mediaTypes
      });

    } catch (error) {
      console.error('RSS Entries Initialization Error:', error);
      // Initialize with empty state if there's an error
      initialize({
        entries: [],
        totalEntries: 0,
        hasMore: false,
        postTitles: [],
        feedUrls: [],
        mediaTypes: []
      });
    }
  }, [
    canInitialize,
    isMountedRef,
    initialData,
    processMetadataCache,
    entriesStateRef,
    currentPageRef,
    hasMoreRef,
    totalEntriesRef,
    postTitlesRef,
    preRefreshNewestEntryDateRef,
    initialize
  ]);

  return {
    canInitialize,
    performInitialization,
    isBfCacheRestoration: isBfCacheRestorationRef.current
  };
}; 