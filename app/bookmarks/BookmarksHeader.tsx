"use client";

import { useState, KeyboardEvent, useEffect } from "react";
import { BookmarkSearchButton } from "@/components/ui/BookmarkSearchButton";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenuClientWithErrorBoundary } from "@/components/user-menu/UserMenuClient";
import { useSidebar } from "@/components/ui/sidebar-context";
import { BackButton } from "@/components/back-button";
import { useSearch } from "./SearchContext";

export function BookmarksHeader() {
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount } = useSidebar();
  const [isSearchInputVisible, setIsSearchInputVisible] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState("");

  const { searchQuery, setSearchQuery } = useSearch();

  useEffect(() => {
    setLocalSearchValue(searchQuery);
  }, [searchQuery]);

  const toggleSearchVisibility = () => {
    const newVisibility = !isSearchInputVisible;
    setIsSearchInputVisible(newVisibility);
    if (!newVisibility) {
      setSearchQuery("");
      setLocalSearchValue("");
    }
  };

  const handleSearchSubmit = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && localSearchValue.trim().length > 0) {
      console.log('[BookmarksHeader] handleSearchSubmit triggered. Value:', localSearchValue.trim());
      setSearchQuery(localSearchValue.trim());
    }
  };

  return (
    <div className="flex items-center border-b px-4 py-2">
      {isSearchInputVisible ? (
        <div className="flex-1 flex items-center">
          <div className="relative w-full">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" 
              strokeWidth={2.5} 
            />
            <Input
              type="text"
              value={localSearchValue}
              onChange={(e) => setLocalSearchValue(e.target.value)}
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
  );
} 