import { useCallback, useMemo } from 'react';
import type { RSSEntriesDisplayEntry, RSSItem } from '@/lib/types';

// Interface for post metadata used within the component
interface InternalPostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  categorySlug?: string;
  postSlug?: string;
  verified?: boolean;
}

interface UseRSSEntriesDataLoadingProps {
  isActive: boolean;
  isLoading: boolean;
  isMountedRef: React.MutableRefObject<boolean>;
  hasMoreRef: React.MutableRefObject<boolean>;
  currentPageRef: React.MutableRefObject<number>;
  totalEntriesRef: React.MutableRefObject<number>;
  entriesStateRef: React.MutableRefObject<RSSEntriesDisplayEntry[]>;
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
  pageSize: number;
  setLoading: (loading: boolean) => void;
  setFetchError: (error: Error | null) => void;
  addEntries: (entries: RSSEntriesDisplayEntry[]) => void;
  setCurrentPage: (page: number) => void;
  setHasMore: (hasMore: boolean) => void;
  setTotalEntries: (total: number) => void;
  setPostTitles: (titles: string[]) => void;
}

/**
 * Custom hook for handling data loading and pagination in RSS Entries Display
 * Follows React best practices - returns computed values and functions
 */
export const useRSSEntriesDataLoading = ({
  isActive,
  isLoading,
  isMountedRef,
  hasMoreRef,
  currentPageRef,
  totalEntriesRef,
  entriesStateRef,
  postTitlesRef,
  feedMetadataCache,
  initialData,
  pageSize,
  setLoading,
  setFetchError,
  addEntries,
  setCurrentPage,
  setHasMore,
  setTotalEntries,
  setPostTitles,
}: UseRSSEntriesDataLoadingProps) => {
  
  // Compute API parameters dynamically - no memoization needed since it's used only in loadMoreEntries
  const getApiParams = useCallback(() => {
    const postTitlesParam = JSON.stringify(postTitlesRef.current);
    const feedUrlsParam = JSON.stringify(initialData?.feedUrls || []);
    const currentEntriesCount = entriesStateRef.current.length;
    
    return {
      postTitlesParam,
      feedUrlsParam,
      currentEntriesCount,
      totalEntries: totalEntriesRef.current,
    };
  }, [postTitlesRef, initialData?.feedUrls, entriesStateRef, totalEntriesRef]);

  // Transform entries helper - pure function
  const transformEntries = useCallback((entries: RSSItem[]) => {
    return entries
      .filter(Boolean)
      .map((entry: RSSItem) => {
        if (entry && 'guid' in entry && entry.guid) {
          const feedUrl = 'feedUrl' in entry ? entry.feedUrl : '';
          
          // Get cached metadata or create new
          let existingMetadata = feedMetadataCache.current[feedUrl];
          
          if (!existingMetadata && initialData?.entries) {
            const matchingEntry = initialData.entries.find(
              e => e?.entry?.feedUrl === feedUrl
            );
            
            if (matchingEntry?.postMetadata) {
              existingMetadata = matchingEntry.postMetadata;
              feedMetadataCache.current[feedUrl] = existingMetadata;
            }
          }
          
          const entryTitle = entry.title || '';
          const feedTitle = (entry as any).feedTitle || '';
          
          const finalMetadata = existingMetadata || {
            title: feedTitle || entryTitle || '',
            featuredImg: entry.image || '',
            mediaType: entry.mediaType || '',
            categorySlug: '',
            postSlug: '',
            verified: false
          };
          
          if (feedUrl) {
            feedMetadataCache.current[feedUrl] = finalMetadata;
          }
          
          return {
            entry: entry,
            initialData: {
              likes: { isLiked: false, count: 0 },
              comments: { count: 0 },
              retweets: { isRetweeted: false, count: 0 },
              bookmarks: { isBookmarked: false }
            },
            postMetadata: finalMetadata
          } as RSSEntriesDisplayEntry;
        }
        
        return null;
      })
      .filter(Boolean) as RSSEntriesDisplayEntry[];
  }, [feedMetadataCache, initialData?.entries]);
  
  // Function to load more entries
  const loadMoreEntries = useCallback(async () => {
    // Guard clauses - early returns for invalid states
    if (!isActive || isLoading || !hasMoreRef.current || !isMountedRef.current) {
      return;
    }
    
    setLoading(true);
    
    try {
      const baseUrl = new URL('/api/rss/paginate', window.location.origin);
      const nextPage = currentPageRef.current + 1;
      
      // Get fresh API parameters with current entries count
      const apiParams = getApiParams();
      
      // Set URL parameters
      baseUrl.searchParams.set('page', nextPage.toString());
      baseUrl.searchParams.set('pageSize', pageSize.toString());
      baseUrl.searchParams.set('postTitles', apiParams.postTitlesParam);
      baseUrl.searchParams.set('currentEntriesCount', apiParams.currentEntriesCount.toString());
      baseUrl.searchParams.set('t', Date.now().toString());
      
      if (initialData?.feedUrls?.length) {
        baseUrl.searchParams.set('feedUrls', apiParams.feedUrlsParam);
      }
      
      if (apiParams.totalEntries > 0) {
        baseUrl.searchParams.set('totalEntries', apiParams.totalEntries.toString());
      }
      
      const response = await fetch(baseUrl.toString());
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Only update if component is still mounted
      if (!isMountedRef.current) return;
      
      // Transform and append entries - FIXED: Use addEntries instead of setEntries
      const transformedEntries = transformEntries(data.entries);
      
      // CRITICAL FIX: Use addEntries to append, not setEntries to replace
      // This matches the working pattern in RSSFeedClient
      addEntries(transformedEntries);
      setCurrentPage(nextPage);
      setHasMore(data.hasMore);
      
      if (data.totalEntries && data.totalEntries !== totalEntriesRef.current) {
        setTotalEntries(data.totalEntries);
      }
      
      if (data.postTitles?.length) {
        setPostTitles(data.postTitles);
      }
      
    } catch (error) {
      if (isMountedRef.current) {
        setFetchError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [
    isActive,
    isLoading,
    pageSize,
    getApiParams,
    initialData?.feedUrls,
    transformEntries,
    setLoading,
    setFetchError,
    addEntries,
    setCurrentPage,
    setHasMore,
    setTotalEntries,
    setPostTitles,
    hasMoreRef,
    currentPageRef,
    totalEntriesRef,
    entriesStateRef,
    isMountedRef
  ]);

  return {
    loadMoreEntries,
    // Return computed values for parent to use
    canLoadMore: isActive && !isLoading && hasMoreRef.current,
    getApiParams,
  };
}; 