"use client";

import { useState, KeyboardEvent } from "react";
import { UserMenuClientWithErrorBoundary } from "@/components/user-menu/UserMenuClient";
import { useSidebar } from "@/components/ui/sidebar-context";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BackButton } from "@/app/components/ui/back-button";
import { PostSearchButton } from "@/components/ui/PostSearchButton";

export function PostHeaderUserMenu() {
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
}

export function PostSearchHeader({ title }: { title: string }) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggleSearch = () => {
    if (isSearching) {
      // If we were searching, clear it
      setSearchValue("");
      setIsSearching(false);
      
      // Check if we currently have a search query
      const currentSearchQuery = searchParams.get("q");
      
      if (currentSearchQuery) {
        // Remove search query and use router.refresh() to reset server components
        // without a full page reload
        const params = new URLSearchParams(searchParams);
        params.delete("q");
        router.replace(`${pathname}?${params.toString()}`);
        
        // Use router.refresh() to force a server component re-render
        // This triggers a new data fetch without a full page reload
        setTimeout(() => {
          router.refresh();
        }, 0);
      }
    } else {
      // Just open the search box
      setIsSearching(true);
    }
  };

  const handleSearch = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim().length > 0) {
      // Add search query to URL parameters
      const params = new URLSearchParams(searchParams);
      params.set("q", searchValue.trim());
      router.replace(`${pathname}?${params.toString()}`);
      
      // Use router.refresh() to force a server component re-render
      // This will apply the search without a full page reload
      setTimeout(() => {
        router.refresh();
      }, 0);
    }
  };

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
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
              placeholder={`Search ${title}...`}
              className="pl-10 pr-10 h-9 w-full focus-visible:ring-0 rounded-full border shadow-none"
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
          <div className="w-10 flex items-start justify-start">
            <div className="hidden md:block">
              <BackButton />
            </div>
            <div className="md:hidden">
              <PostHeaderUserMenu />
            </div>
          </div>
          <div className="flex-1 flex justify-center text-base font-extrabold tracking-tight">
            {title}
          </div>
          <div className="w-10 flex justify-end">
            <PostSearchButton onClick={toggleSearch} title={title} />
          </div>
        </div>
      )}
    </div>
  );
} 