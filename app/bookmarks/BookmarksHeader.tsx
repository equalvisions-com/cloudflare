"use client";

import { useState, KeyboardEvent } from "react";
import { BackButton } from "@/components/ui/BackButton";
import { BookmarkSearchButton } from "@/components/ui/BookmarkSearchButton";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
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
          <div className="flex-1 mx-2 flex items-center">
            <div className="relative w-full">
              <Input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Search bookmarks..."
                className="pl-3 pr-10 h-9 w-full focus-visible:ring-0 rounded-full border"
                autoFocus
              />
            </div>
          </div>
          <button
            onClick={toggleSearch}
            className={cn(
              "inline-flex items-center justify-center rounded-full p-2 text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none mr-2"
            )}
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <BackButton className="ml-2" />
          <div className="flex-1 flex justify-center text-base font-extrabold tracking-tight">
            Bookmarks
          </div>
          <BookmarkSearchButton className="mr-2" onClick={toggleSearch} />
        </>
      )}
    </div>
  );
} 