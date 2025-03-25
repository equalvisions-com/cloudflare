'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PeopleDisplay } from '@/components/ui/PeopleDisplay';
import { SearchInput } from '@/components/ui/search-input';
import { Users, Loader2 } from 'lucide-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function PeopleSearchWrapper() {
  const insets = useSafeAreaInsets();
  
  // State for search query
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Debounce timeout ref
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Check for search query in sessionStorage on mount
  useEffect(() => {
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
  }, []);
  
  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPendingSearchQuery(value);
    
    // Only set searching if we have a value
    if (value.trim()) {
      setIsSearching(true);
    } else {
      // If search is cleared, immediately update searchQuery and reset state
      if (searchQuery) {
        setSearchQuery('');
        setIsSearching(false);
      }
    }
  }, [searchQuery]);

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    // Clear both queries
    setPendingSearchQuery('');
    setSearchQuery('');
    setIsSearching(false);
    
    // Clear any pending debounce
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = null;
    }
  }, []);

  // Handle search submission
  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Hide keyboard by blurring active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Clear any pending debounce
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = null;
    }
    
    // If we have a query, set it
    if (pendingSearchQuery.trim()) {
      setSearchQuery(pendingSearchQuery);
      setIsSearching(true);
    } else {
      setSearchQuery('');
      setIsSearching(false);
    }
  }, [pendingSearchQuery]);

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
  }, [handleSearchClear, pendingSearchQuery]);

  // Effect to auto-search after debounce (only for non-empty queries)
  useEffect(() => {
    // Clear any existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Don't debounce if no query or query is same as current
    if (!pendingSearchQuery.trim() || pendingSearchQuery === searchQuery) {
      return;
    }
    
    // Set new timeout for debounced search
    debounceTimeout.current = setTimeout(() => {
      if (pendingSearchQuery.trim()) {
        setSearchQuery(pendingSearchQuery);
      }
    }, 500);
    
    // Cleanup on unmount
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [pendingSearchQuery, searchQuery]);

  return (
    <div className="space-y-0">
      {/* Search input */}
      <div 
        className="sticky top-0 z-10 bg-background border-b p-4"
        style={{
          paddingTop: Math.max(16, insets.top || 0), // Minimum padding of 16px (4 in tailwind)
        }}
      >
        <form onSubmit={handleSearchSubmit} className="relative">
          <SearchInput
            value={pendingSearchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onClear={handleSearchClear}
            placeholder="Search for people..."
            className="w-full"
          />
        </form>
      </div>
      
      {/* Display empty state when no search is active */}
      {!isSearching && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">Find People</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Search for people by their username, name, or bio to connect with them
          </p>
        </div>
      )}
      
      {/* Loading state when search is in progress but query has not been set yet */}
      {isSearching && !searchQuery && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {/* People Display - only show when there's a search query */}
      {searchQuery && (
        <PeopleDisplay 
          searchQuery={searchQuery}
          className="mt-2"
        />
      )}
    </div>
  );
} 