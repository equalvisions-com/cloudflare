"use client";

import { useState, KeyboardEvent } from "react";
import { BookmarkSearchButton } from "@/components/ui/BookmarkSearchButton";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function BookmarksHeader() {
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
    <div className="flex items-center h-[45px] border-b">
      {isSearching ? (
        <>
          <div className="flex-1 mx-4 flex items-center">
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
        </>
      ) : (
        <>
          <div className="w-10"></div> {/* Spacer with fixed width */}
          <div className="flex-1 flex justify-center text-base font-extrabold tracking-tight">
            Bookmarks
          </div>
          <div className="w-10 flex justify-end pr-4">
            <BookmarkSearchButton onClick={toggleSearch} />
          </div>
        </>
      )}
    </div>
  );
} 