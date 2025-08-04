"use client";

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { EntriesState, EntriesActions, EntriesRSSEntry, EntriesLoadingState } from '@/lib/types';

// State interface (same as EntriesState)
interface EntriesContextState extends EntriesState {}

// Action types for useReducer
type EntriesAction = 
  | { type: 'SET_ENTRIES'; payload: EntriesRSSEntry[] }
  | { type: 'ADD_ENTRIES'; payload: EntriesRSSEntry[] }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_HAS_MORE'; payload: boolean }
  | { type: 'SET_LAST_SEARCH_QUERY'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_INITIAL_LOAD'; payload: boolean }
  | { type: 'SET_METRICS_LOADING'; payload: boolean }
  | { type: 'SET_COMMENT_DRAWER_OPEN'; payload: boolean }
  | { type: 'SET_SELECTED_COMMENT_ENTRY'; payload: EntriesState['selectedCommentEntry'] }
  | { type: 'RESET' };

// Initial state factory (same as entriesStore.ts)
const createInitialState = (): EntriesContextState => ({
  entries: [],
  page: 1,
  hasMore: true,
  lastSearchQuery: '',
  loadingState: {
    isLoading: false,
    isInitialLoad: true,
    isMetricsLoading: false,
  },
  commentDrawerOpen: false,
  selectedCommentEntry: null,
});

// Reducer function (same logic as entriesStore.ts actions)
const entriesReducer = (state: EntriesContextState, action: EntriesAction): EntriesContextState => {
  switch (action.type) {
    case 'SET_ENTRIES':
      return { ...state, entries: action.payload };
    
    case 'ADD_ENTRIES':
      return { ...state, entries: [...state.entries, ...action.payload] };
    
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    
    case 'SET_HAS_MORE':
      return { ...state, hasMore: action.payload };
    
    case 'SET_LAST_SEARCH_QUERY':
      return { ...state, lastSearchQuery: action.payload };
    
    case 'SET_LOADING':
      return {
        ...state,
        loadingState: {
          ...state.loadingState,
          isLoading: action.payload,
        },
      };
    
    case 'SET_INITIAL_LOAD':
      return {
        ...state,
        loadingState: {
          ...state.loadingState,
          isInitialLoad: action.payload,
        },
      };
    
    case 'SET_METRICS_LOADING':
      return {
        ...state,
        loadingState: {
          ...state.loadingState,
          isMetricsLoading: action.payload,
        },
      };
    
    case 'SET_COMMENT_DRAWER_OPEN':
      return { ...state, commentDrawerOpen: action.payload };
    
    case 'SET_SELECTED_COMMENT_ENTRY':
      return { ...state, selectedCommentEntry: action.payload };
    
    case 'RESET':
      return createInitialState();
    
    default:
      return state;
  }
};

// Context type
interface EntriesContextType extends EntriesState, EntriesActions {}

// Create contexts
const EntriesContext = createContext<EntriesContextType | null>(null);

// Provider component
interface EntriesProviderProps {
  children: React.ReactNode;
}

export const EntriesProvider: React.FC<EntriesProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(entriesReducer, createInitialState());

  // Individual useCallback hooks at top level (not inside useMemo)
  const setEntries = useCallback((entries: EntriesRSSEntry[]) => {
    dispatch({ type: 'SET_ENTRIES', payload: entries });
  }, []);

  const addEntries = useCallback((entries: EntriesRSSEntry[]) => {
    dispatch({ type: 'ADD_ENTRIES', payload: entries });
  }, []);

  const setPage = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  const setHasMore = useCallback((hasMore: boolean) => {
    dispatch({ type: 'SET_HAS_MORE', payload: hasMore });
  }, []);

  const setLastSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_LAST_SEARCH_QUERY', payload: query });
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: isLoading });
  }, []);

  const setInitialLoad = useCallback((isInitialLoad: boolean) => {
    dispatch({ type: 'SET_INITIAL_LOAD', payload: isInitialLoad });
  }, []);

  const setMetricsLoading = useCallback((isMetricsLoading: boolean) => {
    dispatch({ type: 'SET_METRICS_LOADING', payload: isMetricsLoading });
  }, []);

  const setCommentDrawerOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_COMMENT_DRAWER_OPEN', payload: open });
  }, []);

  const setSelectedCommentEntry = useCallback((entry: EntriesState['selectedCommentEntry']) => {
    dispatch({ type: 'SET_SELECTED_COMMENT_ENTRY', payload: entry });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Memoized context value with stable dependencies
  const contextValue = useMemo(() => ({
    // State
    entries: state.entries,
    page: state.page,
    hasMore: state.hasMore,
    lastSearchQuery: state.lastSearchQuery,
    loadingState: state.loadingState,
    commentDrawerOpen: state.commentDrawerOpen,
    selectedCommentEntry: state.selectedCommentEntry,
    // Actions
    setEntries,
    addEntries,
    setPage,
    setHasMore,
    setLastSearchQuery,
    setLoading,
    setInitialLoad,
    setMetricsLoading,
    setCommentDrawerOpen,
    setSelectedCommentEntry,
    reset,
  }), [
    state.entries,
    state.page,
    state.hasMore,
    state.lastSearchQuery,
    state.loadingState,
    state.commentDrawerOpen,
    state.selectedCommentEntry,
    setEntries,
    addEntries,
    setPage,
    setHasMore,
    setLastSearchQuery,
    setLoading,
    setInitialLoad,
    setMetricsLoading,
    setCommentDrawerOpen,
    setSelectedCommentEntry,
    reset,
  ]);

  return (
    <EntriesContext.Provider value={contextValue}>
      {children}
    </EntriesContext.Provider>
  );
};

// Hook to use the context (same API as useEntriesStore)
export const useEntriesContext = (): EntriesContextType => {
  const context = useContext(EntriesContext);
  if (!context) {
    throw new Error('useEntriesContext must be used within an EntriesProvider');
  }
  return context;
}; 