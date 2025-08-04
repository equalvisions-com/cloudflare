import { useCallback } from 'react';

interface UseRSSEntriesCommentDrawerProps {
  commentDrawerOpen: boolean;
  selectedCommentEntry: {
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null;
  openCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  closeCommentDrawer: () => void;
}

/**
 * Custom hook for managing comment drawer state in RSS Entries Display
 * Follows React best practices - returns computed values and functions
 */
export const useRSSEntriesCommentDrawer = ({
  commentDrawerOpen,
  selectedCommentEntry,
  openCommentDrawer,
  closeCommentDrawer,
}: UseRSSEntriesCommentDrawerProps) => {

  // Handle opening comment drawer with proper data
  const handleOpenCommentDrawer = useCallback((
    entryGuid: string, 
    feedUrl: string, 
    initialData?: { count: number }
  ) => {
    openCommentDrawer(entryGuid, feedUrl, initialData);
  }, [openCommentDrawer]);

  // Handle closing comment drawer
  const handleCloseCommentDrawer = useCallback(() => {
    closeCommentDrawer();
  }, [closeCommentDrawer]);

  return {
    // Comment drawer state
    isOpen: commentDrawerOpen,
    selectedEntry: selectedCommentEntry,
    
    // Comment drawer actions
    open: handleOpenCommentDrawer,
    close: handleCloseCommentDrawer,
  };
}; 