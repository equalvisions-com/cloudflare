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
    console.error('❌ CONTEXT: useAppendedEntries called outside of AppendedEntriesProvider!');
    throw new Error('useAppendedEntries must be used within an AppendedEntriesProvider');
  }
  // Debug: Context accessed successfully
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
    console.log('🗂️ CONTEXT: New entries being stored:', entries.map(e => e.entry.title));
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
    const isRecent = followingEntries.length > 0 && (Date.now() - lastAppendTime < maxAge);
    console.log('⏰ CONTEXT: Checking if entries are recent:', {
      entriesCount: followingEntries.length,
      ageMs: Date.now() - lastAppendTime,
      maxAgeMs: maxAge,
      isRecent
    });
    return isRecent;
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
      setFollowingEntries([]);
      setLastAppendTime(0);
    };
  }, []); // Empty deps - only run on unmount
  
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