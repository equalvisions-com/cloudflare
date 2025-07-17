"use client";

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { NewsletterItem } from '@/lib/types';

// State interfaces
interface NewslettersState {
  items: NewsletterItem[];
  selectedCategory: string | null;
  isLoading: boolean;
  error: string | null;
  lastAction: string | null;
  announceMessage: string | null;
}

// Action types
type NewslettersAction =
  | { type: 'SET_ITEMS'; payload: NewsletterItem[] }
  | { type: 'SET_SELECTED_CATEGORY'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ANNOUNCEMENT'; payload: string | null }
  | { type: 'RESET' };

// Context value interface
interface NewslettersContextValue {
  state: NewslettersState;
  dispatch: React.Dispatch<NewslettersAction>;
  setItems: (items: NewsletterItem[]) => void;
  setSelectedCategory: (category: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAnnouncement: (message: string | null) => void;
  reset: () => void;
}

// Initial state
const initialNewslettersState: NewslettersState = {
  items: [],
  selectedCategory: null,
  isLoading: false,
  error: null,
  lastAction: null,
  announceMessage: null,
};

// Reducer
function newslettersReducer(state: NewslettersState, action: NewslettersAction): NewslettersState {
  switch (action.type) {
    case 'SET_ITEMS': {
      const count = action.payload.length;
      const message = count > 0 
        ? `Loaded ${count} newsletter${count === 1 ? '' : 's'} successfully`
        : 'No newsletters available';
      
      return {
        ...state,
        items: action.payload,
        error: null,
        lastAction: 'items_loaded',
        announceMessage: message,
      };
    }
    
    case 'SET_SELECTED_CATEGORY': {
      const message = action.payload 
        ? `Selected ${action.payload} category`
        : 'Showing all newsletters';
      
      return {
        ...state,
        selectedCategory: action.payload,
        lastAction: 'category_selected',
        announceMessage: message,
      };
    }
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
        ...(action.payload && { error: null }),
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        lastAction: action.payload ? 'error_occurred' : 'error_cleared',
        announceMessage: action.payload || null,
      };
    
    case 'SET_ANNOUNCEMENT':
      return {
        ...state,
        announceMessage: action.payload,
      };
    
    case 'RESET':
      return initialNewslettersState;
    
    default:
      return state;
  }
}

// Context
const NewslettersContext = createContext<NewslettersContextValue | undefined>(undefined);

// Provider component
export function NewslettersProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(newslettersReducer, initialNewslettersState);

  // Memoized action creators
  const setItems = useCallback((items: NewsletterItem[]) => {
    dispatch({ type: 'SET_ITEMS', payload: items });
  }, []);

  const setSelectedCategory = useCallback((category: string | null) => {
    dispatch({ type: 'SET_SELECTED_CATEGORY', payload: category });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const setAnnouncement = useCallback((message: string | null) => {
    dispatch({ type: 'SET_ANNOUNCEMENT', payload: message });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Memoized context value
  const contextValue = useMemo((): NewslettersContextValue => ({
    state,
    dispatch,
    setItems,
    setSelectedCategory,
    setLoading,
    setError,
    setAnnouncement,
    reset,
  }), [
    state,
    setItems,
    setSelectedCategory,
    setLoading,
    setError,
    setAnnouncement,
    reset,
  ]);

  return (
    <NewslettersContext.Provider value={contextValue}>
      {children}
    </NewslettersContext.Provider>
  );
}

// Hook for consuming context
export function useNewslettersContext(): NewslettersContextValue {
  const context = useContext(NewslettersContext);
  if (context === undefined) {
    throw new Error('useNewslettersContext must be used within a NewslettersProvider');
  }
  return context;
}

// Hook to maintain compatibility with existing Zustand selector pattern
export function useNewslettersStore() {
  const { state } = useNewslettersContext();
  return {
    items: state.items,
    selectedCategory: state.selectedCategory,
    isLoading: state.isLoading,
    error: state.error,
    lastAction: state.lastAction,
    announceMessage: state.announceMessage,
  };
} 