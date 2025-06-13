import { useCallback, useEffect, useRef } from 'react';
import { useFeedTabsActiveTabIndex } from '@/lib/stores/feedTabsStore';

/**
 * Accessibility hook for FeedTabsContainer
 * 
 * Provides:
 * - ARIA labels and descriptions
 * - Keyboard navigation support
 * - Screen reader announcements
 * - Focus management
 * - Edge Runtime optimized accessibility features
 */
export const useFeedTabsAccessibility = () => {
  const activeTabIndex = useFeedTabsActiveTabIndex();
  const announcementRef = useRef<HTMLDivElement | null>(null);

  /**
   * Create live region for screen reader announcements
   */
  useEffect(() => {
    // Create announcement region if it doesn't exist
    if (!announcementRef.current) {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.id = 'feed-tabs-announcements';
      document.body.appendChild(announcement);
      announcementRef.current = announcement;
    }

    return () => {
      // Cleanup on unmount
      if (announcementRef.current && document.body.contains(announcementRef.current)) {
        document.body.removeChild(announcementRef.current);
      }
    };
  }, []);

  /**
   * Announce tab changes to screen readers
   */
  const announceTabChange = useCallback((tabName: string, isLoading: boolean = false) => {
    if (announcementRef.current) {
      const message = isLoading 
        ? `Loading ${tabName} content...`
        : `Switched to ${tabName} tab`;
      
      announcementRef.current.textContent = message;
    }
  }, []);

  /**
   * Announce loading states
   */
  const announceLoadingState = useCallback((tabName: string, isLoading: boolean) => {
    if (announcementRef.current) {
      const message = isLoading 
        ? `Loading ${tabName} content...`
        : `${tabName} content loaded`;
      
      announcementRef.current.textContent = message;
    }
  }, []);

  /**
   * Announce errors to screen readers
   */
  const announceError = useCallback((error: string) => {
    if (announcementRef.current) {
      announcementRef.current.textContent = `Error: ${error}`;
    }
  }, []);

  /**
   * Get ARIA properties for tab container
   */
  const getTabContainerProps = useCallback(() => ({
    role: 'tablist',
    'aria-label': 'Feed content tabs',
    'aria-orientation': 'horizontal' as const
  }), []);

  /**
   * Get ARIA properties for individual tabs
   */
  const getTabProps = useCallback((index: number, label: string) => ({
    role: 'tab',
    'aria-selected': activeTabIndex === index,
    'aria-controls': `tabpanel-${index}`,
    id: `tab-${index}`,
    'aria-label': `${label} tab`,
    tabIndex: activeTabIndex === index ? 0 : -1
  }), [activeTabIndex]);

  /**
   * Get ARIA properties for tab panels
   */
  const getTabPanelProps = useCallback((index: number, label: string) => ({
    role: 'tabpanel',
    'aria-labelledby': `tab-${index}`,
    id: `tabpanel-${index}`,
    'aria-label': `${label} content`,
    tabIndex: 0
  }), []);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((
    event: React.KeyboardEvent,
    onTabChange: (index: number) => void,
    tabCount: number = 2
  ) => {
    const { key } = event;
    
    switch (key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = activeTabIndex === 0 ? tabCount - 1 : activeTabIndex - 1;
        onTabChange(prevIndex);
        break;
        
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = activeTabIndex === tabCount - 1 ? 0 : activeTabIndex + 1;
        onTabChange(nextIndex);
        break;
        
      case 'Home':
        event.preventDefault();
        onTabChange(0);
        break;
        
      case 'End':
        event.preventDefault();
        onTabChange(tabCount - 1);
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        // Tab is already active, just announce it
        const tabName = activeTabIndex === 0 ? 'Discover' : 'Following';
        announceTabChange(tabName);
        break;
    }
  }, [activeTabIndex, announceTabChange]);

  /**
   * Get loading announcement for current tab
   */
  const getLoadingAnnouncement = useCallback((isLoading: boolean) => {
    const tabName = activeTabIndex === 0 ? 'Discover' : 'Following';
    return isLoading ? `Loading ${tabName} content` : `${tabName} content loaded`;
  }, [activeTabIndex]);

  /**
   * Get current tab description for screen readers
   */
  const getCurrentTabDescription = useCallback(() => {
    const descriptions = {
      0: 'Discover new content and featured posts',
      1: 'View posts from feeds you follow'
    };
    return descriptions[activeTabIndex as keyof typeof descriptions] || '';
  }, [activeTabIndex]);

  /**
   * Focus management for tab switching
   */
  const focusActiveTab = useCallback(() => {
    const activeTab = document.getElementById(`tab-${activeTabIndex}`);
    if (activeTab) {
      activeTab.focus();
    }
  }, [activeTabIndex]);

  return {
    announceTabChange,
    announceLoadingState,
    announceError,
    getTabContainerProps,
    getTabProps,
    getTabPanelProps,
    handleKeyDown,
    getLoadingAnnouncement,
    getCurrentTabDescription,
    focusActiveTab
  };
}; 