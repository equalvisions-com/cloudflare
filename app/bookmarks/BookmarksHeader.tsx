"use client";

import { useState, KeyboardEvent } from "react";
import { BookmarkSearchButton } from "@/components/ui/BookmarkSearchButton";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserMenuClientWithErrorBoundary } from "@/components/user-menu/UserMenuClient";
import { useSidebar } from "@/components/ui/sidebar-context";
import { BackButton } from "@/components/back-button";

export function BookmarksHeader() {
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount } = useSidebar();
  const [isSearching, setIsSearching] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggleSearch = () => {
    setIsSearching(!isSearching);
    if (isSearching) {
      setSearchValue("");
      // Remove search query param when closing search
      const params = new URLSearchParams(searchParams);
      params.delete("q");
      router.replace(`${pathname}?${params.toString()}`);
    }
  };

  const handleSearch = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim().length > 0) {
      // Add search query to URL parameters
      const params = new URLSearchParams(searchParams);
      params.set("q", searchValue.trim());
      router.replace(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <div className="flex items-center border-b px-4 py-2">
      {isSearching ? (
        <div className="flex-1 flex items-center">
          <div className="relative w-full">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" 
              strokeWidth={2.5} 
            />
            <Input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search Bookmarks..."
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
            <BookmarkSearchButton onClick={toggleSearch} />
          </div>
        </>
      )}
    </div>
  );
} 