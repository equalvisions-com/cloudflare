"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { usePathname } from "next/navigation";

interface MobileSearchProps {
  className?: string;
}

export function MobileSearch({ className }: MobileSearchProps) {
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const toggleSearch = () => {
    setIsSearching(!isSearching);
  };

  // Handle positioning the X button inside the search input
  useEffect(() => {
    if (isSearching && searchContainerRef.current) {
      // Find the search input within SidebarSearch
      const searchInput = searchContainerRef.current.querySelector('input');
      if (searchInput) {
        // Apply right padding to make room for the X button
        searchInput.style.paddingRight = '2.5rem';
      }
    }
  }, [isSearching]);

  // Close search when pathname changes (navigation occurs)
  useEffect(() => {
    if (isSearching) {
      setIsSearching(false);
    }
  }, [pathname]);

  // Custom handler for SidebarSearch to close MobileSearch on search execution
  const handleSearch = (query: string) => {
    if (isSearching) {
      setIsSearching(false);
    }
  };

  if (isSearching) {
    return (
      <div className="absolute inset-x-0 top-0 z-50 bg-background flex items-center mt-2">
        <div className="flex-1 mx-4 flex items-center">
          <div className="relative w-full" ref={searchContainerRef}>
            <SidebarSearch className="w-full" hideClearButton={true} onSearch={handleSearch} />
            <button
              onClick={toggleSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none"
              aria-label="Close search"
            >
              <X className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Button 
      variant="secondary" 
      size="icon" 
      className="rounded-full h-9 w-9 p-0 shadow-none text-muted-foreground" 
      onClick={toggleSearch}
    >
      <Search style={{ width: '18px', height: '18px' }} strokeWidth={2.25} />
      <span className="sr-only">Search</span>
    </Button>
  );
} 