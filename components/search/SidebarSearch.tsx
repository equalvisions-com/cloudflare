"use client";

import { useState, useEffect, useRef, KeyboardEvent, useCallback, memo, useMemo } from "react";
import { Search as SearchIcon, X, Mail, Podcast, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useRouter } from "next/navigation";

interface SidebarSearchProps {
  className?: string;
  onSearch?: (query: string) => void;
  hideClearButton?: boolean;
}

// Store search info in sessionStorage for cross-page persistence
const storeSearchQuery = (query: string, mediaType?: string) => {
  // Store the search query in sessionStorage so it persists through navigation
  sessionStorage.setItem('app_search_query', query);
  if (mediaType) {
    sessionStorage.setItem('app_search_mediaType', mediaType);
  } else {
    sessionStorage.removeItem('app_search_mediaType');
  }
  
  // Set a timestamp to know this is a fresh search
  sessionStorage.setItem('app_search_timestamp', Date.now().toString());
  
  // Add a flag to indicate we're navigating between pages
  // This helps prevent unnecessary widget re-renders
  sessionStorage.setItem('app_is_navigation', 'true');
};

const SidebarSearchComponent = ({
  className = "",
  onSearch,
  hideClearButton
}: SidebarSearchProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const commandRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Memoize search categories to prevent recreation on each render
  const searchCategories = useMemo(() => [
    { id: "newsletter", label: "Newsletters", icon: Mail },
    { id: "podcast", label: "Podcasts", icon: Podcast },
    { id: "people", label: "Users", icon: Users },
  ], []);
  
  const handleSearch = useCallback((category: string) => {
    if (!isMountedRef.current) return;
    
    if (query.trim()) {
      // If onSearch is provided, use it (for backward compatibility)
      if (onSearch) {
        const searchQuery = `${category}:${query.trim()}`;
        onSearch(searchQuery);
      }
      
      // Store the search query in sessionStorage before navigation
      // Use the category identifier as the mediaType consistently for all search types
      storeSearchQuery(query.trim(), category);
      
      // Navigate to the appropriate page
      switch (category) {
        case "newsletter":
          router.push("/newsletters");
          break;
        case "podcast":
          router.push("/podcasts");
          break;
        case "people":
          router.push("/users");
          break;
        default:
          router.push("/newsletters");
      }
      
      if (isMountedRef.current) {
        setIsOpen(false);
      }
    }
  }, [query, onSearch, router]);
  
  const clearSearch = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setQuery("");
    if (onSearch) onSearch("");
    setIsOpen(false);
    
    // Clear search storage
    sessionStorage.removeItem('app_search_query');
    sessionStorage.removeItem('app_search_mediaType');
    sessionStorage.removeItem('app_search_timestamp');
  }, [onSearch]);

  // Handle form submission for general search
  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isMountedRef.current) return;
    
    if (query.trim()) {
      // Store search query without a specific media type
      storeSearchQuery(query.trim());
      router.push("/newsletters");
    }
  }, [query, router]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || !isMountedRef.current) return;
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => {
          // If no item is currently active or we're at the last item, select first item
          if (prev === -1 || prev >= searchCategories.length - 1) {
            return 0;
          }
          return prev + 1;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => {
          // If no item is currently active, select last item
          if (prev === -1) {
            return searchCategories.length - 1;
          }
          // If at first item, go to last item
          if (prev === 0) {
            return searchCategories.length - 1;
          }
          return prev - 1;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < searchCategories.length) {
          handleSearch(searchCategories[activeIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [isOpen, activeIndex, searchCategories, handleSearch]);

  // Reset active index when opening/closing dropdown
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (isOpen) {
      setActiveIndex(-1);
    }
  }, [isOpen]);

  // Close command menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!isMountedRef.current) return;
      
      if (commandRef.current && !commandRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isMountedRef.current) return;
    
    setQuery(e.target.value);
    setIsOpen(e.target.value.length > 0);
  }, []);
  
  const handleInputFocus = useCallback(() => {
    if (!isMountedRef.current) return;
    
    if (query.length > 0) {
      setIsOpen(true);
    }
  }, [query]);
  
  const handleCategoryClick = useCallback((categoryId: string) => {
    if (!isMountedRef.current) return;
    
    handleSearch(categoryId);
  }, [handleSearch]);
  
  const handleCategoryMouseEnter = useCallback((index: number) => {
    if (!isMountedRef.current) return;
    
    setActiveIndex(index);
  }, []);
  
  const handleCategoryMouseLeave = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setActiveIndex(-1);
  }, []);
  
  return (
    <div className={className} ref={commandRef}>
      <div className="relative">
        <form onSubmit={handleFormSubmit}>
          <div className="relative">
            <SearchIcon 
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true" 
            />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              className="pl-9 pr-9 rounded-full shadow-none focus:ring-0 focus:ring-offset-0 active:ring-0 active:ring-offset-0 outline-none focus-visible:outline-none focus-visible:ring-0"
              value={query}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
            />
            {query && !hideClearButton && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
        
        {isOpen && query && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50">
            <div className="rounded-xl border shadow-md w-full bg-popover overflow-hidden">
              <div className="p-2">
                <div className="p-1 text-xs font-medium text-muted-foreground">Search</div>
                <div>
                  {searchCategories.map((category, index) => {
                    const Icon = category.icon;
                    return (
                      <div 
                        key={category.id}
                        onClick={() => handleCategoryClick(category.id)}
                        onMouseEnter={() => handleCategoryMouseEnter(index)}
                        onMouseLeave={handleCategoryMouseLeave}
                        className={`relative flex cursor-pointer select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none gap-2 transition-colors ${
                          activeIndex === index ? "bg-accent text-accent-foreground" : ""
                        }`}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{category.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export memoized component
export const SidebarSearch = memo(SidebarSearchComponent); 