"use client";

import { useRef, KeyboardEvent, useCallback, memo, useReducer } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

// Import organized utilities and hooks
import { useOutsideClick, useSearchStorage, useMountedRef } from "@/hooks/useSearchHooks";
import { getSearchRoute, formatSearchQuery } from "@/lib/utils/search";
import { SEARCH_CATEGORIES, SEARCH_CONFIG } from "@/lib/constants/search";
import type { SidebarSearchProps, SidebarSearchState, SidebarSearchAction } from "@/lib/types";

// Initial state using constants
const initialSearchState: SidebarSearchState = {
  query: '',
  isOpen: false,
  activeIndex: SEARCH_CONFIG.DEFAULT_ACTIVE_INDEX,
};

// Reducer for search state management
const searchReducer = (state: SidebarSearchState, action: SidebarSearchAction): SidebarSearchState => {
  switch (action.type) {
    case 'SET_QUERY':
      return {
        ...state,
        query: action.payload,
        isOpen: action.payload.length >= SEARCH_CONFIG.MIN_QUERY_LENGTH,
        activeIndex: action.payload.length >= SEARCH_CONFIG.MIN_QUERY_LENGTH ? SEARCH_CONFIG.DEFAULT_ACTIVE_INDEX : state.activeIndex,
      };
    
    case 'SET_OPEN':
      return {
        ...state,
        isOpen: action.payload,
        activeIndex: action.payload ? state.activeIndex : SEARCH_CONFIG.DEFAULT_ACTIVE_INDEX,
      };
    
    case 'SET_ACTIVE_INDEX':
      return {
        ...state,
        activeIndex: action.payload,
      };
    
    case 'OPEN_WITH_QUERY':
      return {
        ...state,
        query: action.payload,
        isOpen: action.payload.length >= SEARCH_CONFIG.MIN_QUERY_LENGTH,
        activeIndex: SEARCH_CONFIG.DEFAULT_ACTIVE_INDEX,
      };
    
    case 'CLOSE_AND_RESET':
      return {
        ...state,
        isOpen: false,
        activeIndex: SEARCH_CONFIG.DEFAULT_ACTIVE_INDEX,
      };
    
    case 'CLEAR_ALL':
      return initialSearchState;
    
    case 'NAVIGATE_DOWN':
      return {
        ...state,
        activeIndex: state.activeIndex === SEARCH_CONFIG.DEFAULT_ACTIVE_INDEX 
          ? 0 
          : state.activeIndex >= action.maxIndex - 1 
            ? 0 
            : state.activeIndex + 1,
      };
    
    case 'NAVIGATE_UP':
      return {
        ...state,
        activeIndex: state.activeIndex === SEARCH_CONFIG.DEFAULT_ACTIVE_INDEX 
          ? action.maxIndex - 1 
          : state.activeIndex === 0 
            ? action.maxIndex - 1 
            : state.activeIndex - 1,
      };
    
    default:
      return state;
  }
};

// SessionStorage operations are now handled by the useSearchStorage custom hook

const SidebarSearchComponent = ({
  className = "",
  onSearch,
  hideClearButton
}: SidebarSearchProps) => {
  // Use reducer for consolidated state management
  const [searchState, dispatch] = useReducer(searchReducer, initialSearchState);
  const { query, isOpen, activeIndex } = searchState;
  
  // Use custom hook for optimized sessionStorage operations
  const { storeSearch, clearSearch: clearSearchStorage } = useSearchStorage();
  
  const commandRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // Use custom hook for mount tracking
  const mountedRef = useMountedRef();
  
  // Use imported search categories constant
  const searchCategories = SEARCH_CATEGORIES;
  
  const handleSearch = useCallback((category: string) => {
    if (!mountedRef.current) return;
    
    if (query.trim()) {
      // If onSearch is provided, use it (for backward compatibility)
      if (onSearch) {
        const searchQuery = formatSearchQuery(category, query);
        onSearch(searchQuery);
      }
      
      // Store the search query in sessionStorage before navigation
      storeSearch(query.trim(), category);
      
      // Navigate to the appropriate page using utility function
      const route = getSearchRoute(category);
      router.push(route);
      
      if (mountedRef.current) {
        dispatch({ type: 'CLOSE_AND_RESET' });
      }
    }
  }, [query, onSearch, router, mountedRef, storeSearch]);
  
  const clearSearch = useCallback(() => {
    if (!mountedRef.current) return;
    
    dispatch({ type: 'CLEAR_ALL' });
    if (onSearch) onSearch("");
    
    // Clear search storage using optimized hook
    clearSearchStorage();
  }, [onSearch, clearSearchStorage, mountedRef]);

  // Handle form submission for general search
  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mountedRef.current) return;
    
    if (query.trim()) {
      // Store search query without a specific media type
      storeSearch(query.trim());
      router.push(SEARCH_CONFIG.DEFAULT_SEARCH_ROUTE);
    }
  }, [query, router, mountedRef, storeSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || !mountedRef.current) return;
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        dispatch({ type: 'NAVIGATE_DOWN', maxIndex: searchCategories.length });
        break;
      case "ArrowUp":
        e.preventDefault();
        dispatch({ type: 'NAVIGATE_UP', maxIndex: searchCategories.length });
        break;
      case "Enter":
        e.preventDefault();
        // Only handle enter if an item is actually selected (activeIndex >= 0)
        if (activeIndex >= 0 && activeIndex < searchCategories.length) {
          handleSearch(searchCategories[activeIndex].id);
        } else if (activeIndex === SEARCH_CONFIG.DEFAULT_ACTIVE_INDEX) {
          // If no item is selected, treat as general search (default to newsletters)
          handleFormSubmit(e);
        }
        break;
      case "Escape":
        e.preventDefault();
        dispatch({ type: 'CLOSE_AND_RESET' });
        break;
    }
  }, [isOpen, activeIndex, searchCategories, handleSearch, handleFormSubmit, mountedRef]);

  // Note: activeIndex reset is now handled automatically by the reducer when isOpen changes

  // Close dropdown when clicking outside - using custom hook for better performance
  const handleOutsideClick = useCallback(() => {
    if (mountedRef.current) {
      dispatch({ type: 'SET_OPEN', payload: false });
    }
  }, [mountedRef]);
  
  useOutsideClick(commandRef, handleOutsideClick, isOpen);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!mountedRef.current) return;
    
    const value = e.target.value;
    dispatch({ type: 'SET_QUERY', payload: value });
  }, [mountedRef]);
  
  const handleInputFocus = useCallback(() => {
    if (!mountedRef.current) return;
    
    if (query.length >= SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      dispatch({ type: 'SET_OPEN', payload: true });
    }
  }, [query, mountedRef]);
  
  const handleCategoryClick = useCallback((categoryId: string) => {
    if (!mountedRef.current) return;
    
    handleSearch(categoryId);
  }, [handleSearch, mountedRef]);
  
  const handleCategoryMouseEnter = useCallback((index: number) => {
    if (!mountedRef.current) return;
    
    dispatch({ type: 'SET_ACTIVE_INDEX', payload: index });
  }, [mountedRef]);
  
  const handleCategoryMouseLeave = useCallback(() => {
    if (!mountedRef.current) return;
    
    dispatch({ type: 'SET_ACTIVE_INDEX', payload: SEARCH_CONFIG.DEFAULT_ACTIVE_INDEX });
  }, [mountedRef]);
  
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
              placeholder="Search"
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
                        className={`relative flex cursor-pointer select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none gap-2 transition-colors hover:bg-accent hover:text-accent-foreground ${
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