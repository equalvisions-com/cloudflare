"use client";

import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { FeaturedPostsWidgetPost } from '@/lib/types';

interface WidgetDataContextType {
  widgetPosts: FeaturedPostsWidgetPost[] | undefined;
  followStates: boolean[] | undefined;
  isLoading: boolean;
  isLoadingFollowStates: boolean;
  error: boolean;
}

const WidgetDataContext = createContext<WidgetDataContextType | undefined>(undefined);

interface WidgetDataProviderProps {
  children: React.ReactNode;
}

export function WidgetDataProvider({ children }: WidgetDataProviderProps) {
  const { isAuthenticated } = useConvexAuth();
  
  // Single query for all widget posts - shared between FeaturedPostsWidget and TrendingWidget
  const widgetPosts = useQuery(api.widgets.getPublicWidgetPosts, { limit: 6 });
  
  // Single query for follow states - shared between widgets
  const postIdsToFetch = (!isAuthenticated || !widgetPosts) 
    ? null 
    : widgetPosts.map(p => p._id);

  const followStates = useQuery(
    api.following.getFollowStates,
    postIdsToFetch ? { postIds: postIdsToFetch } : "skip"
  );
  
  // CRITICAL FIX: Remove isAuthenticated from dependencies to prevent remounting during auth refresh
  // Only include the actual data values that should trigger context updates
  const contextValue = useMemo(() => ({
    widgetPosts,
    followStates,
    isLoading: widgetPosts === undefined,
    isLoadingFollowStates: isAuthenticated && widgetPosts !== undefined && followStates === undefined,
    error: widgetPosts === null
  }), [widgetPosts, followStates]); // Removed isAuthenticated from dependencies

  return (
    <WidgetDataContext.Provider value={contextValue}>
      {children}
    </WidgetDataContext.Provider>
  );
}

export function useWidgetData() {
  const context = useContext(WidgetDataContext);
  if (context === undefined) {
    throw new Error('useWidgetData must be used within a WidgetDataProvider');
  }
  return context;
} 