'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { CategorySlider, type Category } from './CategorySlider';
import { PostsDisplay, type Post } from './PostsDisplay';
import { EntriesDisplay } from './EntriesDisplay';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';

// Constants
const MOBILE_BREAKPOINT = 768;
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
  // State for category selection and searching
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('featured');
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTab, setSearchTab] = useState<SearchTab>('posts');
  const [isMobile, setIsMobile] = useState(false);
  
  // Query categories and initial posts data
  const initialData = useQuery(api.categories.getCategorySliderData, { 
    mediaType,
    postsPerCategory: 10
  }) as CategoryData | undefined;
  
  const isLoading = initialData === undefined;
  
  // Update isMobile state based on window width
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // List of all categories including 'featured'
  const allCategories = useMemo(() => {
    if (!initialData?.categories) return [];
    
    // Create a featured category
    const featuredCategory: Category = {
      _id: 'featured',
      name: 'Featured',
      slug: 'featured',
      mediaType,
      order: 0,
    };
    
    // Return featured first, then the rest sorted by order
    return [
      featuredCategory,
      ...initialData.categories.sort((a, b) => (a.order || 0) - (b.order || 0))
    ];
  }, [initialData?.categories, mediaType]);
  
  // Get initial posts for the selected category
  const getInitialPostsForCategory = useCallback((categoryId: string): Post[] => {
    if (!initialData) return [];
    
    if (categoryId === 'featured') {
      return initialData.featured.posts;
    }
    
    // Get posts for the selected category
    const categoryData = initialData.initialPostsByCategory[categoryId];
    if (!categoryData) return [];
    
    return categoryData.posts;
  }, [initialData]);
  
  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingSearchQuery(e.target.value);
  }, []);
  
  // Handle search clear
  const handleSearchClear = useCallback(() => {
    setPendingSearchQuery('');
    setSearchQuery('');
    setSelectedCategoryId('featured');
    setSearchTab('posts');
  }, []);
  
  // Handle search submission
  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
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
  }, [pendingSearchQuery]);
  
  // Handle key press for search input
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleSearchClear();
    }
  }, [handleSearchClear]);
  
  // Handle category selection
  const handleCategorySelect = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
    // Clear search when selecting a category
    if (searchQuery) {
      setPendingSearchQuery('');
      setSearchQuery('');
    }
  }, [searchQuery]);
  
  // Format media type for display (capitalize and pluralize)
  const displayMediaType = useMemo(() => {
    const result = mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    return result === 'Podcast' ? 'Podcasts' : result + 's';
  }, [mediaType]);
  
  // Determine label for the entries tab based on media type
  const entriesTabLabel = useMemo(() => 
    mediaType === 'podcast' ? 'Episodes' : 'Entries',
    [mediaType]
  );
  
  // Create refs for category and content carousels
  const [categoryRef, categoryEmblaApi] = useEmblaCarousel(
    {
      align: 'start',
      containScroll: 'keepSnaps',
      dragFree: true,
      skipSnaps: false,
    }, 
    [WheelGesturesPlugin()]
  );
  
  // Create a ref for post content carousel (only used on mobile)
  const [postsContentRef, postsContentEmblaApi] = useEmblaCarousel(
    isMobile ? {
      align: 'start',
      containScroll: 'keepSnaps',
      dragFree: false,
      skipSnaps: false,
    } : {
      active: false // Disable on desktop
    },
    isMobile ? [WheelGesturesPlugin()] : []
  );
  
  // Sync category selection with content carousel
  useEffect(() => {
    if (!categoryEmblaApi || !postsContentEmblaApi || !isMobile || searchQuery) return;
    
    const onCategorySelect = () => {
      const selectedIndex = categoryEmblaApi.selectedScrollSnap();
      postsContentEmblaApi.scrollTo(selectedIndex);
    };
    
    const onPostsContentSelect = () => {
      const selectedIndex = postsContentEmblaApi.selectedScrollSnap();
      categoryEmblaApi.scrollTo(selectedIndex);
      
      // Update selected category based on scrolled index
      const currentIndex = postsContentEmblaApi.selectedScrollSnap();
      const category = allCategories[currentIndex];
      if (category) {
        setSelectedCategoryId(category._id);
      }
    };
    
    categoryEmblaApi.on('select', onCategorySelect);
    postsContentEmblaApi.on('select', onPostsContentSelect);
    
    return () => {
      categoryEmblaApi.off('select', onCategorySelect);
      postsContentEmblaApi.off('select', onPostsContentSelect);
    };
  }, [categoryEmblaApi, postsContentEmblaApi, isMobile, allCategories, searchQuery]);
  
  // Sync selected category with carousel initially and when it changes
  useEffect(() => {
    if (!categoryEmblaApi || !allCategories.length) return;
    
    const index = allCategories.findIndex(cat => cat._id === selectedCategoryId);
    if (index !== -1) {
      categoryEmblaApi.scrollTo(index);
      
      // Also sync posts content carousel on mobile
      if (postsContentEmblaApi && isMobile && !searchQuery) {
        postsContentEmblaApi.scrollTo(index);
      }
    }
  }, [selectedCategoryId, categoryEmblaApi, allCategories, postsContentEmblaApi, isMobile, searchQuery]);
  
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
    <div className={cn("flex flex-col w-full", className)}>
      {/* Sticky header container */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-md border-b">
        {/* Search bar - always shown */}
        <div className="w-full py-2 px-4">
          <form onSubmit={handleSearchSubmit}>
            <SearchInput
              value={pendingSearchQuery}
              onChange={handleSearchChange}
              onClear={handleSearchClear}
              onKeyDown={handleKeyDown}
              placeholder={`Search ${displayMediaType}...`}
            />
          </form>
        </div>
        
        {/* Tab selection when searching */}
        {searchQuery ? (
          <div className="flex w-full justify-center mb-2 px-4 h-10">
            <div className="grid grid-cols-2 w-full max-w-xs gap-2">
              <button
                className={cn(
                  "text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1 justify-center",
                  searchTab === 'posts'
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setSearchTab('posts')}
              >
                <span className="relative inline-flex pb-[12px]">
                  Posts
                  {searchTab === 'posts' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />
                  )}
                </span>
              </button>
              <button
                className={cn(
                  "text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1 justify-center",
                  searchTab === 'entries'
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setSearchTab('entries')}
              >
                <span className="relative inline-flex pb-[12px]">
                  {entriesTabLabel}
                  {searchTab === 'entries' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />
                  )}
                </span>
              </button>
            </div>
          </div>
        ) : (
          // Category slider - now using our categoryRef
          <CategorySlider
            categories={allCategories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={handleCategorySelect}
            className={searchQuery ? 'hidden' : 'block'}
            emblaRef={categoryRef}
          />
        )}
      </div>
      
      {/* Content area */}
      {searchQuery ? (
        <>
          {/* Posts search results */}
          <div className={cn(
            "relative w-full overflow-hidden",
            searchTab === 'posts' ? "block" : "hidden",
          )}>
            <PostsDisplay
              categoryId=""
              mediaType={mediaType}
              searchQuery={searchQuery}
              className="mt-4 pb-8"
            />
          </div>
          
          {/* Entries search results */}
          <div className={cn(
            "relative w-full overflow-hidden",
            searchTab === 'entries' ? "block" : "hidden",
          )}>
            <EntriesDisplay
              mediaType={mediaType}
              searchQuery={searchQuery}
              className="mt-4 pb-8"
              isVisible={searchTab === 'entries'}
            />
          </div>
        </>
      ) : (
        // Post categories content with swipeable carousel on mobile
        <div
          className={cn(
            "relative w-full overflow-hidden",
            isMobile ? "touch-pan-y" : ""
          )}
          ref={isMobile ? postsContentRef : undefined}
        >
          <div className="flex w-full h-full">
            {allCategories.map((category) => (
              <div 
                key={category._id}
                className={cn(
                  "min-w-full w-full flex-shrink-0",
                  isMobile ? "" : (selectedCategoryId !== category._id && "hidden")
                )}
              >
                <PostsDisplay
                  categoryId={category._id}
                  mediaType={mediaType}
                  initialPosts={getInitialPostsForCategory(category._id)}
                  className="mt-4 pb-8 w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 