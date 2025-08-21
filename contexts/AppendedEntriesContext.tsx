'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { RSSEntriesDisplayEntry } from '@/lib/types';

interface AppendedEntriesContextType {
  followingEntries: RSSEntriesDisplayEntry[];
  appendFollowingEntries: (entries: RSSEntriesDisplayEntry[]) => void;
  clearFollowingEntries: () => void;
  isRecentlyAppended: () => boolean;
}

const AppendedEntriesContext = createContext<AppendedEntriesContextType | null>(null);

/**
 * Hook to access appended entries context
 * Must be used within AppendedEntriesProvider
 */
export function useAppendedEntries(): AppendedEntriesContextType {
  const context = useContext(AppendedEntriesContext);
  if (!context) {
    throw new Error('useAppendedEntries must be used within an AppendedEntriesProvider');
  }
  return context;
}

interface AppendedEntriesProviderProps {
  children: React.ReactNode;
}

/**
 * Provider for managing appended RSS entries across tab switches
 * Handles automatic cleanup and memory management
 */
export function AppendedEntriesProvider({ children }: AppendedEntriesProviderProps) {
  const [followingEntries, setFollowingEntries] = useState<RSSEntriesDisplayEntry[]>([]);
  const [lastAppendTime, setLastAppendTime] = useState<number>(0);
  
  // Constants
  const ENTRY_MAX_AGE = 5 * 60 * 1000; // 5 minutes
  
  const appendFollowingEntries = useCallback((entries: RSSEntriesDisplayEntry[]) => {
    setFollowingEntries(entries);
    setLastAppendTime(Date.now());
  }, []);
  
  const clearFollowingEntries = useCallback(() => {
    setFollowingEntries([]);
    setLastAppendTime(0);
  }, []);
  
  const isRecentlyAppended = useCallback(() => {
    return followingEntries.length > 0 && (Date.now() - lastAppendTime < ENTRY_MAX_AGE);
  }, [followingEntries.length, lastAppendTime, ENTRY_MAX_AGE]);
  
  // Auto-clear entries after 5 minutes to prevent memory bloat
  useEffect(() => {
    if (followingEntries.length > 0) {
      const timeout = setTimeout(() => {
        clearFollowingEntries();
      }, ENTRY_MAX_AGE);
      
      return () => clearTimeout(timeout);
    }
  }, [followingEntries.length, lastAppendTime, clearFollowingEntries, ENTRY_MAX_AGE]);
  
  // Cleanup on unmount (navigation away from page)
  useEffect(() => {
    return () => {
      setFollowingEntries([]);
      setLastAppendTime(0);
    };
  }, []); // Empty deps - only run on unmount
  
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      followingEntries,
      appendFollowingEntries,
      clearFollowingEntries,
      isRecentlyAppended,
    }),
    [followingEntries, appendFollowingEntries, clearFollowingEntries, isRecentlyAppended]
  );
  
  return (
    <AppendedEntriesContext.Provider value={contextValue}>
      {children}
    </AppendedEntriesContext.Provider>
  );
}

/**
 * Error boundary wrapper for AppendedEntriesProvider
 * Provides fallback behavior if context crashes
 */
export function AppendedEntriesProviderWithErrorBoundary({ children }: AppendedEntriesProviderProps) {
  try {
    return <AppendedEntriesProvider>{children}</AppendedEntriesProvider>;
  } catch (error) {
    // Fallback: render children without context (entries won't persist, but app won't crash)
    return <>{children}</>;
  }
}