import { useCallback, useRef, useEffect } from 'react';
import { useSearchResultsContext } from '@/lib/contexts/SearchResultsContext';
import type { PostSearchRSSData } from '@/lib/types';

interface UseSearchResultsProps {
  postTitle: string;
  feedUrl: string;
  searchQuery: string;
  mediaType?: string;
}

export const useSearchResults = ({ 
  postTitle, 
  feedUrl, 
  searchQuery, 
  mediaType 
}: UseSearchResultsProps) => {
  const { state, actions } = useSearchResultsContext();
  const {
    searchData,
    isLoading,
    currentPage,
  } = state;
  const {
    setSearchData,
    setIsLoading,
    setCurrentPage,
    appendSearchData,
    reset
  } = actions;

  // Use refs to track current values for callbacks
  const currentPageRef = useRef(currentPage);
  const isLoadingRef = useRef(isLoading);
  
  // Update refs synchronously during render (React best practice)
  currentPageRef.current = currentPage;
  isLoadingRef.current = isLoading;

  // Fetch initial search results
  const fetchInitialSearchResults = useCallback(async () => {
    if (!searchQuery || !postTitle || !feedUrl) {
      // Skip setting null if searchData is already null/empty to prevent redundant updates
      if (searchData !== null && searchData?.entries?.length !== 0) {
        setSearchData(null);
      }
      return;
    }
    
    setIsLoading(true);
    setCurrentPage(1);
    
    try {
      const apiUrl = `/api/rss/${encodeURIComponent(postTitle)}?feedUrl=${encodeURIComponent(feedUrl)}&q=${encodeURIComponent(searchQuery)}&page=1&pageSize=30${mediaType ? `&mediaType=${encodeURIComponent(mediaType)}` : ''}`;
      
      const result = await fetch(apiUrl);
      
      if (!result.ok) {
        throw new Error(`Search API error: ${result.status}`);
      }
      
      const data = await result.json();
      
      // Transform the API response to match our expected format
      const transformedData: PostSearchRSSData = {
        entries: data.entries || [],
        totalEntries: data.totalEntries || 0,
        hasMore: data.hasMore ?? false
      };
      
      setSearchData(transformedData);
    } catch (error) {
      // Error logging removed for production readiness
      setSearchData(null);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, postTitle, feedUrl, mediaType, searchData, setSearchData, setIsLoading, setCurrentPage]);

  // Load more search results for pagination
  const loadMoreSearchResults = useCallback(async () => {
    const currentPageValue = currentPageRef.current;
    const isLoadingValue = isLoadingRef.current;
    
    // Use current state directly since we're in React Context
    const currentSearchData = searchData;
    
    if (isLoadingValue || !currentSearchData?.hasMore) {
      return;
    }
    
    setIsLoading(true);
    const nextPage = currentPageValue + 1;
    
    try {
      const apiUrl = `/api/rss/${encodeURIComponent(postTitle)}?feedUrl=${encodeURIComponent(feedUrl)}&q=${encodeURIComponent(searchQuery)}&page=${nextPage}&pageSize=30${mediaType ? `&mediaType=${encodeURIComponent(mediaType)}` : ''}&totalEntries=${currentSearchData.totalEntries}`;
      
      const result = await fetch(apiUrl);
      
      if (!result.ok) {
        throw new Error(`Search pagination API error: ${result.status}`);
      }
      
      const data = await result.json();
      
      if (data.entries?.length) {
        const newData: PostSearchRSSData = {
          entries: data.entries,
          totalEntries: data.totalEntries || currentSearchData.totalEntries,
          hasMore: data.hasMore ?? false
        };
        
        appendSearchData(newData);
        setCurrentPage(nextPage);
      }
    } catch (error) {
      // Error logging removed for production readiness
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, postTitle, feedUrl, mediaType, appendSearchData, setCurrentPage, setIsLoading]);

  // Reset search results when search query changes
  useEffect(() => {
    fetchInitialSearchResults();
  }, [fetchInitialSearchResults]);

  // Removed cleanup useEffect - let store persist across component lifecycles
  // Store will be reset when search query changes or manually reset

  return {
    searchData,
    isLoading,
    loadMoreSearchResults
  };
}; 