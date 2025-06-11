import { useCallback, useRef } from 'react';
import { useUserLikesFeedStore } from '@/lib/stores/userLikesFeedStore';
import { useFeedFocusPrevention } from '@/utils/FeedInteraction';

interface UseLikesFeedUIProps {
  isActive: boolean;
}

export function useLikesFeedUI({ isActive }: UseLikesFeedUIProps) {
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Use Zustand store for UI state management
  const {
    commentDrawerOpen,
    selectedCommentEntry,
    setCommentDrawerOpen,
    setSelectedCommentEntry,
  } = useUserLikesFeedStore();

  // Use the shared focus prevention hook
  useFeedFocusPrevention(isActive && !commentDrawerOpen, '.user-likes-feed-container');

  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    if (!isMountedRef.current) return;
    
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, [setSelectedCommentEntry, setCommentDrawerOpen]);

  return {
    // State
    commentDrawerOpen,
    selectedCommentEntry,
    
    // Actions
    handleOpenCommentDrawer,
    setCommentDrawerOpen,
  };
} 