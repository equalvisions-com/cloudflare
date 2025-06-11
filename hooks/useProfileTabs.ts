import { useCallback, useTransition } from 'react';
import { Id } from "@/convex/_generated/dataModel";
import { useProfileTabsStore } from '@/lib/stores/profileTabsStore';
import { ProfileFeedData, UseProfileTabsProps } from '@/lib/types';

export function useProfileTabs({ userId, pageSize, initialLikesData }: UseProfileTabsProps) {
  const [isPending, startTransition] = useTransition();
  
  const {
    selectedTabIndex,
    likesData,
    likesStatus,
    likesError,
    setSelectedTabIndex,
    setLikesData,
    setLikesStatus,
    setLikesError,
    setIsPending,
  } = useProfileTabsStore();

  // Initialize likes data if provided - direct initialization during render
  if (initialLikesData && likesStatus === 'idle' && !likesData) {
    setLikesData(initialLikesData);
    setLikesStatus('loaded');
  }

  const fetchLikesData = useCallback(async () => {
    if (likesStatus !== 'idle') return;
    
    setLikesStatus('loading');
    
    try {
      const response = await fetch(`/api/likes?userId=${userId}&skip=0&limit=${pageSize}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch likes: ${response.status}`);
      }
      
      const data = await response.json();
      setLikesData(data);
      setLikesStatus('loaded');
      setLikesError(null);
    } catch (error) {
      setLikesError(error instanceof Error ? error : new Error('Unknown error occurred'));
      setLikesStatus('error');
      setLikesData(null);
    }
  }, [userId, pageSize, likesStatus, setLikesData, setLikesStatus, setLikesError]);

  const handleTabChange = useCallback((index: number) => {
    startTransition(() => {
      setSelectedTabIndex(index);
      
      // If switching to likes tab (index 1) and likes haven't been loaded
      if (index === 1 && likesStatus === 'idle') {
        fetchLikesData();
      }
    });
  }, [setSelectedTabIndex, likesStatus, fetchLikesData]);

  return {
    selectedTabIndex,
    likesData,
    likesStatus,
    likesError,
    isPending: isPending || likesStatus === 'loading',
    handleTabChange,
  };
} 