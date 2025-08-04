"use client";

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { UsersState } from '@/lib/types';

// Action types for useReducer
type UsersAction = 
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_PENDING_SEARCH_QUERY'; payload: string }
  | { type: 'SET_IS_SEARCHING'; payload: boolean }
  | { type: 'RESET_SEARCH' };

// Actions interface (matching the Zustand store API)
interface UsersActions {
  setSearchQuery: (query: string) => void;
  setPendingSearchQuery: (query: string) => void;
  setIsSearching: (searching: boolean) => void;
  resetSearch: () => void;
}

// Context value interface
interface UsersContextValue extends UsersState, UsersActions {}

// Initial state (matching the Zustand store)
const createInitialState = (): UsersState => ({
  searchQuery: '',
  pendingSearchQuery: '',
  isSearching: false,
});

// Reducer function
function usersReducer(state: UsersState, action: UsersAction): UsersState {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload,
      };
    
    case 'SET_PENDING_SEARCH_QUERY':
      return {
        ...state,
        pendingSearchQuery: action.payload,
      };
    
    case 'SET_IS_SEARCHING':
      return {
        ...state,
        isSearching: action.payload,
      };
    
    case 'RESET_SEARCH':
      return createInitialState();
    
    default:
      return state;
  }
}

// Create context
const UsersContext = createContext<UsersContextValue | null>(null);

// Provider component
interface UsersProviderProps {
  children: React.ReactNode;
}

export const UsersProvider: React.FC<UsersProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(usersReducer, createInitialState());

  // Memoized action creators (same API as Zustand store)
  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  }, []);

  const setPendingSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_PENDING_SEARCH_QUERY', payload: query });
  }, []);

  const setIsSearching = useCallback((searching: boolean) => {
    dispatch({ type: 'SET_IS_SEARCHING', payload: searching });
  }, []);

  const resetSearch = useCallback(() => {
    dispatch({ type: 'RESET_SEARCH' });
  }, []);

  // Memoized context value
  const contextValue = useMemo((): UsersContextValue => ({
    // State
    searchQuery: state.searchQuery,
    pendingSearchQuery: state.pendingSearchQuery,
    isSearching: state.isSearching,
    // Actions
    setSearchQuery,
    setPendingSearchQuery,
    setIsSearching,
    resetSearch,
  }), [
    state.searchQuery,
    state.pendingSearchQuery,
    state.isSearching,
    setSearchQuery,
    setPendingSearchQuery,
    setIsSearching,
    resetSearch,
  ]);

  return (
    <UsersContext.Provider value={contextValue}>
      {children}
    </UsersContext.Provider>
  );
};

// Hook to use the context (same API as useUsersStore)
export const useUsersContext = (): UsersContextValue => {
  const context = useContext(UsersContext);
  if (!context) {
    throw new Error('useUsersContext must be used within a UsersProvider');
  }
  return context;
}; 