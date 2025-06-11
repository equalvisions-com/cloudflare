import { useMemo } from 'react';
import { usePostSearch } from './usePostSearch';
import type { NewsletterPostTabsWrapperWithSearchProps } from '@/lib/types';

/**
 * Custom hook for Newsletter PostTabsWrapperWithSearch UI logic
 * Handles the decision logic for which component to render
 * Separates UI concerns from business logic
 * Newsletter-specific version that works with NewsletterPostTabsWrapperWithSearchProps
 */
export const useNewsletterPostTabsUI = (props: NewsletterPostTabsWrapperWithSearchProps) => {
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