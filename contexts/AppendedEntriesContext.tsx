'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { RSSEntriesDisplayEntry } from '@/lib/types';

interface AppendedEntriesContextType {
  followingEntries: RSSEntriesDisplayEntry[];
  appendFollowingEntries: (entries: RSSEntriesDisplayEntry[]) => void;
  clearFollowingEntries: () => void;
  isRecentlyAppended: () => boolean;
}

const AppendedEntriesContext = createContext<AppendedEntriesContextType | null>(null);

export function useAppendedEntries() {
  const context = useContext(AppendedEntriesContext);
  if (!context) {
    throw new Error('useAppendedEntries must be used within an AppendedEntriesProvider');
  }
  return context;
}

interface AppendedEntriesProviderProps {
  children: React.ReactNode;
}

export function AppendedEntriesProvider({ children }: AppendedEntriesProviderProps) {
  const [followingEntries, setFollowingEntries] = useState<RSSEntriesDisplayEntry[]>([]);
  const [lastAppendTime, setLastAppendTime] = useState<number>(0);
  
  const appendFollowingEntries = useCallback((entries: RSSEntriesDisplayEntry[]) => {
    console.log('🗂️ CONTEXT: Storing', entries.length, 'appended entries for tab persistence');
    setFollowingEntries(entries);
    setLastAppendTime(Date.now());
  }, []);
  
  const clearFollowingEntries = useCallback(() => {
    console.log('🧹 CONTEXT: Clearing appended entries');
    setFollowingEntries([]);
    setLastAppendTime(0);
  }, []);
  
  const isRecentlyAppended = useCallback(() => {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return followingEntries.length > 0 && (Date.now() - lastAppendTime < maxAge);
  }, [followingEntries.length, lastAppendTime]);
  
  // Auto-clear entries after 5 minutes to prevent memory bloat
  useEffect(() => {
    if (followingEntries.length > 0) {
      const timeout = setTimeout(() => {
        console.log('⏰ CONTEXT: Auto-clearing expired appended entries');
        clearFollowingEntries();
      }, 5 * 60 * 1000); // 5 minutes
      
      return () => clearTimeout(timeout);
    }
  }, [followingEntries.length, lastAppendTime, clearFollowingEntries]);
  
  // Cleanup on unmount (navigation away from page)
  useEffect(() => {
    return () => {
      console.log('🚪 CONTEXT: Provider unmounting, clearing appended entries');
      if (followingEntries.length > 0) {
        setFollowingEntries([]);
        setLastAppendTime(0);
      }
    };
  }, [followingEntries.length]);
  
  const value = {
    followingEntries,
    appendFollowingEntries,
    clearFollowingEntries,
    isRecentlyAppended
  };
  
  return (
    <AppendedEntriesContext.Provider value={value}>
      {children}
    </AppendedEntriesContext.Provider>
  );
}