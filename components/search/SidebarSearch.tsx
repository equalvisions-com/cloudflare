"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SidebarSearchProps {
  className?: string;
  onSearch?: (query: string) => void;
}

export function SidebarSearch({
  className = "",
  onSearch
}: SidebarSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && query.trim()) {
      onSearch(query.trim());
    }
  };
  
  const clearSearch = () => {
    setQuery("");
    // Optional: Call onSearch with empty string if you want to clear results
    if (onSearch) onSearch("");
  };
  
  return (
    <div className={className}>
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search 
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true" 
          />
          <Input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-9 rounded-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
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
    </div>
  );
} 