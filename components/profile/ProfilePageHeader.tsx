"use client";

import { useState, KeyboardEvent, useCallback, memo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenuClientWithErrorBoundary } from "@/components/user-menu/UserMenuClient";
import { useSidebar } from "@/components/ui/sidebar-context";
import { BackButton } from "@/components/back-button";
import { useProfileSearchContext } from "@/lib/contexts/ProfileSearchContext";
import { useContext } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";

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
SearchErrorFallback.displayName = 'SearchErrorFallback';

// Performance optimization: Memoized search input component
const SearchInput = memo(({ 
  value, 
  onChange, 
  onKeyDown, 
  onClose, 
  isSearching,
  placeholder 
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
  isSearching?: boolean;
  placeholder: string;
}) => (
  <div className="flex-1 relative">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
      <Input
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          "pl-9 pr-10 h-9 w-full focus-visible:ring-0 rounded-full border shadow-none",
          isSearching && "opacity-75"
        )}
        autoFocus
        aria-label={`${placeholder} - press Enter to search`}
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
          Searching...
        </div>
      )}
    </div>
  </div>
));

SearchInput.displayName = 'SearchInput';

// Performance optimization: Memoized header navigation
const HeaderNavigation = memo(({ 
  onSearchToggle,
  hasSearchContext = false
}: {
  onSearchToggle: () => void;
  hasSearchContext?: boolean;
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
      Profile
    </div>
    <div className="w-10 flex justify-end">
      {hasSearchContext && (
        <Button 
          onClick={onSearchToggle}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-muted/60 rounded-full"
          aria-label="Search profile"
        >
          <Search className="h-4 w-4" strokeWidth={2.5} />
        </Button>
      )}
    </div>
  </>
));

HeaderNavigation.displayName = 'HeaderNavigation';

const ProfilePageHeaderComponent = () => {
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount } = useSidebar();
  const [isSearchInputVisible, setIsSearchInputVisible] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState("");
  
  // Performance optimization: Request deduplication
  const searchTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const isMountedRef = useRef(true);
  const lastSearchQueryRef = useRef<string>("");

  // Try to get search context, but handle gracefully if not available
  let searchQuery = "";
  let handleSearch = async (query: string) => {};
  let handleClearSearch = () => {};
  let isSearching = false;
  let activeTab: "activity" | "likes" = "activity";
  let hasSearchContext = false;

  try {
    const searchContext = useProfileSearchContext();
    searchQuery = searchContext.searchQuery;
    handleSearch = searchContext.handleSearch;
    handleClearSearch = searchContext.handleClearSearch;
    isSearching = searchContext.isSearching;
    activeTab = searchContext.activeTab;
    hasSearchContext = true;
  } catch {
    // No search context available, use defaults
    hasSearchContext = false;
  }

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
    if (!isMountedRef.current || !hasSearchContext) return;

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
  }, [isSearchInputVisible, handleClearSearch, searchQuery, hasSearchContext]);

  const handleSearchSubmit = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (!isMountedRef.current) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const query = localSearchValue.trim();
      
      // Performance for 100K Concurrent Users: Request deduplication
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

  // Dynamic placeholder based on active tab
  const searchPlaceholder = activeTab === 'activity' 
    ? "Search Activity..." 
    : "Search Likes...";

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border">
      {isSearchInputVisible ? (
        // Enterprise-Level Error Boundaries for search section
        (<ErrorBoundary fallback={SearchErrorFallback}>
          <SearchInput
            value={localSearchValue}
            onChange={handleLocalSearchChange}
            onKeyDown={handleSearchSubmit}
            onClose={handleCloseSearch}
            isSearching={isSearching}
            placeholder={searchPlaceholder}
          />
        </ErrorBoundary>)
      ) : (
        // Enterprise-Level Error Boundaries for navigation section
        (<ErrorBoundary 
          fallback={({ retry }) => (
            <div className="flex items-center justify-between w-full">
              <div className="w-10" />
              <div className="flex-1 flex justify-center text-base font-extrabold tracking-tight">
                Profile
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
            onSearchToggle={toggleSearchVisibility}
            hasSearchContext={hasSearchContext}
          />
        </ErrorBoundary>)
      )}
    </div>
  );
};

export const ProfilePageHeader = memo(ProfilePageHeaderComponent);
ProfilePageHeader.displayName = 'ProfilePageHeader';