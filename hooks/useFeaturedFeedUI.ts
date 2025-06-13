import { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  useFeaturedFeedActions,
  useFeaturedFeedUI,
  useFeaturedFeedAccessibility
} from '@/components/featured/FeaturedFeedStoreProvider';
import type { 
  UseFeaturedFeedUIProps, 
  UseFeaturedFeedUIReturn 
} from '@/lib/types';

// PHASE 4.3: Advanced accessibility constants for WCAG compliance
const ACCESSIBILITY_CONSTANTS = {
  // Screen reader announcements
  ANNOUNCEMENT_DELAY: 100, // ms delay before announcing
  ANNOUNCEMENT_DEBOUNCE: 500, // ms debounce for rapid changes
  MAX_ANNOUNCEMENT_LENGTH: 150, // characters
  
  // Keyboard navigation
  KEYBOARD_NAVIGATION_DELAY: 50, // ms delay for smooth navigation
  FOCUS_TRAP_SELECTOR: '[data-focusable="true"]',
  SKIP_LINK_SELECTOR: '[data-skip-link="true"]',
  
  // ARIA live regions
  LIVE_REGION_ID: 'featured-feed-announcements',
  STATUS_REGION_ID: 'featured-feed-status',
  
  // Focus management
  FOCUS_OUTLINE_OFFSET: '2px',
  FOCUS_OUTLINE_WIDTH: '2px',
  FOCUS_OUTLINE_COLOR: 'hsl(var(--ring))',
  
  // Timing constants
  LOADING_ANNOUNCEMENT_DELAY: 1000, // ms before announcing loading state
  ERROR_ANNOUNCEMENT_DELAY: 500, // ms before announcing errors
  SUCCESS_ANNOUNCEMENT_DELAY: 300, // ms before announcing success
} as const;

// PHASE 4.3: Screen reader announcement queue management
class AnnouncementQueue {
  private queue: Array<{ message: string; priority: 'low' | 'medium' | 'high'; timestamp: number }> = [];
  private isProcessing = false;
  private lastAnnouncement = '';
  private lastAnnouncementTime = 0;

  add(message: string, priority: 'low' | 'medium' | 'high' = 'medium'): void {
    // Avoid duplicate announcements within debounce period
    const now = Date.now();
    if (message === this.lastAnnouncement && 
        now - this.lastAnnouncementTime < ACCESSIBILITY_CONSTANTS.ANNOUNCEMENT_DEBOUNCE) {
      return;
    }

    // Truncate long messages for better screen reader experience
    const truncatedMessage = message.length > ACCESSIBILITY_CONSTANTS.MAX_ANNOUNCEMENT_LENGTH
      ? `${message.substring(0, ACCESSIBILITY_CONSTANTS.MAX_ANNOUNCEMENT_LENGTH)}...`
      : message;

    this.queue.push({
      message: truncatedMessage,
      priority,
      timestamp: now
    });

    this.process();
  }

  private async process(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    // Sort by priority (high > medium > low) and timestamp
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
    });

    const announcement = this.queue.shift();
    if (announcement) {
      await this.announce(announcement.message);
      this.lastAnnouncement = announcement.message;
      this.lastAnnouncementTime = announcement.timestamp;
    }

    this.isProcessing = false;

    // Process next announcement if queue is not empty
    if (this.queue.length > 0) {
      setTimeout(() => this.process(), ACCESSIBILITY_CONSTANTS.ANNOUNCEMENT_DELAY);
    }
  }

  private async announce(message: string): Promise<void> {
    return new Promise((resolve) => {
      // Create or update live region
      let liveRegion = document.getElementById(ACCESSIBILITY_CONSTANTS.LIVE_REGION_ID);
      if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = ACCESSIBILITY_CONSTANTS.LIVE_REGION_ID;
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);
      }

      // Clear and set new message
      liveRegion.textContent = '';
      setTimeout(() => {
        liveRegion!.textContent = message;
        resolve();
      }, ACCESSIBILITY_CONSTANTS.ANNOUNCEMENT_DELAY);
    });
  }

  clear(): void {
    this.queue = [];
    this.isProcessing = false;
  }
}

// PHASE 4.3: Keyboard navigation manager
class KeyboardNavigationManager {
  private focusableElements: HTMLElement[] = [];
  private currentFocusIndex = -1;
  private containerRef: React.RefObject<HTMLElement>;

  constructor(containerRef: React.RefObject<HTMLElement>) {
    this.containerRef = containerRef;
  }

