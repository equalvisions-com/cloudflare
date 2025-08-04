import { usePostSearchContext } from '@/lib/contexts/PostSearchContext';

/**
 * Custom hook for post search functionality
 * Provides a clean interface to the post search context
 * Can be used across different post-slug pages (podcasts, newsletters, etc.)
 * 
 * Migrated from Zustand to React Context + useReducer for better React/Next.js practices
 */
export const usePostSearch = () => {
  const { state, actions } = usePostSearchContext();
  
  return { 
    searchQuery: state.searchQuery, 
    setSearchQuery: actions.setSearchQuery,
    reset: actions.reset
  };
}; 