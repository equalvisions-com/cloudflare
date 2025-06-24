"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Id } from '@/convex/_generated/dataModel';
import { BookmarksContextType, BookmarksData } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';

const BookmarksContext = createContext<BookmarksContextType | undefined>(undefined);

interface BookmarksProviderProps {
  children: React.ReactNode;
  userId: Id<"users"> | null;
}

export const BookmarksProvider = React.memo(({ children, userId }: BookmarksProviderProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookmarksData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();
  
  // Refs for cleanup and preventing memory leaks
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount - prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, []);

  // Debounced search function - prevents excessive API calls
  const debouncedSearch = useCallback(async (query: string) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current || !userId) return;

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController
      abortControllerRef.current = new AbortController();
      
      if (!isMountedRef.current) return;
      setIsSearching(true);

      try {
        const response = await fetch(
          `/api/bookmarks/search?query=${encodeURIComponent(query)}`,
          { signal: abortControllerRef.current.signal }
        );

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }

        const data: BookmarksData = await response.json();
        
        // Only update state if component is still mounted and request wasn't aborted
        if (isMountedRef.current && !abortControllerRef.current.signal.aborted) {
          setSearchResults(data);
        }
      } catch (error) {
        // Don't show error for aborted requests or if component unmounted
        if (!isMountedRef.current || (error instanceof Error && error.name === 'AbortError')) {
          return;
        }
        
        console.error('Bookmark search failed:', error);
        toast({
          title: "Search failed",
          description: "Unable to search bookmarks. Please try again.",
          variant: "destructive",
        });
        
        if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
          setSearchResults(null);
        }
      } finally {
        if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300); // 300ms debounce
  }, [userId, toast]);

  const handleSearch = useCallback(async (query: string) => {
    if (!userId) {
      console.error('Unexpected: userId is null on protected route');
      return;
    }

    setSearchQuery(query);

    if (!query.trim()) {
      handleClearSearch();
      return;
    }

    await debouncedSearch(query);
  }, [userId, debouncedSearch]);

  const handleClearSearch = useCallback(() => {
    // Clear debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    // Cancel any ongoing search request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setSearchQuery('');
    setSearchResults(null);
    setIsSearching(false);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo((): BookmarksContextType => ({
    searchQuery,
    searchResults,
    isSearching,
    handleSearch,
    handleClearSearch,
  }), [searchQuery, searchResults, isSearching, handleSearch, handleClearSearch]);

  return (
    <BookmarksContext.Provider value={contextValue}>
      {children}
    </BookmarksContext.Provider>
  );
});

BookmarksProvider.displayName = 'BookmarksProvider';

export const useBookmarksContext = () => {
  const context = useContext(BookmarksContext);
  if (context === undefined) {
    throw new Error('useBookmarksContext must be used within a BookmarksProvider');
  }
  return context;
}; 