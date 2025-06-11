import { usePostSearchStore } from '@/lib/stores/postSearchStore';

/**
 * Custom hook for post search functionality
 * Provides a clean interface to the post search store
 * Can be used across different post-slug pages (podcasts, newsletters, etc.)
 */
export const usePostSearch = () => {
  const searchQuery = usePostSearchStore((state) => state.searchQuery);
  const setSearchQuery = usePostSearchStore((state) => state.setSearchQuery);
  const reset = usePostSearchStore((state) => state.reset);
  
  return { 
    searchQuery, 
    setSearchQuery,
    reset
  };
}; 