  updateFocusableElements(): void {
    if (!this.containerRef.current) return;

    // Find all focusable elements within the container
    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[data-focusable="true"]'
    ].join(', ');

    this.focusableElements = Array.from(
      this.containerRef.current.querySelectorAll(focusableSelectors)
    ) as HTMLElement[];
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    const { key, ctrlKey, metaKey, shiftKey } = event;

    // Update focusable elements on each navigation attempt
    this.updateFocusableElements();

    switch (key) {
      case 'ArrowDown':
      case 'j': // Vim-style navigation
        event.preventDefault();
        this.focusNext();
        return true;

      case 'ArrowUp':
      case 'k': // Vim-style navigation
        event.preventDefault();
        this.focusPrevious();
        return true;

      case 'Home':
        if (ctrlKey || metaKey) {
          event.preventDefault();
          this.focusFirst();
          return true;
        }
        break;

      case 'End':
        if (ctrlKey || metaKey) {
          event.preventDefault();
          this.focusLast();
          return true;
        }
        break;

      case 'Enter':
      case ' ': // Space key
        // Let the focused element handle the activation
        return false;

      case 'Escape':
        event.preventDefault();
        this.blur();
        return true;

      default:
        return false;
    }

    return false;
  }

  private focusNext(): void {
    if (this.focusableElements.length === 0) return;

    this.currentFocusIndex = (this.currentFocusIndex + 1) % this.focusableElements.length;
    this.focusElement(this.currentFocusIndex);
  }

  private focusPrevious(): void {
    if (this.focusableElements.length === 0) return;

    this.currentFocusIndex = this.currentFocusIndex <= 0 
      ? this.focusableElements.length - 1 
      : this.currentFocusIndex - 1;
    this.focusElement(this.currentFocusIndex);
  }

  private focusFirst(): void {
    if (this.focusableElements.length === 0) return;
    this.currentFocusIndex = 0;
    this.focusElement(this.currentFocusIndex);
  }

  private focusLast(): void {
    if (this.focusableElements.length === 0) return;
    this.currentFocusIndex = this.focusableElements.length - 1;
    this.focusElement(this.currentFocusIndex);
  }

  private focusElement(index: number): void {
    const element = this.focusableElements[index];
    if (element) {
      element.focus();
      
      // Scroll element into view if needed
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }

  private blur(): void {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.blur) {
      activeElement.blur();
    }
    this.currentFocusIndex = -1;
  }

  focusEntry(entryId: string): void {
    const entryElement = document.querySelector(`[data-entry-id="${entryId}"]`) as HTMLElement;
    if (entryElement) {
      entryElement.focus();
      entryElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }
}

// PHASE 4.3: Focus management utilities
const createFocusManager = () => {
  let lastFocusedElement: HTMLElement | null = null;
  let focusTrapActive = false;

  return {
    saveFocus: () => {
      lastFocusedElement = document.activeElement as HTMLElement;
    },

    restoreFocus: () => {
      if (lastFocusedElement && lastFocusedElement.focus) {
        setTimeout(() => {
          lastFocusedElement?.focus();
        }, 0);
      }
    },

    trapFocus: (container: HTMLElement) => {
      if (focusTrapActive) return;
      focusTrapActive = true;

      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      container.addEventListener('keydown', handleTabKey);
      firstElement?.focus();

      return () => {
        container.removeEventListener('keydown', handleTabKey);
        focusTrapActive = false;
      };
    },

    releaseFocusTrap: () => {
      focusTrapActive = false;
    }
  };
};

/**
 * PHASE 4.3: Enhanced Featured Feed UI Management Hook
 * 
 * Provides comprehensive UI state management with advanced accessibility features:
 * - WCAG 2.1 AA compliance
 * - Screen reader support with announcement queue
 * - Advanced keyboard navigation (Arrow keys, Vim-style, Home/End)
 * - Focus management and focus trapping
 * - Live regions for dynamic content updates
 * - High contrast and reduced motion support
 * 
 * @param props - Configuration options for UI management
 * @returns UI management functions and state
 */
