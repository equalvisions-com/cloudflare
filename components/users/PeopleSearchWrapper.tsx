'use client';

import React, { useEffect, memo, useMemo } from 'react';
import { PeopleDisplay } from '@/components/ui/PeopleDisplay';
import { SearchInput } from '@/components/ui/search-input';
import { Users, Loader2 } from 'lucide-react';
import { UserMenuClientWithErrorBoundary } from '@/components/user-menu/UserMenuClient';
import { useSidebar } from '@/components/ui/sidebar-context';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { cn } from '@/lib/utils';
import { useUsersActions } from '@/lib/hooks/useUsersActions';
import { UsersListSkeleton } from '@/components/users/UsersSkeleton';

// Memoized component to display random users with skeleton fallback
const RandomPeopleDisplay = memo(() => {
  const randomUsersResult = useQuery(api.users.getRandomUsers, { limit: 10 });
  
  // Show skeleton while loading
  if (!randomUsersResult || !randomUsersResult.users) {
    return <UsersListSkeleton count={6} />;
  }
  
  return (
    <PeopleDisplay 
      initialUsers={randomUsersResult.users}
      className=""
    />
  );
});

RandomPeopleDisplay.displayName = 'RandomPeopleDisplay';

// Memoized search form component
const SearchForm = memo<{
  pendingSearchQuery: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
  isAuthenticated: boolean;
  displayName: string | null | undefined;
  profileImage: string | null | undefined;
  isBoarded: boolean;
  pendingFriendRequestCount: number;
}>(({ 
  pendingSearchQuery, 
  onSubmit, 
  onChange, 
  onKeyDown, 
  onClear, 
  isAuthenticated,
  displayName,
  profileImage,
  isBoarded,
  pendingFriendRequestCount
}) => (
  <div className="sticky top-0 z-10 bg-background border-b px-4 py-2 md:py-4">
    <form onSubmit={onSubmit} className="relative flex items-center gap-3.5">
      {isAuthenticated && (
        <div className="flex-shrink-0 md:hidden">
          <UserMenuClientWithErrorBoundary
            initialDisplayName={displayName || undefined}
            initialProfileImage={profileImage || undefined}
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
          onChange={onChange}
          onKeyDown={onKeyDown}
          onClear={onClear}
          placeholder="Search Users..."
          className="w-full"
        />
      </div>
    </form>
  </div>
));

SearchForm.displayName = 'SearchForm';

// Main component
const PeopleSearchWrapper = memo(() => {
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount, isAuthenticated } = useSidebar();
  
  const {
    searchQuery,
    pendingSearchQuery,
    isSearching,
    handleSearchChange,
    handleSearchClear,
    handleSearchSubmit,
    handleKeyDown,
    initializeFromSessionStorage,
  } = useUsersActions();

  // Initialize from session storage on mount (only useEffect needed)
  useEffect(() => {
    initializeFromSessionStorage();
  }, [initializeFromSessionStorage]);

  // Memoized sidebar props
  const sidebarProps = useMemo(() => ({
    isAuthenticated,
    displayName,
    profileImage,
    isBoarded,
    pendingFriendRequestCount,
  }), [isAuthenticated, displayName, profileImage, isBoarded, pendingFriendRequestCount]);

  return (
    <div className="space-y-0">
      {/* Search input */}
      <SearchForm
        pendingSearchQuery={pendingSearchQuery}
        onSubmit={handleSearchSubmit}
        onChange={handleSearchChange}
        onKeyDown={handleKeyDown}
        onClear={handleSearchClear}
        {...sidebarProps}
      />
      
      {/* Display random users when no search is active */}
      {!isSearching && (
        <div>
          <RandomPeopleDisplay />
        </div>
      )}
      
      {/* Show skeleton while search is in progress but query has not been set yet */}
      {isSearching && !searchQuery && (
        <UsersListSkeleton count={6} />
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
});

PeopleSearchWrapper.displayName = 'PeopleSearchWrapper';

export { PeopleSearchWrapper }; 