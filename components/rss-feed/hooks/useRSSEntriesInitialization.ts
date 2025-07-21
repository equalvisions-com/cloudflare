import { useCallback, useMemo } from 'react';
import type { RSSEntriesDisplayEntry, RSSItem, InternalPostMetadata } from '@/lib/types';

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

/**
 * Custom hook for handling component initialization in RSS Entries Display
 * Follows React best practices - returns computed values and functions
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
}: UseRSSEntriesInitializationProps) => {

  // Compute initialization data - derived state
  const initializationData = useMemo(() => {
    if (!initialData?.entries?.length) {
      return null;
    }

    // Process entries and extract metadata
    const processedEntries: RSSEntriesDisplayEntry[] = [];
    const extractedPostTitles: string[] = [];
    const extractedFeedUrls: string[] = [];
    const extractedMediaTypes: string[] = [];

    initialData.entries.forEach(entryWithData => {
      if (entryWithData?.entry && entryWithData.postMetadata) {
        processedEntries.push(entryWithData);
        
        // Extract metadata
        const { title, mediaType } = entryWithData.postMetadata;
        const feedUrl = entryWithData.entry.feedUrl || '';
        
        if (title && !extractedPostTitles.includes(title)) {
          extractedPostTitles.push(title);
        }
        
        if (feedUrl && !extractedFeedUrls.includes(feedUrl)) {
          extractedFeedUrls.push(feedUrl);
        }
        
        if (mediaType && !extractedMediaTypes.includes(mediaType)) {
          extractedMediaTypes.push(mediaType);
        }
        
        // Cache metadata
        if (feedUrl) {
          feedMetadataCache.current[feedUrl] = entryWithData.postMetadata;
        }
      }
    });

    // Find newest entry date for refresh tracking
    let newestEntryDate: string | undefined;
    if (processedEntries.length > 0) {
      try {
        const newestEntry = processedEntries[0];
        if (newestEntry?.entry?.pubDate) {
          const parsedDate = parseEntryDate(newestEntry.entry.pubDate);
          newestEntryDate = formatDateForAPI(parsedDate);
        }
              } catch (error) {
          // Error is handled gracefully - no console output in production
        }
    }

    return {
      entries: processedEntries,
      totalEntries: initialData.totalEntries || processedEntries.length,
      hasMore: initialData.hasMore ?? true,
      postTitles: initialData.postTitles || extractedPostTitles,
      feedUrls: initialData.feedUrls || extractedFeedUrls,
      mediaTypes: initialData.mediaTypes || extractedMediaTypes,
      newestEntryDate,
    };
  }, [initialData, feedMetadataCache]);

  // Function to perform initialization
  const performInitialization = useCallback(() => {
    if (hasInitialized || !initializationData || !isMountedRef.current) {
      return;
    }

    try {
      // Update refs first
      entriesStateRef.current = initializationData.entries;
      currentPageRef.current = 1;
      hasMoreRef.current = initializationData.hasMore;
      totalEntriesRef.current = initializationData.totalEntries;
      postTitlesRef.current = initializationData.postTitles;
      
      if (initializationData.newestEntryDate) {
        preRefreshNewestEntryDateRef.current = initializationData.newestEntryDate;
      }

      // Initialize store state
      initialize(initializationData);
          } catch (error) {
        // Error is handled gracefully - no console output in production
      }
  }, [
    hasInitialized,
    initializationData,
    isMountedRef,
    entriesStateRef,
    currentPageRef,
    hasMoreRef,
    totalEntriesRef,
    postTitlesRef,
    preRefreshNewestEntryDateRef,
    initialize
  ]);

  return {
    performInitialization,
    // Return computed state
    canInitialize: !hasInitialized && !!initializationData && isMountedRef.current,
    initializationData,
  };
}; 