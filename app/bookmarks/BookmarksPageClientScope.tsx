"use client";

import { BookmarksHeader } from "./BookmarksHeader";
import { BookmarksProvider } from "./BookmarksContext";
import { ReactNode, memo, useReducer, useEffect, useCallback, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar-context";
import { BookmarksData } from "@/lib/types";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import dynamic from 'next/dynamic';

// Enhanced error component for data fetching failures
const BookmarksDataError = memo(({ onRetry, errorMessage }: { onRetry?: () => void; errorMessage?: string }) => (
  <div className="flex-1 p-6 text-center">
    <div className="p-8 border border-red-200 rounded-lg bg-red-50">
      <h2 className="text-xl font-semibold mb-2 text-red-800">Failed to load bookmarks</h2>
      <p className="text-red-600 mb-4">
        {errorMessage || "Unable to fetch your bookmarks. Please try again."}
      </p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Retry loading bookmarks"
        >
          Retry
        </button>
      )}
    </div>
  </div>
));
BookmarksDataError.displayName = 'BookmarksDataError';

// Single dynamic import - eliminates the double dynamic import anti-pattern
const DynamicBookmarksContent = dynamic(
  () => import("./BookmarksContent").then(mod => mod.BookmarksContent),
  { 
    ssr: false, 
    loading: () => <SkeletonFeed count={5} />
  }
);

interface BookmarksPageClientScopeProps {
  rightSidebar: ReactNode;
}

// Enhanced error types for better error handling
enum BookmarksErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface BookmarksError {
  type: BookmarksErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
}

// State management with useReducer for better performance
interface BookmarksState {
  initialData: BookmarksData | null;
  isLoading: boolean;
  error: BookmarksError | null;
  lastFetchTime: number | null;
  retryCount: number;
}

type BookmarksAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: BookmarksData }
  | { type: 'FETCH_ERROR'; payload: BookmarksError }
  | { type: 'RETRY'; payload: { retryCount: number } }
  | { type: 'RESET' };

const initialBookmarksState: BookmarksState = {
  initialData: null,
  isLoading: false,
  error: null,
  lastFetchTime: null,
  retryCount: 0
};

const bookmarksReducer = (state: BookmarksState, action: BookmarksAction): BookmarksState => {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        isLoading: true,
        error: null
      };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        initialData: action.payload,
        isLoading: false,
        error: null,
        lastFetchTime: Date.now(),
        retryCount: 0
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        lastFetchTime: Date.now()
      };
    case 'RETRY':
      return {
        ...state,
        retryCount: action.payload.retryCount,
        error: null
      };
    case 'RESET':
      return initialBookmarksState;
    default:
      return state;
  }
};

// Enhanced error classification for better UX
const classifyError = (error: unknown): BookmarksError => {
  if (error instanceof Error) {
    // HTTP status code errors
    if (error.message.includes('HTTP 401') || error.message.includes('Unauthorized')) {
      return {
        type: BookmarksErrorType.AUTHENTICATION_ERROR,
        message: error.message,
        userMessage: "Authentication failed. Please sign in again.",
        retryable: false
      };
    }
    
    if (error.message.includes('HTTP 403') || error.message.includes('Forbidden')) {
      return {
        type: BookmarksErrorType.AUTHENTICATION_ERROR,
        message: error.message,
        userMessage: "Access denied. Please check your permissions.",
        retryable: false
      };
    }
    
    if (error.message.includes('HTTP 404') || error.message.includes('Not Found')) {
      return {
        type: BookmarksErrorType.SERVER_ERROR,
        message: error.message,
        userMessage: "Bookmarks service not found. Please try again later.",
        retryable: true
      };
    }
    
    if (error.message.includes('HTTP 429') || error.message.includes('Too Many Requests')) {
      return {
        type: BookmarksErrorType.SERVER_ERROR,
        message: error.message,
        userMessage: "Too many requests. Please wait a moment and try again.",
        retryable: true
      };
    }
    
    if (error.message.includes('HTTP 5') || error.message.includes('Internal Server Error')) {
      return {
        type: BookmarksErrorType.SERVER_ERROR,
        message: error.message,
        userMessage: "Server error occurred. Please try again later.",
        retryable: true
      };
    }
    
    // Network and fetch errors
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
      return {
        type: BookmarksErrorType.NETWORK_ERROR,
        message: error.message,
        userMessage: "Network connection failed. Please check your internet connection.",
        retryable: true
      };
    }
    
    // Timeout errors (including AbortError)
    if (error.message.includes('timeout') || error.message.includes('aborted') || error.name === 'AbortError') {
      return {
        type: BookmarksErrorType.TIMEOUT_ERROR,
        message: error.message,
        userMessage: "Request timed out. Please try again.",
        retryable: true
      };
    }
    
    // Legacy authentication errors (for backward compatibility)
    if (error.message.includes('auth') || error.message.includes('unauthorized')) {
      return {
        type: BookmarksErrorType.AUTHENTICATION_ERROR,
        message: error.message,
        userMessage: "Authentication failed. Please sign in again.",
        retryable: false
      };
    }
    
    // Legacy server errors (for backward compatibility)
    if (error.message.includes('server')) {
      return {
        type: BookmarksErrorType.SERVER_ERROR,
        message: error.message,
        userMessage: "Server error occurred. Please try again later.",
        retryable: true
      };
    }
  }
  
  // Unknown errors
  return {
    type: BookmarksErrorType.UNKNOWN_ERROR,
    message: error instanceof Error ? error.message : 'Unknown error',
    userMessage: "An unexpected error occurred. Please try again.",
    retryable: true
  };
};

