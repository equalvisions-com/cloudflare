import { useCallback } from 'react';
import { Id } from '@/convex/_generated/dataModel';
import { useBookmarkStore } from '@/lib/stores/bookmarkStore';
import { BookmarksData } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';

export const useBookmarkActions = (userId: Id<"users"> | null) => {
  const { search, loading, setLoading, setSearchQuery, setSearchResults, clearSearch } = useBookmarkStore();
  const { toast } = useToast();

  const handleSearch = useCallback(async (query: string) => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please log in to search bookmarks",
        variant: "destructive",
      });
      return;
    }

    setSearchQuery(query);

    if (!query.trim()) {
      clearSearch();
      return;
    }

    setLoading({ isSearching: true });

    try {
      const response = await fetch(
        `/api/bookmarks/search?userId=${userId}&query=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data: BookmarksData = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: "Unable to search bookmarks. Please try again.",
        variant: "destructive",
      });
      setSearchResults(null);
    } finally {
      setLoading({ isSearching: false });
    }
  }, [userId, setSearchQuery, setSearchResults, clearSearch, setLoading, toast]);

  const handleClearSearch = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  const handleOpenCommentDrawer = useCallback((
    entryGuid: string, 
    feedUrl: string, 
    initialData?: { count: number }
  ) => {
    // This will be handled by the component that uses this hook
    // We return the data for the component to handle
    return { entryGuid, feedUrl, initialData };
  }, []);

  return {
    // State
    searchQuery: search.query,
    searchResults: search.results,
    isSearching: loading.isSearching,
    isLoading: loading.isLoading,
    
    // Actions
    handleSearch,
    handleClearSearch,
    handleOpenCommentDrawer,
  };
}; 