export function useFeaturedFeedUIManagement({
  isActive
}: UseFeaturedFeedUIProps): UseFeaturedFeedUIReturn {
  
  // Store state and actions
  const actions = useFeaturedFeedActions();
  const ui = useFeaturedFeedUI();
  const accessibility = useFeaturedFeedAccessibility();

  // PHASE 4.3: Advanced accessibility managers
  const announcementQueueRef = useRef<AnnouncementQueue>();
  const keyboardManagerRef = useRef<KeyboardNavigationManager>();
  const focusManagerRef = useRef<ReturnType<typeof createFocusManager>>();
  const containerRef = useRef<HTMLElement>(null);

  // Initialize accessibility managers
  if (!announcementQueueRef.current) {
    announcementQueueRef.current = new AnnouncementQueue();
  }

  if (!keyboardManagerRef.current) {
    keyboardManagerRef.current = new KeyboardNavigationManager(containerRef);
  }

  if (!focusManagerRef.current) {
    focusManagerRef.current = createFocusManager();
  }

  // PHASE 4.3: Enhanced screen reader announcements
  const announceToScreenReader = useCallback((message: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    if (!isActive) return;

    announcementQueueRef.current?.add(message, priority);
    actions.addAnnouncement(message);
  }, [isActive, actions]);

  // PHASE 4.3: Advanced keyboard navigation handler
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    if (!isActive || !accessibility.keyboardNavigationEnabled) return;

    const handled = keyboardManagerRef.current?.handleKeyDown(event);
    
    if (handled) {
      // Announce navigation action to screen readers
      const { key } = event;
      let announcement = '';
      
      switch (key) {
        case 'ArrowDown':
        case 'j':
          announcement = 'Moved to next item';
          break;
        case 'ArrowUp':
        case 'k':
          announcement = 'Moved to previous item';
          break;
        case 'Home':
          announcement = 'Moved to first item';
          break;
        case 'End':
          announcement = 'Moved to last item';
          break;
        case 'Escape':
          announcement = 'Navigation cleared';
          break;
      }
      
      if (announcement) {
        announceToScreenReader(announcement, 'low');
      }
    }
  }, [isActive, accessibility.keyboardNavigationEnabled, announceToScreenReader]);

  // PHASE 4.3: Enhanced focus management
  const focusEntry = useCallback((entryId: string) => {
    keyboardManagerRef.current?.focusEntry(entryId);
    actions.setFocusedEntry(entryId);
    announceToScreenReader(`Focused on entry: ${entryId}`, 'low');
  }, [actions, announceToScreenReader]);

  // PHASE 4.3: Comprehensive accessibility props generator
  const getAccessibilityProps = useCallback(() => {
    return {
      'role': 'feed',
      'aria-label': 'Featured content feed',
      'aria-live': 'polite',
      'aria-busy': ui.isActive ? 'false' : 'true',
      'aria-describedby': ACCESSIBILITY_CONSTANTS.STATUS_REGION_ID,
      'data-keyboard-navigation': accessibility.keyboardNavigationEnabled ? 'enabled' : 'disabled',
      'data-screen-reader-mode': accessibility.screenReaderMode ? 'enabled' : 'disabled',
      'tabIndex': isActive ? 0 : -1,
    };
  }, [ui.isActive, accessibility.keyboardNavigationEnabled, accessibility.screenReaderMode, isActive]);

  // PHASE 4.3: Enhanced comment drawer management with accessibility
  const handleCommentDrawer = useMemo(() => ({
    open: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
      // Save current focus before opening drawer
      focusManagerRef.current?.saveFocus();
      
      actions.openCommentDrawer(entryGuid, feedUrl, initialData);
      
      // Announce drawer opening
      const commentCount = initialData?.count || 0;
      announceToScreenReader(
        `Comments drawer opened. ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'} available.`,
        'medium'
      );
      
      // Set up focus trap for the drawer
      setTimeout(() => {
        const drawerElement = document.querySelector('[data-comment-drawer="true"]') as HTMLElement;
        if (drawerElement) {
          focusManagerRef.current?.trapFocus(drawerElement);
        }
      }, 100);
    },

    close: () => {
      actions.closeCommentDrawer();
      
      // Restore focus to previous element
      focusManagerRef.current?.restoreFocus();
      focusManagerRef.current?.releaseFocusTrap();
      
      // Announce drawer closing
      announceToScreenReader('Comments drawer closed', 'medium');
    },

    isOpen: ui.commentDrawerOpen,
    selectedEntry: ui.selectedCommentEntry
  }), [actions, ui.commentDrawerOpen, ui.selectedCommentEntry, announceToScreenReader]);

  // PHASE 4.3: Enhanced notification management with accessibility
  const notification = useMemo(() => ({
    show: ui.showNotification,
    count: ui.notificationCount,
    images: ui.notificationImages
  }), [ui.showNotification, ui.notificationCount, ui.notificationImages]);

  const setNotification = useCallback((show: boolean, count?: number, images?: string[]) => {
    actions.setNotification(show, count, images);
    
    if (show && count && count > 0) {
      announceToScreenReader(
        `${count} new ${count === 1 ? 'item' : 'items'} available in featured feed`,
        'medium'
      );
    }
  }, [actions, announceToScreenReader]);

  // PHASE 4.3: Keyboard event listener setup
  useEffect(() => {
    if (!isActive || !accessibility.keyboardNavigationEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard navigation when the feed container or its children have focus
      const activeElement = document.activeElement;
      const feedContainer = containerRef.current;
      
      if (feedContainer && (feedContainer.contains(activeElement) || activeElement === feedContainer)) {
        handleKeyboardNavigation(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, accessibility.keyboardNavigationEnabled, handleKeyboardNavigation]);

  // PHASE 4.3: Screen reader mode detection
  useEffect(() => {
    const detectScreenReader = () => {
      // Detect screen reader usage through various methods
      const hasScreenReader = 
        window.navigator.userAgent.includes('NVDA') ||
        window.navigator.userAgent.includes('JAWS') ||
        window.navigator.userAgent.includes('VoiceOver') ||
        window.speechSynthesis?.getVoices().length > 0 ||
        'speechSynthesis' in window;

      if (hasScreenReader !== accessibility.screenReaderMode) {
        actions.setScreenReaderMode(hasScreenReader);
      }
    };

    detectScreenReader();
    
    // Re-check when voices are loaded (for speech synthesis detection)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', detectScreenReader);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', detectScreenReader);
    }
  }, [accessibility.screenReaderMode, actions]);

  // PHASE 4.3: Reduced motion preference detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleMotionPreferenceChange = (e: MediaQueryListEvent) => {
      // Disable animations and smooth scrolling if user prefers reduced motion
      if (e.matches) {
        document.documentElement.style.setProperty('--animation-duration', '0ms');
        document.documentElement.style.setProperty('--transition-duration', '0ms');
      } else {
        document.documentElement.style.removeProperty('--animation-duration');
        document.documentElement.style.removeProperty('--transition-duration');
      }
    };

    // Set initial state
    handleMotionPreferenceChange({ matches: mediaQuery.matches } as MediaQueryListEvent);
    
    mediaQuery.addEventListener('change', handleMotionPreferenceChange);
    return () => mediaQuery.removeEventListener('change', handleMotionPreferenceChange);
  }, []);

  // PHASE 4.3: High contrast mode detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    
    const handleContrastPreferenceChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add('high-contrast');
      } else {
        document.documentElement.classList.remove('high-contrast');
      }
    };

    // Set initial state
    handleContrastPreferenceChange({ matches: mediaQuery.matches } as MediaQueryListEvent);
    
    mediaQuery.addEventListener('change', handleContrastPreferenceChange);
    return () => mediaQuery.removeEventListener('change', handleContrastPreferenceChange);
  }, []);

  // PHASE 4.3: Cleanup on unmount
  useEffect(() => {
    return () => {
      announcementQueueRef.current?.clear();
      focusManagerRef.current?.releaseFocusTrap();
      
      // Clean up live regions
      const liveRegion = document.getElementById(ACCESSIBILITY_CONSTANTS.LIVE_REGION_ID);
      if (liveRegion) {
        liveRegion.remove();
      }
    };
  }, []);

  // PHASE 4.3: Return enhanced UI management interface
  return {
    handleCommentDrawer,
    notification,
    setNotification,
    
    // PHASE 4.3: Advanced accessibility features
    announceToScreenReader,
    handleKeyboardNavigation,
    focusEntry,
    getAccessibilityProps,
    
    // Container ref for keyboard navigation
    containerRef,
    
    // Accessibility state
    isKeyboardNavigationEnabled: accessibility.keyboardNavigationEnabled,
    isScreenReaderMode: accessibility.screenReaderMode,
    focusedEntryId: accessibility.focusedEntryId,
    
    // Accessibility actions
    enableKeyboardNavigation: () => actions.setKeyboardNavigation(true),
    disableKeyboardNavigation: () => actions.setKeyboardNavigation(false),
    clearAnnouncements: () => {
      actions.clearAnnouncements();
      announcementQueueRef.current?.clear();
    }
  };
} 