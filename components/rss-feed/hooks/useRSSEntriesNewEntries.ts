import { useCallback, useMemo } from 'react';
import type { RSSEntriesDisplayEntry } from '@/lib/types';

interface UseRSSEntriesNewEntriesProps {
  newEntries: RSSEntriesDisplayEntry[];
  showNotification: boolean;
  notificationCount: number;
  notificationImages: string[];
  isMountedRef: React.MutableRefObject<boolean>;
  createManagedTimeout: (callback: () => void, delay: number) => NodeJS.Timeout;
  clearManagedTimeout: (timeoutId: NodeJS.Timeout) => void;
  setNotification: (show: boolean, count?: number, images?: string[]) => void;
}

/**
 * Custom hook for handling new entries notifications in RSS Entries Display
 * Follows React best practices - returns computed values and functions
 */
export const useRSSEntriesNewEntries = ({
  newEntries,
  showNotification,
  notificationCount,
  notificationImages,
  isMountedRef,
  createManagedTimeout,
  clearManagedTimeout,
  setNotification,
}: UseRSSEntriesNewEntriesProps) => {

  // Extract images from entries - pure function
  const extractImagesFromEntries = useCallback((entries: RSSEntriesDisplayEntry[]): string[] => {
    return entries
      .slice(0, 3) // Only take first 3 for notification
      .map(entry => {
        // Try multiple image sources in order of preference
        return entry.postMetadata?.featuredImg || 
               entry.entry?.image || 
               '';
      })
      .filter(Boolean);
  }, []);

  // Compute notification data - derived state
  const notificationData = useMemo(() => {
    if (!newEntries.length) {
      return null;
    }

    const images = extractImagesFromEntries(newEntries);
    const count = newEntries.length;

    return {
      count,
      images,
      hasImages: images.length > 0,
    };
  }, [newEntries, extractImagesFromEntries]);

  // Function to show new entries notification
  const showNewEntriesNotification = useCallback(() => {
    if (!notificationData || !isMountedRef.current) {
      return;
    }

    // Show notification with extracted data
    setNotification(true, notificationData.count, notificationData.images);

    // Auto-hide after 10 seconds to match CSS animation duration
    createManagedTimeout(() => {
      if (isMountedRef.current) {
        setNotification(false);
      }
    }, 10000);
  }, [notificationData, isMountedRef, setNotification, createManagedTimeout]);

  // Function to handle clicking on notification (dismiss only - entries already prepended)
  const handleNotificationClick = useCallback(() => {
    console.log('🎯 NOTIFICATION CLICK: Dismissing notification (entries already in feed)');
    
    if (!isMountedRef.current) {
      return;
    }

    // Just dismiss the notification - entries are already prepended automatically
    setNotification(false);
  }, [isMountedRef, setNotification]);

  // Function to dismiss notification without adding entries
  const dismissNotification = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    setNotification(false);
  }, [isMountedRef, setNotification]);

  return {
    // Notification state
    isVisible: showNotification,
    count: notificationCount,
    images: notificationImages,
    hasNewEntries: newEntries.length > 0,
    
    // Notification actions
    show: showNewEntriesNotification,
    handleClick: handleNotificationClick,
    dismiss: dismissNotification,
    
    // Computed data
    notificationData,
  };
}; 