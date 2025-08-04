"use client";

import React, { createContext, useContext, useReducer } from 'react';
import type { PostSearchRSSData } from '@/lib/types';

// State interface
interface SearchResultsState {
  searchData: PostSearchRSSData | null;
  isLoading: boolean;
  currentPage: number;
}

// Actions interface
interface SearchResultsActions {
  setSearchData: (data: PostSearchRSSData | null) => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentPage: (page: number) => void;
  appendSearchData: (newData: PostSearchRSSData) => void;
  reset: () => void;
}

// Action types for the reducer
type SearchResultsAction = 
  | { type: 'SET_SEARCH_DATA'; payload: PostSearchRSSData | null }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'APPEND_SEARCH_DATA'; payload: PostSearchRSSData }
  | { type: 'RESET' };

// Initial state
const initialSearchResultsState: SearchResultsState = {
  searchData: null,
  isLoading: false,
  currentPage: 1,
};

// Reducer function
function searchResultsReducer(
  state: SearchResultsState, 
  action: SearchResultsAction
): SearchResultsState {
  switch (action.type) {
    case 'SET_SEARCH_DATA':
      // Only update if the data actually changed to prevent unnecessary re-renders
      if (state.searchData === action.payload) {
        return state;
      }
      return {
        ...state,
        searchData: action.payload,
      };
    
    case 'SET_IS_LOADING':
      // Only update if the loading state actually changed
      if (state.isLoading === action.payload) {
        return state;
      }
      return {
        ...state,
        isLoading: action.payload,
      };
    
    case 'SET_CURRENT_PAGE':
      // Only update if the page actually changed
      if (state.currentPage === action.payload) {
        return state;
      }
      return {
        ...state,
        currentPage: action.payload,
      };
    
    case 'APPEND_SEARCH_DATA':
      if (!state.searchData) {
        return {
          ...state,
          searchData: action.payload,
        };
      }
      
      const newSearchData = {
        entries: [...state.searchData.entries, ...action.payload.entries],
        totalEntries: action.payload.totalEntries || state.searchData.totalEntries,
        hasMore: action.payload.hasMore ?? false,
      };
      
      return {
        ...state,
        searchData: newSearchData,
      };
    
    case 'RESET':
      // Only reset if state is not already at initial values
      const needsReset = 
        state.searchData !== initialSearchResultsState.searchData ||
        state.isLoading !== initialSearchResultsState.isLoading ||
        state.currentPage !== initialSearchResultsState.currentPage;
      
      if (!needsReset) {
        return state;
      }
      return initialSearchResultsState;
    
    default:
      return state;
  }
}

// Context interface
interface SearchResultsContextValue {
  state: SearchResultsState;
  actions: SearchResultsActions;
}

// Create context
const SearchResultsContext = createContext<SearchResultsContextValue | null>(null);

// Provider component with optimized actions
export const SearchResultsProvider = React.memo(function SearchResultsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(searchResultsReducer, initialSearchResultsState);

  // Memoized actions to prevent unnecessary re-renders
  const actions: SearchResultsActions = React.useMemo(() => ({
    setSearchData: (data: PostSearchRSSData | null) => {
      dispatch({ type: 'SET_SEARCH_DATA', payload: data });
    },
    
    setIsLoading: (loading: boolean) => {
      dispatch({ type: 'SET_IS_LOADING', payload: loading });
    },
    
    setCurrentPage: (page: number) => {
      dispatch({ type: 'SET_CURRENT_PAGE', payload: page });
    },
    
    appendSearchData: (newData: PostSearchRSSData) => {
      dispatch({ type: 'APPEND_SEARCH_DATA', payload: newData });
    },
    
    reset: () => {
      dispatch({ type: 'RESET' });
    },
  }), []);

  const contextValue = React.useMemo(() => ({
    state,
    actions,
  }), [state, actions]);

  return (
    <SearchResultsContext.Provider value={contextValue}>
      {children}
    </SearchResultsContext.Provider>
  );
});

// Custom hook to use the context
export function useSearchResultsContext(): SearchResultsContextValue {
  const context = useContext(SearchResultsContext);
  if (!context) {
    throw new Error('useSearchResultsContext must be used within a SearchResultsProvider');
  }
  return context;
} 