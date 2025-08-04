'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface BookmarksErrorBoundaryProps {
  children: React.ReactNode;
}

export const BookmarksErrorBoundary: React.FC<BookmarksErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Something went wrong with bookmarks</h3>
          <p className="text-muted-foreground mb-4">
            We&apos;re having trouble loading your bookmarks. Please try refreshing the page.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Refresh Page
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}; 