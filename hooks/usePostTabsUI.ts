import { useMemo } from 'react';
import { usePostSearch } from './usePostSearch';
import type { PostTabsWrapperWithSearchProps } from '@/lib/types';

/**
 * Custom hook for PostTabsWrapperWithSearch UI logic
 * Handles the decision logic for which component to render
 * Separates UI concerns from business logic
 */
export const usePostTabsUI = (props: PostTabsWrapperWithSearchProps) => {
  const { searchQuery } = usePostSearch();
  
  // Determine if we should show search results or default content
  const shouldShowSearchResults = useMemo(() => {
    return searchQuery && searchQuery.trim().length > 0;
  }, [searchQuery]);
  
  // Prepare props for search component
  const searchProps = useMemo(() => ({
    postTitle: props.postTitle,
    feedUrl: props.feedUrl,
    searchQuery: searchQuery || '',
    featuredImg: props.featuredImg,
    mediaType: props.mediaType,
    verified: props.verified
  }), [props, searchQuery]);
  
  // Prepare props for default component
  const defaultProps = useMemo(() => ({
    postTitle: props.postTitle,
    feedUrl: props.feedUrl,
    rssData: props.rssData,
    featuredImg: props.featuredImg,
    mediaType: props.mediaType,
    verified: props.verified
  }), [props]);
  
  return {
    shouldShowSearchResults,
    searchProps,
    defaultProps
  };
}; 