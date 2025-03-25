"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
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

export function SidebarSearch({
  className = "",
  onSearch
}: SidebarSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const commandRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  const searchCategories = [
    { id: "newsletter", label: "Newsletters", icon: Mail },
    { id: "podcast", label: "Podcasts", icon: Podcast },
    { id: "people", label: "Users", icon: Users },
  ];
  
  const handleSearch = (category: string) => {
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
      
      setIsOpen(false);
    }
  };
  
  const clearSearch = () => {
    setQuery("");
    if (onSearch) onSearch("");
    setIsOpen(false);
    
    // Clear search storage
    sessionStorage.removeItem('app_search_query');
    sessionStorage.removeItem('app_search_mediaType');
    sessionStorage.removeItem('app_search_timestamp');
  };

  // Handle form submission for general search
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Store search query without a specific media type
      storeSearchQuery(query.trim());
      router.push("/newsletters");
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < searchCategories.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : searchCategories.length - 1));
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
  };

  // Reset active index when opening/closing dropdown
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Close command menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (commandRef.current && !commandRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
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
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(e.target.value.length > 0);
              }}
              onFocus={() => {
                if (query.length > 0) {
                  setIsOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
            />
            {query && (
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
                        onClick={() => handleSearch(category.id)}
                        className={`relative flex cursor-default select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none gap-2 ${
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