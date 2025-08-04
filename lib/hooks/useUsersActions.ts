import { useCallback } from 'react';
import { useUsersContext } from '@/lib/contexts/UsersContext';

export const useUsersActions = () => {
  const {
    searchQuery,
    pendingSearchQuery,
    isSearching,
    setSearchQuery,
    setPendingSearchQuery,
    setIsSearching,
    resetSearch,
  } = useUsersContext();

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPendingSearchQuery(value);
    
    // If search is cleared, immediately reset state
    if (!value.trim() && searchQuery) {
      setSearchQuery('');
      setIsSearching(false);
    }
  }, [searchQuery, setPendingSearchQuery, setSearchQuery, setIsSearching]);

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    // Clear both queries
    setPendingSearchQuery('');
    setSearchQuery('');
    setIsSearching(false);
  }, [setPendingSearchQuery, setSearchQuery, setIsSearching]);

  // Handle search submission
  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Hide keyboard by blurring active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // If we have a query, set it
    if (pendingSearchQuery.trim()) {
      setSearchQuery(pendingSearchQuery);
      setIsSearching(true);
    } else {
      setSearchQuery('');
      setIsSearching(false);
    }
  }, [pendingSearchQuery, setSearchQuery, setIsSearching]);

  // Handle key press for search input
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleSearchClear();
    } else if (e.key === 'Enter') {
      // If Enter key pressed, immediately submit search
      if (pendingSearchQuery.trim()) {
        setSearchQuery(pendingSearchQuery);
        setIsSearching(true);
      }
    }
  }, [handleSearchClear, pendingSearchQuery, setSearchQuery, setIsSearching]);

  // Initialize search from session storage
  const initializeFromSessionStorage = useCallback(() => {
    // Get search query from sessionStorage
    const storedQuery = sessionStorage.getItem('app_search_query');
    const storedTimestamp = sessionStorage.getItem('app_search_timestamp');
    const storedMediaType = sessionStorage.getItem('app_search_mediaType');
    
    // Only use the stored query if it's recent (within last 5 seconds)
    // and if mediaType is specifically 'people'
    if (storedQuery && storedTimestamp && storedMediaType === 'people') {
      const timestamp = parseInt(storedTimestamp, 10);
      const now = Date.now();
      const isFresh = now - timestamp < 5000; // 5 seconds
      
      if (isFresh) {
        setPendingSearchQuery(storedQuery);
        setSearchQuery(storedQuery);
        setIsSearching(true);
        
        // Clear the timestamp to prevent re-triggering on page refresh
        sessionStorage.removeItem('app_search_timestamp');
      }
    }
  }, [setPendingSearchQuery, setSearchQuery, setIsSearching]);

  return {
    // State
    searchQuery,
    pendingSearchQuery,
    isSearching,
    
    // Actions
    handleSearchChange,
    handleSearchClear,
    handleSearchSubmit,
    handleKeyDown,
    initializeFromSessionStorage,
    resetSearch,
  };
}; 