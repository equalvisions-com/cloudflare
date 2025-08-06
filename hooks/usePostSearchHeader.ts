import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePostSearch } from './usePostSearch';
import type { 
  UsePostSearchHeaderProps, 
  UsePostSearchHeaderReturn 
} from '@/lib/types';

/**
 * Custom hook for PostSearchHeader business logic
 * Handles search state, input management, and display logic
 * Separates business logic from UI rendering
 * Optimized with proper memoization for production performance
 */
export const usePostSearchHeader = ({ 
  title, 
  mediaType 
}: UsePostSearchHeaderProps): UsePostSearchHeaderReturn => {
  const [isSearching, setIsSearching] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState("");
  
  const { searchQuery, setSearchQuery } = usePostSearch();
  
  // Format the media type for display - memoized for performance
  const displayText = useMemo(() => {
    return mediaType ? 
      mediaType.charAt(0).toUpperCase() + mediaType.slice(1) : 
      title;
  }, [mediaType, title]);

  // Sync local search value with global search query
  useEffect(() => {
    setLocalSearchValue(searchQuery);
  }, [searchQuery]);

  // Toggle search visibility and reset state
  const toggleSearch = useCallback(() => {
    const newVisibility = !isSearching;
    setIsSearching(newVisibility);
    if (!newVisibility) {
      setSearchQuery("");
      setLocalSearchValue("");
    }
  }, [isSearching, setSearchQuery]);

  // Handle search submission on Enter key
  const handleSearch = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && localSearchValue.trim().length > 0) {
      setSearchQuery(localSearchValue.trim());
    }
  }, [localSearchValue, setSearchQuery]);

  // Handle input value changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchValue(e.target.value);
  }, []);

  // Memoized search placeholder
  const searchPlaceholder = useMemo(() => `Search ${title}`, [title]);

  return {
    isSearching,
    localSearchValue,
    displayText,
    searchPlaceholder,
    toggleSearch,
    handleSearch,
    handleInputChange
  };
}; 