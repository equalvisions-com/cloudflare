"use client";

import React, { createContext, useContext, useReducer } from 'react';
import type { PostSearchState, PostSearchActions } from '@/lib/types';

// State interface (reusing existing types)
interface PostSearchContextState extends PostSearchState {}

// Action types for the reducer
type PostSearchAction = 
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'RESET' };

// Initial state
const initialPostSearchState: PostSearchContextState = {
  searchQuery: '',
};

// Reducer function
function postSearchReducer(
  state: PostSearchContextState, 
  action: PostSearchAction
): PostSearchContextState {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      // Only update if the query actually changed to prevent unnecessary re-renders
      if (state.searchQuery === action.payload) {
        return state;
      }
      return {
        ...state,
        searchQuery: action.payload,
      };
    
    case 'RESET':
      // Only reset if state is not already at initial values
      if (state.searchQuery === initialPostSearchState.searchQuery) {
        return state;
      }
      return initialPostSearchState;
    
    default:
      return state;
  }
}

// Context interface
interface PostSearchContextValue {
  state: PostSearchContextState;
  actions: PostSearchActions;
}

// Create context
const PostSearchContext = createContext<PostSearchContextValue | null>(null);

// Provider component with optimized actions
export const PostSearchProvider = React.memo(function PostSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(postSearchReducer, initialPostSearchState);

  // Memoized actions to prevent unnecessary re-renders
  const actions: PostSearchActions = React.useMemo(() => ({
    setSearchQuery: (query: string) => {
      dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
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
    <PostSearchContext.Provider value={contextValue}>
      {children}
    </PostSearchContext.Provider>
  );
});

// Custom hook to use the context
export function usePostSearchContext(): PostSearchContextValue {
  const context = useContext(PostSearchContext);
  if (!context) {
    throw new Error('usePostSearchContext must be used within a PostSearchProvider');
  }
  return context;
} 