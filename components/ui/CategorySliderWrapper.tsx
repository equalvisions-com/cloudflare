'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { CategorySlider, type Category } from './CategorySlider';
import { PostsDisplay, type Post } from './PostsDisplay';
import { EntriesDisplay } from './EntriesDisplay';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';

type SearchTab = 'posts' | 'entries';

interface CategorySliderWrapperProps {
  mediaType: string;
  className?: string;
}

// Define the shape of the data returned from the query
interface CategoryData {
  categories: Category[];
  featured: {
    posts: Post[];
    hasMore: boolean;
    nextCursor: string | null;
  };
  initialPostsByCategory: Record<string, {
    posts: Post[];
    hasMore: boolean;
    nextCursor: string | null;
  }>;
}

export function CategorySliderWrapper({
  mediaType,
  className,
}: CategorySliderWrapperProps) {
  // State for selected category and search
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('featured');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string>('');
  const [searchTab, setSearchTab] = useState<SearchTab>('posts');
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch initial data (categories and featured posts)
  const initialData = useQuery(api.categories.getCategorySliderData, { 
    mediaType,
    postsPerCategory: 10
  }) as CategoryData | undefined;

  // Search query for posts across all categories
  const searchResults = useQuery(
    api.posts.searchPosts,
    searchQuery && searchTab === 'posts' ? { 
      query: searchQuery,
      mediaType,
      limit: 10
    } : "skip"
  );
  
  // Set loading state based on data availability
  useEffect(() => {
    if (initialData) {
      setIsLoading(false);
    }
  }, [initialData]);
  
  // Prepare categories array with "Featured" as the first option
  const allCategories: Category[] = React.useMemo(() => {
    if (!initialData?.categories) return [{ _id: 'featured', name: 'Featured', slug: 'featured', mediaType }];
    
    // Ensure "Featured" is always the first item
    const regularCategories = initialData.categories;
    
    return [
      { _id: 'featured', name: 'Featured', slug: 'featured', mediaType },
      ...regularCategories
    ];
  }, [initialData?.categories, mediaType]);
  
  // Get initial posts for the selected category
  const getInitialPostsForCategory = (categoryId: string): Post[] => {
    if (!initialData) return [];
    
    if (categoryId === 'featured') {
      return initialData.featured.posts;
    }
    
    // Get posts for the selected category
    const categoryData = initialData.initialPostsByCategory[categoryId];
    if (!categoryData) return [];
    
    return categoryData.posts;
  };

  // Handle search input change (now just updates pending state)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingSearchQuery(e.target.value);
  };

  // Handle search clear
  const handleSearchClear = () => {
    setPendingSearchQuery('');
    setSearchQuery('');
    setSelectedCategoryId('featured');
    setSearchTab('posts');
  };

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Hide keyboard by blurring any active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSearchQuery(pendingSearchQuery);
    // When searching, we don't want to filter by category
    if (pendingSearchQuery) {
      setSelectedCategoryId('');
    } else {
      setSelectedCategoryId('featured');
      setSearchTab('posts'); // Reset to posts tab when clearing search
    }
  };

  // Handle key press for search input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleSearchClear();
    }
  };

  // Initialize Embla carousel for content sliding
  const [contentRef, contentEmblaApi] = useEmblaCarousel(
    {
      align: 'start',
      skipSnaps: false,
      dragFree: false,
      containScroll: 'trimSnaps'
    },
    [WheelGesturesPlugin()]
  );

  // Sync tab changes with carousel
  const onTabChange = useCallback((tab: SearchTab) => {
    const index = tab === 'posts' ? 0 : 1;
    contentEmblaApi?.scrollTo(index);
    setSearchTab(tab);
  }, [contentEmblaApi]);

  // Sync carousel changes with tabs
  useEffect(() => {
    if (!contentEmblaApi) return;

    const onSelect = () => {
      const index = contentEmblaApi.selectedScrollSnap();
      setSearchTab(index === 0 ? 'posts' : 'entries');
    };

    contentEmblaApi.on('select', onSelect);

    return () => {
      contentEmblaApi.off('select', onSelect);
    };
  }, [contentEmblaApi]);

  // Format media type for display (capitalize and pluralize)
  const displayMediaType = React.useMemo(() => {
    const capitalized = mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    return `${capitalized}s`;
  }, [mediaType]);

  // Get the entries tab label based on media type
  const entriesTabLabel = React.useMemo(() => {
    switch (mediaType) {
      case 'newsletter':
        return 'Posts';
      case 'podcast':
        return 'Episodes';
      default:
        return 'Entries';
    }
  }, [mediaType]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className={cn("grid w-full", className)}>
        <div className="w-full overflow-hidden bg-background/85 backdrop-blur-md sticky top-0 z-10 py-2">
          <div className="flex gap-2 px-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className="h-10 w-24 bg-muted/50 rounded-full animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="h-64 bg-muted/30 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("w-full", className)}>
      {/* Sticky header container */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-md border-b">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="px-4 py-2 mb-2">
          <SearchInput
            value={pendingSearchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onClear={handleSearchClear}
            placeholder={`Search ${displayMediaType}...`}
          />
        </form>

        {searchQuery ? (
          // Search result tabs
          <div className="flex mx-4 gap-6">
            <button
              className={cn(
                "flex-1 transition-all duration-200 relative font-medium text-sm",
                searchTab === 'posts'
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onTabChange('posts')}
            >
              <span className="relative inline-flex pb-[12px]">
                {displayMediaType}
                <span className={cn(
                  "absolute bottom-0 left-0 w-full h-[.25rem] rounded-full transition-all duration-200",
                  searchTab === 'posts' ? "bg-primary opacity-100" : "opacity-0"
                )} />
              </span>
            </button>
            <button
              className={cn(
                "flex-1 transition-all duration-200 relative font-medium text-sm",
                searchTab === 'entries'
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onTabChange('entries')}
            >
              <span className="relative inline-flex pb-[12px]">
                {entriesTabLabel}
                <span className={cn(
                  "absolute bottom-0 left-0 w-full h-[.25rem] rounded-full transition-all duration-200",
                  searchTab === 'entries' ? "bg-primary opacity-100" : "opacity-0"
                )} />
              </span>
            </button>
          </div>
        ) : (
          // Category slider when not searching
          <CategorySlider
            categories={allCategories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />
        )}
      </div>
      
      {/* Content display */}
      {searchQuery ? (
        <div className="overflow-hidden" ref={contentRef}>
          <div className="flex">
            <div className="flex-[0_0_100%] min-w-0">
              <PostsDisplay
                categoryId={selectedCategoryId}
                mediaType={mediaType}
                initialPosts={searchResults?.posts || []}
                className="mt-4 pb-8"
                searchQuery={searchQuery}
              />
            </div>
            <div className="flex-[0_0_100%] min-w-0">
              <EntriesDisplay
                mediaType={mediaType}
                searchQuery={searchQuery}
                className="mt-4 pb-8"
                isVisible={searchTab === 'entries'}
              />
            </div>
          </div>
        </div>
      ) : (
        // Normal posts display when not searching
        <PostsDisplay
          categoryId={selectedCategoryId}
          mediaType={mediaType}
          initialPosts={getInitialPostsForCategory(selectedCategoryId)}
          className="mt-4 pb-8"
        />
      )}
    </div>
  );
} 