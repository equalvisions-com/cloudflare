"use client";

import { useState, KeyboardEvent, useCallback, memo, useEffect, useRef } from "react";
import { BookmarkSearchButton } from "@/components/ui/BookmarkSearchButton";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenuClientWithErrorBoundary } from "@/components/user-menu/UserMenuClient";
import { useSidebar } from "@/components/ui/sidebar-context";
import { BackButton } from "@/components/back-button";
import { useBookmarksContext } from "./BookmarksContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Enterprise-level error boundary fallback for search section
const SearchErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
  <div className="flex items-center justify-center p-2">
    <button
      onClick={retry}
      className="text-sm text-muted-foreground hover:text-foreground"
      aria-label="Retry search"
    >
      Search unavailable - Retry
    </button>
  </div>
);

// Performance optimization: Memoized search input component
const SearchInput = memo(({ 
  value, 
  onChange, 
  onKeyDown, 
  onClose, 
  isSearching 
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
  isSearching?: boolean;
}) => (
  <div className="flex-1 relative">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
      <Input
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder="Search Bookmarks..."
        className={cn(
          "pl-9 pr-10 h-9 w-full focus-visible:ring-0 rounded-full border shadow-none",
          isSearching && "opacity-75"
        )}
        autoFocus
        aria-label="Search bookmarks - press Enter to search"
        aria-describedby="search-status"
      />
      <button
        onClick={onClose}
        className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none hover:opacity-75 transition-opacity"
        aria-label="Close search"
        type="button"
      >
        <X className="h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
      </button>
      {isSearching && (
        <div id="search-status" className="sr-only" aria-live="polite">
          Searching bookmarks...
        </div>
      )}
    </div>
  </div>
));

SearchInput.displayName = 'SearchInput';

// Performance optimization: Memoized header navigation
const HeaderNavigation = memo(({ 
  displayName, 
  profileImage, 
  isBoarded, 
  pendingFriendRequestCount, 
  onSearchToggle 
}: {
  displayName: string;
  profileImage?: string;
  isBoarded: boolean;
  pendingFriendRequestCount: number;
  onSearchToggle: () => void;
}) => (
  <>
    <div className="w-10 flex items-start justify-start">
      <div className="md:hidden">
        <UserMenuClientWithErrorBoundary />
      </div>
      <div className="hidden md:block h-[36px]">
        <BackButton />
      </div>
    </div>
    <div className="flex-1 flex justify-center text-base font-extrabold tracking-tight">
      Bookmarks
    </div>
    <div className="w-10 flex justify-end">
      <BookmarkSearchButton onClick={onSearchToggle} />
    </div>
  </>
));

HeaderNavigation.displayName = 'HeaderNavigation';

const BookmarksHeaderComponent = () => {
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount } = useSidebar();
  const [isSearchInputVisible, setIsSearchInputVisible] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState("");
  
  // Performance optimization: Request deduplication
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);
  const lastSearchQueryRef = useRef<string>("");

  const { searchQuery, handleSearch, handleClearSearch, isSearching } = useBookmarksContext();

  // 1. State Management Synchronization Fix
  useEffect(() => {
    // Sync local state with context state when context changes
    if (searchQuery !== lastSearchQueryRef.current) {
      setLocalSearchValue(searchQuery);
      lastSearchQueryRef.current = searchQuery;
    }
  }, [searchQuery]);

  // 2. Memory Leak Prevention
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Clear any pending search operations
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = undefined;
      }
      
      // Cleanup local state
      setLocalSearchValue("");
      setIsSearchInputVisible(false);
    };
  }, []);

  const toggleSearchVisibility = useCallback(() => {
    if (!isMountedRef.current) return;

    if (isSearchInputVisible) {
      // Closing search - clear everything
      setLocalSearchValue("");
      handleClearSearch();
      // Clear any pending search
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = undefined;
      }
    } else {
      // Opening search - initialize with current search query
      setLocalSearchValue(searchQuery);
    }
    setIsSearchInputVisible(!isSearchInputVisible);
  }, [isSearchInputVisible, handleClearSearch, searchQuery]);

  const handleSearchSubmit = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (!isMountedRef.current) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const query = localSearchValue.trim();
      
      // 4. Performance for 100K Concurrent Users: Request deduplication
      if (query === lastSearchQueryRef.current) {
        return; // Skip duplicate requests
      }
      
      // Clear any pending search operations
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = undefined;
      }
      
      // Execute search immediately on Enter
      handleSearch(query);
      lastSearchQueryRef.current = query;
      
      if (!query) {
        setIsSearchInputVisible(false);
      }
    }
  }, [localSearchValue, handleSearch]);

  // Simple input change handler - no automatic search
  const handleLocalSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isMountedRef.current) return;

    const value = e.target.value;
    setLocalSearchValue(value);
    // Note: Removed automatic search trigger - user must press Enter to search
  }, []);

  const handleCloseSearch = useCallback(() => {
    if (!isMountedRef.current) return;
    toggleSearchVisibility();
  }, [toggleSearchVisibility]);

  return (
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        {isSearchInputVisible ? (
          // 3. Enterprise-Level Error Boundaries for search section
          <ErrorBoundary fallback={SearchErrorFallback}>
            <SearchInput
              value={localSearchValue}
              onChange={handleLocalSearchChange}
              onKeyDown={handleSearchSubmit}
              onClose={handleCloseSearch}
              isSearching={isSearching}
            />
          </ErrorBoundary>
        ) : (
          // 3. Enterprise-Level Error Boundaries for navigation section
          <ErrorBoundary 
            fallback={({ retry }) => (
              <div className="flex items-center justify-between w-full">
                <div className="w-10" />
                <div className="flex-1 flex justify-center text-base font-extrabold tracking-tight">
                  Bookmarks
                </div>
                <button 
                  onClick={retry}
                  className="w-10 flex justify-end text-sm text-muted-foreground"
                >
                  Retry
                </button>
              </div>
            )}
          >
            <HeaderNavigation
              displayName={displayName}
              profileImage={profileImage}
              isBoarded={isBoarded}
              pendingFriendRequestCount={pendingFriendRequestCount}
              onSearchToggle={toggleSearchVisibility}
            />
          </ErrorBoundary>
        )}
      </div>
  );
};

export const BookmarksHeader = memo(BookmarksHeaderComponent);
BookmarksHeader.displayName = 'BookmarksHeader'; 