const BookmarksPageClientScopeComponent = ({ rightSidebar }: BookmarksPageClientScopeProps) => {
  const { userId } = useSidebar();
  const [state, dispatch] = useReducer(bookmarksReducer, initialBookmarksState);
  
  // Memory leak prevention with refs
  const abortControllerRef = useRef<AbortController>(undefined);
  const isMountedRef = useRef(true);
  const lastRequestIdRef = useRef<string>("");
  const retryTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  // Memory leak prevention: cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Cleanup: abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = undefined;
      }
      
      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = undefined;
      }
    };
  }, []);

  // Performance optimization: Request deduplication with caching
  const fetchInitialData = useCallback(async (retryAttempt: number = 0) => {
    // Note: Authentication is guaranteed by middleware protection
    if (!userId) {
      console.warn('Unexpected: userId is null on protected route');
      return;
    }

    // Request deduplication: generate unique request ID
    const requestId = `${userId}-${Date.now()}-${retryAttempt}`;
    
    // Skip if same request is already in progress
    if (requestId === lastRequestIdRef.current) {
      return;
    }
    
    lastRequestIdRef.current = requestId;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    if (!isMountedRef.current) return;
    dispatch({ type: 'FETCH_START' });
    
    try {
      // Phase 3: Edge Runtime optimization - Direct API call instead of server action
      const response = await fetch(`/api/bookmarks?skip=0&limit=30`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
        // Edge Runtime optimization: Add caching headers
        cache: 'no-store', // Ensure fresh data for bookmarks
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Only update state if component is still mounted and request wasn't aborted
      if (isMountedRef.current && !signal.aborted) {
        dispatch({ type: 'FETCH_SUCCESS', payload: data as BookmarksData });
      }
    } catch (error) {
      // Don't show error for aborted requests or if component unmounted
      if (!isMountedRef.current || signal.aborted) {
        return;
      }
      
      const enhancedError = classifyError(error);
      
      if (isMountedRef.current) {
        dispatch({ type: 'FETCH_ERROR', payload: enhancedError });
      }
    }
  }, [userId]);

  // Enhanced retry mechanism with exponential backoff
  const handleRetry = useCallback(() => {
    if (!isMountedRef.current) return;
    
    const newRetryCount = state.retryCount + 1;
    const maxRetries = 3;
    
    if (newRetryCount > maxRetries) {
      const maxRetriesError: BookmarksError = {
        type: BookmarksErrorType.UNKNOWN_ERROR,
        message: 'Maximum retry attempts exceeded',
        userMessage: 'Unable to load bookmarks after multiple attempts. Please refresh the page.',
        retryable: false
      };
      dispatch({ type: 'FETCH_ERROR', payload: maxRetriesError });
      return;
    }
    
    dispatch({ type: 'RETRY', payload: { retryCount: newRetryCount } });
    
    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, newRetryCount - 1) * 1000;
    
    retryTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        fetchInitialData(newRetryCount);
      }
    }, delay);
  }, [state.retryCount, fetchInitialData]);

  // Initial data fetch
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Handle loading state
  if (state.isLoading && !state.initialData) {
    return (
      <BookmarksProvider userId={userId ?? null}>
        <BookmarksHeader />
        <SkeletonFeed count={5} />
      </BookmarksProvider>
    );
  }

  // Handle error state with enhanced retry
  if (state.error) {
    return (
      <BookmarksProvider userId={userId ?? null}>
        <BookmarksHeader />
        <BookmarksDataError 
          onRetry={state.error.retryable ? handleRetry : undefined}
          errorMessage={state.error.userMessage}
        />
      </BookmarksProvider>
    );
  }
  
  return (
    <BookmarksProvider userId={userId ?? null}>
      <BookmarksHeader />
      <ErrorBoundary fallback={({ retry }) => (
        <BookmarksDataError onRetry={retry} />
      )}>
        <DynamicBookmarksContent 
          userId={userId ?? null}
          initialData={state.initialData}
        />
      </ErrorBoundary>
    </BookmarksProvider>
  );
};

export const BookmarksPageClientScope = memo(BookmarksPageClientScopeComponent);
BookmarksPageClientScope.displayName = 'BookmarksPageClientScope'; 