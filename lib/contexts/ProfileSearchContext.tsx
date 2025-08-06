"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Id } from '@/convex/_generated/dataModel';
import { ProfileFeedData } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';

type ProfileTab = 'activity' | 'likes';

interface ProfileSearchResults {
  activity: ProfileFeedData | null;
  likes: ProfileFeedData | null;
}

interface ProfileSearchContextType {
  // Search state
  searchQuery: string;
  searchResults: ProfileSearchResults;
  isSearching: boolean;
  activeTab: ProfileTab;
  
  // Actions
  handleSearch: (query: string) => Promise<void>;
  handleClearSearch: () => void;
  setActiveTab: (tab: ProfileTab) => void;
}

const ProfileSearchContext = createContext<ProfileSearchContextType | undefined>(undefined);

interface ProfileSearchProviderProps {
  children: React.ReactNode;
  userId: Id<"users"> | null;
  profileUserId: Id<"users">;
  username: string;
}

export const ProfileSearchProvider = React.memo(({ 
  children, 
  userId, 
  profileUserId, 
  username 
}: ProfileSearchProviderProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileSearchResults>({
    activity: null,
    likes: null
  });
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTabState] = useState<ProfileTab>('activity');
  const { toast } = useToast();
  
  // Refs for cleanup and preventing memory leaks
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount - prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, []);

  // Debounced search function - prevents excessive API calls
  const debouncedSearch = useCallback(async (query: string, tab: ProfileTab) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current || !userId) return;

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController
      abortControllerRef.current = new AbortController();
      
      if (!isMountedRef.current) return;

      try {
        // Determine API endpoint based on active tab
        const endpoint = tab === 'activity' 
          ? `/api/profile/activity/search`
          : `/api/profile/likes/search`;

        const response = await fetch(endpoint, { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: profileUserId,
            currentUserId: userId,
            query,
            limit: 30
          }),
          signal: abortControllerRef.current.signal 
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }

        const data: ProfileFeedData = await response.json();
        
        // Only update state if component is still mounted and request wasn't aborted
        if (isMountedRef.current && !abortControllerRef.current.signal.aborted) {
          setSearchResults(prev => ({
            ...prev,
            [tab]: data
          }));
        }
      } catch (error) {
        // Don't show error for aborted requests or if component unmounted
        if (!isMountedRef.current || (error instanceof Error && error.name === 'AbortError')) {
          return;
        }
        
        console.error('Profile search failed:', error);
        toast({
          title: "Search failed",
          description: `Unable to search ${tab}. Please try again.`,
          variant: "destructive",
        });
        
        if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
          setSearchResults(prev => ({
            ...prev,
            [tab]: null
          }));
        }
      } finally {
        if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300); // 300ms debounce
  }, [userId, profileUserId, toast]);

  const handleClearSearch = useCallback(() => {
    // Clear debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    // Cancel any ongoing search request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setSearchQuery('');
    setSearchResults({
      activity: null,
      likes: null
    });
    setIsSearching(false);
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (!userId) {
      console.error('Unexpected: userId is null on protected route');
      return;
    }

    if (!query.trim()) {
      handleClearSearch();
      return;
    }

    // Set both searchQuery and isSearching together in a single batch to prevent blinking
    flushSync(() => {
      setSearchQuery(query);
      setIsSearching(true);
    });
    await debouncedSearch(query, activeTab);
  }, [userId, debouncedSearch, handleClearSearch, activeTab]);

  // Tab switching with search reset
  const setActiveTab = useCallback((tab: ProfileTab) => {
    // Clear search when switching tabs
    if (searchQuery) {
      handleClearSearch();
    }
    setActiveTabState(tab);
  }, [searchQuery, handleClearSearch]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo((): ProfileSearchContextType => ({
    searchQuery,
    searchResults,
    isSearching,
    activeTab,
    handleSearch,
    handleClearSearch,
    setActiveTab,
  }), [searchQuery, searchResults, isSearching, activeTab, handleSearch, handleClearSearch, setActiveTab]);

  return (
    <ProfileSearchContext.Provider value={contextValue}>
      {children}
    </ProfileSearchContext.Provider>
  );
});

ProfileSearchProvider.displayName = 'ProfileSearchProvider';

export const useProfileSearchContext = () => {
  const context = useContext(ProfileSearchContext);
  if (context === undefined) {
    throw new Error('useProfileSearchContext must be used within a ProfileSearchProvider');
  }
  return context;
};