import { useState, useCallback, useMemo } from 'react';
import { useAudio } from '@/components/audio-player/AudioContext';
import { useFeedFocusPrevention } from '@/utils/FeedInteraction';

interface UseActivityFeedUIProps {
  isActive: boolean;
}

export function useActivityFeedUI({ isActive }: UseActivityFeedUIProps) {
  // Drawer state for comments
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentEntry, setSelectedCommentEntry] = useState<{
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null>(null);

  // Use the shared focus prevention hook to prevent scrolling issues
  useFeedFocusPrevention(isActive && !commentDrawerOpen, '.user-activity-feed-container');

  // Stable callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, []);

  // Close comment drawer
  const handleCloseCommentDrawer = useCallback(() => {
    setCommentDrawerOpen(false);
    setSelectedCommentEntry(null);
  }, []);

  // Get audio context at the component level
  const { playTrack, currentTrack } = useAudio();

  // Memoize the Footer component
  const Footer = useMemo(() => {
    function VirtuosoFooter() {
      return null; // No footer needed
    }
    VirtuosoFooter.displayName = 'VirtuosoFooter';
    return VirtuosoFooter;
  }, []);

  // Container style for focus prevention
  const containerStyle = useMemo(() => ({
    // CSS properties to prevent focus scrolling
    scrollBehavior: 'auto' as const,
    WebkitOverflowScrolling: 'touch' as const,
    WebkitTapHighlightColor: 'transparent',
    outlineStyle: 'none' as const,
    WebkitUserSelect: 'none' as const,
    userSelect: 'none' as const,
    touchAction: 'manipulation' as const
  }), []);

  // Virtuoso configuration
  const virtuosoConfig = useMemo(() => ({
    useWindowScroll: true,
    overscan: 2000,
    components: {
      Footer: () => null
    },
    style: { 
      outline: 'none',
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
      WebkitUserSelect: 'none',
      userSelect: 'none'
    },
    className: "outline-none focus:outline-none focus-visible:outline-none",
    tabIndex: -1,
    increaseViewportBy: 800,
    atTopThreshold: 100,
    atBottomThreshold: 100,
  }), []);

  // Mouse down handler for focus prevention
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Prevent focus on non-interactive elements
    const target = e.target as HTMLElement;
    if (
      target.tagName !== 'BUTTON' && 
      target.tagName !== 'A' && 
      target.tagName !== 'INPUT' &&
      target.tagName !== 'TEXTAREA' &&
      !target.closest('button') && 
      !target.closest('a') && 
      !target.closest('input') &&
      !target.closest('textarea') &&
      !target.closest('[data-comment-input]')
    ) {
      e.preventDefault();
    }
  }, []);

  return {
    // State
    commentDrawerOpen,
    selectedCommentEntry,
    
    // Audio
    playTrack,
    currentTrack,
    
    // UI Components
    Footer,
    
    // Styles and configs
    containerStyle,
    virtuosoConfig,
    
    // Event handlers
    handleOpenCommentDrawer,
    handleCloseCommentDrawer,
    handleMouseDown,
  };
} 