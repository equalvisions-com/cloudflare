"use client";

import { useRef, useCallback, useReducer, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { usePathname } from "next/navigation";
import type { MobileSearchProps, MobileSearchState, MobileSearchAction } from "@/lib/types";

// Initial state for useReducer
const initialState: MobileSearchState = {
  isSearching: false,
};

// Reducer for state management following React best practices
const mobileSearchReducer = (
  state: MobileSearchState, 
  action: MobileSearchAction
): MobileSearchState => {
  switch (action.type) {
    case 'TOGGLE_SEARCH':
      return { isSearching: !state.isSearching };
    case 'CLOSE_SEARCH':
      return { isSearching: false };
    case 'OPEN_SEARCH':
      return { isSearching: true };
    default:
      return state;
  }
};

// Main component following React composition patterns
export function MobileSearch({ className }: MobileSearchProps) {
  const [state, dispatch] = useReducer(mobileSearchReducer, initialState);
  const pathname = usePathname();
  const previousPathnameRef = useRef<string>(pathname);

  // Handle pathname changes with proper useEffect (React recommended)
  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      if (state.isSearching) {
        dispatch({ type: 'CLOSE_SEARCH' });
      }
    }
  }, [pathname, state.isSearching]);

  // Memoized handlers for performance optimization
  const handleToggleSearch = useCallback(() => {
    dispatch({ type: 'TOGGLE_SEARCH' });
  }, []);

  const handleCloseSearch = useCallback(() => {
    dispatch({ type: 'CLOSE_SEARCH' });
  }, []);

  // Handle search execution with automatic close
  const handleSearch = useCallback((query: string) => {
    if (state.isSearching) {
      dispatch({ type: 'CLOSE_SEARCH' });
    }
  }, [state.isSearching]);

  // Render search state
  if (state.isSearching) {
    return (
      <div className="absolute inset-x-0 top-0 z-50 bg-background flex items-center mt-2">
        <div className="flex-1 mx-4 flex items-center">
          <div className="relative w-full">
            <SidebarSearch 
              className="w-full [&>div>input]:pr-12" 
              hideClearButton={true} 
              onSearch={handleSearch} 
            />
            <button
              onClick={handleCloseSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
              aria-label="Close search"
              type="button"
            >
              <X className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render trigger button
  return (
    <Button 
      variant="secondary" 
      size="icon" 
      className="rounded-full h-9 w-9 p-0 shadow-none text-muted-foreground" 
      onClick={handleToggleSearch}
      aria-label="Open search"
      type="button"
    >
      <Search style={{ width: '18px', height: '18px' }} strokeWidth={2.25} />
      <span className="sr-only">Search</span>
    </Button>
  );
} 