'use client';

import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { PeopleDisplay } from '@/components/ui/PeopleDisplay';
import { SearchInput } from '@/components/ui/search-input';
import { Users, Loader2 } from 'lucide-react';
import { UserMenuClientWithErrorBoundary } from '@/components/user-menu/UserMenuClient';
import { useSidebar } from '@/components/ui/sidebar-context';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { cn } from '@/lib/utils';

// Component to display random users
const RandomPeopleDisplay = memo(() => {
  const randomUsersResult = useQuery(api.users.getRandomUsers, { limit: 10 });
  
  if (!randomUsersResult || !randomUsersResult.users) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  return (
    <PeopleDisplay 
      initialUsers={randomUsersResult.users}
      className=""
    />
  );
});

RandomPeopleDisplay.displayName = 'RandomPeopleDisplay';

export function PeopleSearchWrapper() {
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount, isAuthenticated } = useSidebar();
  // State for search query
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  
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
    
    // If search is cleared, immediately reset state
    if (!value.trim() && searchQuery) {
      setSearchQuery('');
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    // Clear both queries
    setPendingSearchQuery('');
    setSearchQuery('');
    setIsSearching(false);
  }, []);

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

  return (
    <div className="space-y-0">
      {/* Search input */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-2 md:py-4">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-3.5">
          {isAuthenticated && (
            <div className="flex-shrink-0 md:hidden">
              <UserMenuClientWithErrorBoundary
                initialDisplayName={displayName}
                initialProfileImage={profileImage}
                isBoarded={isBoarded}
                pendingFriendRequestCount={pendingFriendRequestCount}
              />
            </div>
          )}
          <div className={cn(
            "min-w-0", 
            isAuthenticated ? "flex-1" : "w-full" // Full width if not authenticated
          )}>
            <SearchInput
              value={pendingSearchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              onClear={handleSearchClear}
              placeholder="Search Users..."
              className="w-full"
            />
          </div>
        </form>
      </div>
      
      {/* Display random users when no search is active */}
      {!isSearching && (
        <div>
          <RandomPeopleDisplay />
        </div>
      )}
      
      {/* Loading state when search is in progress but query has not been set yet */}
      {isSearching && !searchQuery && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      
      {/* People Display - only show when there's a search query */}
      {searchQuery && (
        <PeopleDisplay 
          searchQuery={searchQuery}
          className=""
        />
      )}
    </div>
  );
} 