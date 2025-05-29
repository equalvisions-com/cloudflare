"use client";

import React, { useState, KeyboardEvent, useEffect, useCallback } from "react";
import { UserMenuClientWithErrorBoundary } from "@/components/user-menu/UserMenuClient";
import { useSidebar } from "@/components/ui/sidebar-context";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { PostSearchButton } from "@/components/ui/PostSearchButton";
import { SignInButton } from "@/components/ui/SignInButton";
import { MenuButton } from "@/components/ui/menu-button";
import { usePostSearch } from "./PostSearchContext";

export const PostHeaderUserMenu = React.memo(function PostHeaderUserMenu() {
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount } = useSidebar();
  
  if (!isBoarded) return null;
  
  return (
    <UserMenuClientWithErrorBoundary
      initialDisplayName={displayName}
      initialProfileImage={profileImage}
      isBoarded={isBoarded}
      pendingFriendRequestCount={pendingFriendRequestCount}
    />
  );
});

export const PostSearchHeader = React.memo(function PostSearchHeader({ 
  title, 
  mediaType 
}: { 
  title: string; 
  mediaType?: string 
}) {
  const [isSearching, setIsSearching] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState("");
  const { isAuthenticated } = useSidebar();
  
  const { searchQuery, setSearchQuery } = usePostSearch();
  
  // Format the media type for display
  const displayText = mediaType ? 
    mediaType.charAt(0).toUpperCase() + mediaType.slice(1) : 
    title;

  useEffect(() => {
    setLocalSearchValue(searchQuery);
  }, [searchQuery]);

  const toggleSearch = useCallback(() => {
    const newVisibility = !isSearching;
    setIsSearching(newVisibility);
    if (!newVisibility) {
      setSearchQuery("");
      setLocalSearchValue("");
    }
  }, [isSearching, setSearchQuery]);

  const handleSearch = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && localSearchValue.trim().length > 0) {
      setSearchQuery(localSearchValue.trim());
    }
  }, [localSearchValue, setSearchQuery]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchValue(e.target.value);
  }, []);

  return (
    <div className="w-full border-b py-2">
      {isSearching ? (
        <div className="flex items-center px-4">
          <div className="relative w-full">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" 
              strokeWidth={2.5} 
            />
            <Input
              type="text"
              value={localSearchValue}
              onChange={handleInputChange}
              onKeyDown={handleSearch}
              placeholder={`Search ${title}...`}
              className="pl-9 pr-10 h-9 w-full focus-visible:ring-0 rounded-full border shadow-none"
              autoFocus
            />
            <button
              onClick={toggleSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none"
              aria-label="Close search"
            >
              <X className="h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4">
          <div className="w-24 flex items-start justify-start">
            <div className="hidden md:block">
              <BackButton />
            </div>
            <div className="md:hidden">
              {isAuthenticated ? (
                <PostHeaderUserMenu />
              ) : (
                <SignInButton />
              )}
            </div>
          </div>
          <div className="flex-1 flex justify-center text-base font-extrabold tracking-tight">
            {displayText}
          </div>
          <div className="w-24 flex justify-end items-center gap-2">
            <div className="hidden md:block">
              <MenuButton />
            </div>
            <PostSearchButton onClick={toggleSearch} title={title} />
          </div>
        </div>
      )}
    </div>
  );
}); 