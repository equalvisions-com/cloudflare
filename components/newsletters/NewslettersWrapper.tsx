'use client';

import { memo, useEffect } from 'react';
import { CategorySwipeableWrapper } from "@/components/ui/CategorySwipeableWrapper";
import { useNewslettersStore } from '@/lib/contexts/NewslettersContext';
import { useNewslettersActions } from '@/lib/hooks/useNewslettersActions';
import { NewsletterItem } from '@/lib/types';

interface NewslettersWrapperProps {
  initialItems: NewsletterItem[];
}

export const NewslettersWrapper = memo<NewslettersWrapperProps>(({ initialItems }) => {
  console.log('🔴 NewslettersWrapper rendered');
  const { items, isLoading, error, announceMessage } = useNewslettersStore();
  const { initializeNewsletters, resetNewsletters } = useNewslettersActions();

  // Initialize newsletters data in useEffect (not during render)
  useEffect(() => {
    if (items.length === 0 && !isLoading && !error && initialItems.length > 0) {
      initializeNewsletters(initialItems);
    }
  }, [items.length, isLoading, error, initialItems, initializeNewsletters]);

  // Cleanup on unmount - legitimate useEffect for cleanup
  useEffect(() => {
    return () => {
      resetNewsletters();
    };
  }, [resetNewsletters]);

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
            Error Loading Newsletters
          </h2>
          <p className="text-sm text-gray-500" id="error-description">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            aria-describedby="error-description"
            aria-label="Refresh page to retry loading newsletters"
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
        aria-label="Loading newsletters"
      >
        <div className="flex items-center space-x-2">
          <div 
            className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
            aria-hidden="true"
          ></div>
          <span className="text-gray-600">Loading newsletters...</span>
        </div>
      </div>
    );
  }

  // Main content with accessibility
  return (
    <div 
      className="w-full"
      role="region"
      aria-label="Newsletter directory and content"
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
          {`Showing ${items.length} newsletter${items.length === 1 ? '' : 's'}`}
        </div>
      )}
      
      <CategorySwipeableWrapper 
        mediaType="newsletter" 
        showEntries={true} 
      />
    </div>
  );
});

NewslettersWrapper.displayName = 'NewslettersWrapper'; 