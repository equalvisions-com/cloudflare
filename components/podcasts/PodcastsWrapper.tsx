'use client';

import { memo, useEffect } from 'react';
import { CategorySwipeableWrapper } from "@/components/ui/CategorySwipeableWrapper";
import { usePodcastsStore } from '@/lib/contexts/PodcastsContext';
import { usePodcastsActions } from '@/lib/hooks/usePodcastsActions';
import { PodcastItem } from '@/lib/types';

interface PodcastsWrapperProps {
  initialItems: PodcastItem[];
}

export const PodcastsWrapper = memo<PodcastsWrapperProps>(({ initialItems }) => {
  const { items, isLoading, error, announceMessage } = usePodcastsStore();
  const { initializePodcasts, resetPodcasts } = usePodcastsActions();

  // Initialize podcasts data in useEffect (not during render)
  useEffect(() => {
    if (items.length === 0 && !isLoading && !error && initialItems.length > 0) {
      initializePodcasts(initialItems);
    }
  }, [items.length, isLoading, error, initialItems, initializePodcasts]);

  // Cleanup on unmount - legitimate useEffect for cleanup
  useEffect(() => {
    return () => {
      resetPodcasts();
    };
  }, [resetPodcasts]);

  // Error state with accessibility
  if (error) {
    return (
      <div 
        className="w-full flex items-center justify-center py-8"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div className="text-center">
          <h2 className="text-red-600 mb-2 font-semibold">
            Error Loading Podcasts
          </h2>
          <p className="text-sm text-gray-500" id="error-description">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            aria-describedby="error-description"
            aria-label="Refresh page to retry loading podcasts"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Loading state with accessibility
  if (isLoading && items.length === 0) {
    return (
      <div 
        className="w-full flex items-center justify-center py-8"
        role="status"
        aria-live="polite"
        aria-label="Loading podcasts"
      >
        <div className="flex items-center space-x-2">
          <div 
            className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
            aria-hidden="true"
          ></div>
          <span className="text-gray-600">Loading podcasts...</span>
        </div>
      </div>
    );
  }

  // Main content with accessibility
  return (
    <div 
      className="w-full"
      role="region"
      aria-label="Podcast directory and episodes"
      aria-busy={isLoading}
    >
      {/* Dynamic screen reader announcements */}
      {announceMessage && (
        <div 
          className="sr-only" 
          aria-live="polite" 
          aria-atomic="true"
          key={announceMessage} // Force re-announcement when message changes
        >
          {announceMessage}
        </div>
      )}
      
      {/* Fallback announcement for initial load */}
      {!announceMessage && items.length > 0 && (
        <div 
          className="sr-only" 
          aria-live="polite" 
          aria-atomic="true"
        >
          {`Showing ${items.length} podcast${items.length === 1 ? '' : 's'}`}
        </div>
      )}
      
      <CategorySwipeableWrapper 
        mediaType="podcast" 
        showEntries={true} 
      />
    </div>
  );
});

PodcastsWrapper.displayName = 'PodcastsWrapper'; 