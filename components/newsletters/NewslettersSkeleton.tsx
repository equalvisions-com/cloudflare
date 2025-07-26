import { memo } from 'react';

// Individual newsletter card skeleton
const NewsletterCardSkeleton = memo(() => (
  <div 
    className="bg-background rounded-lg border border-border p-4 animate-pulse"
    role="article"
    aria-label="Loading newsletter"
    aria-busy="true"
  >
    <div className="flex items-start space-x-3">
      {/* Newsletter image skeleton */}
      <div 
        className="w-16 h-16 bg-muted rounded-lg flex-shrink-0"
        aria-label="Loading newsletter cover image"
      ></div>
      
      <div className="flex-1 min-w-0">
        {/* Title skeleton */}
        <div 
          className="h-5 bg-muted rounded mb-2 w-3/4"
          aria-label="Loading newsletter title"
        ></div>
        
        {/* Description skeleton */}
        <div className="space-y-1" aria-label="Loading newsletter description">
          <div className="h-3 bg-muted rounded w-full"></div>
          <div className="h-3 bg-muted rounded w-5/6"></div>
        </div>
        
        {/* Category/metadata skeleton */}
        <div 
          className="flex items-center mt-3 space-x-2"
          aria-label="Loading newsletter metadata"
        >
          <div className="h-3 bg-muted rounded w-16"></div>
          <div className="h-3 bg-muted rounded w-20"></div>
        </div>
      </div>
    </div>
  </div>
));

NewsletterCardSkeleton.displayName = 'NewsletterCardSkeleton';

// Category tabs skeleton
const CategoryTabsSkeleton = memo(() => (
  <div 
    className="flex space-x-2 mb-6 overflow-x-auto"
    role="tablist"
    aria-label="Loading newsletter categories"
    aria-busy="true"
  >
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="h-8 bg-muted rounded-full animate-pulse flex-shrink-0"
        style={{ width: `${60 + Math.random() * 40}px` }}
        role="tab"
        aria-label={`Loading category ${i + 1}`}
        aria-selected="false"
        tabIndex={-1}
      ></div>
    ))}
  </div>
));

CategoryTabsSkeleton.displayName = 'CategoryTabsSkeleton';

// List of newsletter skeletons
interface NewslettersListSkeletonProps {
  count?: number;
}

const NewslettersListSkeleton = memo<NewslettersListSkeletonProps>(({ count = 8 }) => (
  <div 
    className="space-y-4"
    role="feed"
    aria-label={`Loading ${count} newsletters`}
    aria-busy="true"
  >
    {Array.from({ length: count }).map((_, i) => (
      <NewsletterCardSkeleton key={i} />
    ))}
  </div>
));

NewslettersListSkeleton.displayName = 'NewslettersListSkeleton';

// Complete page skeleton
export const NewslettersPageSkeleton = memo(() => (
  <div 
    className="w-full"
    role="main"
    aria-label="Loading newsletters page"
    aria-busy="true"
  >
    {/* Header skeleton */}
    <header className="mb-8" aria-label="Loading page header">
      <div 
        className="h-8 bg-muted rounded mb-2 w-1/3 animate-pulse"
        aria-label="Loading page title"
      ></div>
      <div 
        className="h-4 bg-muted rounded w-2/3 animate-pulse"
        aria-label="Loading page description"
      ></div>
    </header>
    
    {/* Category tabs skeleton */}
    <CategoryTabsSkeleton />
    
    {/* Newsletters list skeleton */}
    <section aria-label="Loading newsletters">
      <NewslettersListSkeleton />
    </section>
    
    {/* Screen reader announcement */}
    <div 
      className="sr-only" 
      aria-live="polite" 
      aria-atomic="true"
    >
      Loading newsletter content, please wait...
    </div>
  </div>
));

NewslettersPageSkeleton.displayName = 'NewslettersPageSkeleton';

// Export individual components for flexibility
export { NewsletterCardSkeleton, CategoryTabsSkeleton, NewslettersListSkeleton }; 