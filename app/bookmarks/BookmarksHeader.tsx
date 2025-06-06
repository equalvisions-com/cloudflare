"use client";

import { useState, KeyboardEvent, useCallback, memo } from "react";
import { BookmarkSearchButton } from "@/components/ui/BookmarkSearchButton";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenuClientWithErrorBoundary } from "@/components/user-menu/UserMenuClient";
import { useSidebar } from "@/components/ui/sidebar-context";
import { BackButton } from "@/components/back-button";
import { useBookmarkActions } from "@/lib/hooks/useBookmarkActions";

const BookmarksHeaderComponent = () => {
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount, userId } = useSidebar();
  const [isSearchInputVisible, setIsSearchInputVisible] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState("");

  const { searchQuery, handleSearch, handleClearSearch } = useBookmarkActions(userId ?? null);

  const toggleSearchVisibility = useCallback(() => {
    if (isSearchInputVisible) {
      // Closing search - clear everything
      setLocalSearchValue("");
      handleClearSearch();
    } else {
      // Opening search - initialize with current search query
      setLocalSearchValue(searchQuery);
    }
    setIsSearchInputVisible(!isSearchInputVisible);
  }, [isSearchInputVisible, handleClearSearch, searchQuery]);

  const handleSearchSubmit = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = localSearchValue.trim();
      handleSearch(query);
      if (!query) {
        setIsSearchInputVisible(false);
      }
    }
  }, [localSearchValue, handleSearch]);

  const handleLocalSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchValue(e.target.value);
  }, []);

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex items-center justify-between px-4 py-3 h-[60px]">
        {isSearchInputVisible ? (
          <div className="flex-1 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
              <Input
                type="text"
                value={localSearchValue}
                onChange={handleLocalSearchChange}
                onKeyDown={handleSearchSubmit}
                placeholder="Search Bookmarks..."
                className="pl-9 pr-10 h-9 w-full focus-visible:ring-0 rounded-full border shadow-none"
                autoFocus
              />
              <button
                onClick={toggleSearchVisibility}
                className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none"
                aria-label="Close search"
              >
                <X className="h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-10 flex items-start justify-start">
              <div className="md:hidden">
                <UserMenuClientWithErrorBoundary 
                  initialDisplayName={displayName}
                  initialProfileImage={profileImage}
                  isBoarded={isBoarded}
                  pendingFriendRequestCount={pendingFriendRequestCount}
                />
              </div>
              <div className="hidden md:block h-[36px]">
                <BackButton />
              </div>
            </div>
            <div className="flex-1 flex justify-center text-base font-extrabold tracking-tight">
              Bookmarks
            </div>
            <div className="w-10 flex justify-end">
              <BookmarkSearchButton onClick={toggleSearchVisibility} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const BookmarksHeader = memo(BookmarksHeaderComponent);
BookmarksHeader.displayName = 'BookmarksHeader'; 