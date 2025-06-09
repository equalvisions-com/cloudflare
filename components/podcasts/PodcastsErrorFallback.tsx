'use client';

import { memo } from 'react';

export const PodcastsErrorFallback = memo(() => (
  <div 
    className="w-full flex flex-col items-center justify-center py-12 px-4"
    role="alert"
    aria-live="polite"
  >
    <div className="text-center max-w-md">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Unable to Load Podcasts
      </h2>
      <p className="text-gray-600 mb-4">
        We&apos;re having trouble loading the podcasts right now. Please try refreshing the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
        aria-label="Refresh page to reload podcasts"
      >
        Refresh Page
      </button>
    </div>
  </div>
));

PodcastsErrorFallback.displayName = 'PodcastsErrorFallback'; 