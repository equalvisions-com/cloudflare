'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
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

// Add this constant at the top of the file
const MOBILE_BREAKPOINT = 768;

// Memoize the search tabs
const SearchTabs = memo(({ 
  searchTab, 
  onTabChange, 
  displayMediaType, 
  entriesTabLabel 
}: { 
  searchTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  displayMediaType: string;
  entriesTabLabel: string;
}) => (
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
));

SearchTabs.displayName = 'SearchTabs';

export function CategorySliderWrapper({
  mediaType,
  className,
}: CategorySliderWrapperProps) {
  // State for selected category and search
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('featured');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string>('');
  const [searchTab, setSearchTab] = useState<SearchTab>('posts');
  
  // Add window width state
  const [isMobile, setIsMobile] = useState(false);

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
  
  // Get initial posts for the selected category - memoize the function
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

  // Handle search input change (now just updates pending state)
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

  // Update isMobile state based on window width
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize Embla carousel with conditional options for search tabs
  const carouselOptions = useMemo(() => 
    isMobile ? {
      align: 'start' as const,
      skipSnaps: false,
      dragFree: false,
      containScroll: 'trimSnaps' as const
    } : { 
      align: 'start' as const,
      skipSnaps: true,
      dragFree: false,
      containScroll: 'keepSnaps' as const,
      active: false // Disable carousel on desktop
    },
    [isMobile]
  );

  const [contentRef, contentEmblaApi] = useEmblaCarousel(
    carouselOptions,
    isMobile ? [WheelGesturesPlugin()] : []
  );

  // Initialize Embla carousel for category content
  const [categoryContentRef, categoryContentEmblaApi] = useEmblaCarousel(
    isMobile ? {
      align: 'start' as const,
      skipSnaps: false,
      dragFree: false,
      containScroll: 'trimSnaps' as const,
      loop: false,
      duration: 20 // Fast but smooth scroll
    } : { active: false },
    isMobile ? [WheelGesturesPlugin()] : []
  );

  // Prevent browser back/forward navigation when interacting with the content carousels
  useEffect(() => {
    if (!contentEmblaApi || !isMobile) return;
    
    const contentViewport = contentEmblaApi.rootNode();
    if (!contentViewport) return;
    
    // Prevent horizontal swipe navigation only when actually dragging
    const preventNavigation = (e: TouchEvent) => {
      if (!contentEmblaApi.internalEngine().dragHandler.pointerDown()) return;
      
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      
      const handleTouchMove = (e: TouchEvent) => {
        if (!contentEmblaApi.internalEngine().dragHandler.pointerDown()) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        
        // Only prevent default if horizontal movement is greater than vertical
        if (deltaX > deltaY) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      
      const cleanup = () => {
        document.removeEventListener('touchmove', handleTouchMove);
      };
      
      document.addEventListener('touchend', cleanup, { once: true });
      document.addEventListener('touchcancel', cleanup, { once: true });
    };
    
    // Prevent mousewheel horizontal navigation (for trackpads)
    const preventWheelNavigation = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && contentEmblaApi.internalEngine().dragHandler.pointerDown()) {
        e.preventDefault();
      }
    };
    
    // Add event listeners with passive: false to allow preventDefault
    contentViewport.addEventListener('touchstart', preventNavigation, { passive: true });
    contentViewport.addEventListener('wheel', preventWheelNavigation, { passive: false });
    
    return () => {
      contentViewport.removeEventListener('touchstart', preventNavigation);
      contentViewport.removeEventListener('wheel', preventWheelNavigation);
    };
  }, [contentEmblaApi, isMobile]);

  // Prevent browser back/forward navigation for category content carousel
  useEffect(() => {
    if (!categoryContentEmblaApi || !isMobile) return;
    
    const categoryViewport = categoryContentEmblaApi.rootNode();
    if (!categoryViewport) return;
    
    // Prevent horizontal swipe navigation only when actually dragging
    const preventNavigation = (e: TouchEvent) => {
      if (!categoryContentEmblaApi.internalEngine().dragHandler.pointerDown()) return;
      
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      
      const handleTouchMove = (e: TouchEvent) => {
        if (!categoryContentEmblaApi.internalEngine().dragHandler.pointerDown()) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        
        // Only prevent default if horizontal movement is greater than vertical
        if (deltaX > deltaY) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      
      const cleanup = () => {
        document.removeEventListener('touchmove', handleTouchMove);
      };
      
      document.addEventListener('touchend', cleanup, { once: true });
      document.addEventListener('touchcancel', cleanup, { once: true });
    };
    
    // Prevent mousewheel horizontal navigation (for trackpads)
    const preventWheelNavigation = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && categoryContentEmblaApi.internalEngine().dragHandler.pointerDown()) {
        e.preventDefault();
      }
    };
    
    // Add event listeners with passive: false to allow preventDefault
    categoryViewport.addEventListener('touchstart', preventNavigation, { passive: true });
    categoryViewport.addEventListener('wheel', preventWheelNavigation, { passive: false });
    
    return () => {
      categoryViewport.removeEventListener('touchstart', preventNavigation);
      categoryViewport.removeEventListener('wheel', preventWheelNavigation);
    };
  }, [categoryContentEmblaApi, isMobile]);

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

  // Handle category selection and sync with category content carousel
  const handleCategorySelect = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
    
    if (isMobile && categoryContentEmblaApi) {
      const categoryIndex = allCategories.findIndex(cat => cat._id === categoryId);
      if (categoryIndex !== -1) {
        categoryContentEmblaApi.scrollTo(categoryIndex, true);
      }
    }
  }, [isMobile, categoryContentEmblaApi, allCategories]);

  // Sync category content carousel with category slider
  useEffect(() => {
    if (!categoryContentEmblaApi || !isMobile) return;

    const onCategoryContentSelect = () => {
      const index = categoryContentEmblaApi.selectedScrollSnap();
      const selectedCategory = allCategories[index];
      if (selectedCategory && selectedCategory._id !== selectedCategoryId) {
        setSelectedCategoryId(selectedCategory._id);
      }
    };

    const onCategoryContentSettle = () => {
      const index = categoryContentEmblaApi.selectedScrollSnap();
      const selectedCategory = allCategories[index];
      if (selectedCategory && selectedCategory._id !== selectedCategoryId) {
        setSelectedCategoryId(selectedCategory._id);
      }
    };

    categoryContentEmblaApi.on('select', onCategoryContentSelect);
    categoryContentEmblaApi.on('settle', onCategoryContentSettle);

    return () => {
      categoryContentEmblaApi.off('select', onCategoryContentSelect);
      categoryContentEmblaApi.off('settle', onCategoryContentSettle);
    };
  }, [categoryContentEmblaApi, isMobile, allCategories, selectedCategoryId]);

  // Sync category slider with content carousel during dragging
  useEffect(() => {
    if (!categoryContentEmblaApi || !isMobile) return;

    const onCategoryContentDrag = () => {
      const progress = categoryContentEmblaApi.scrollProgress();
      const index = Math.round(progress * (allCategories.length - 1));
      const selectedCategory = allCategories[index];
      if (selectedCategory && selectedCategory._id !== selectedCategoryId) {
        setSelectedCategoryId(selectedCategory._id);
      }
    };

    categoryContentEmblaApi.on('scroll', onCategoryContentDrag);

    return () => {
      categoryContentEmblaApi.off('scroll', onCategoryContentDrag);
    };
  }, [categoryContentEmblaApi, isMobile, allCategories, selectedCategoryId]);

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

  // Check for search query in sessionStorage when component mounts
  useEffect(() => {
    // Only process if this matches our media type or no media type is specified
    const storedMediaType = sessionStorage.getItem('app_search_mediaType');
    if (storedMediaType && storedMediaType !== mediaType) {
      return; // Not for this media type
    }
    
    const storedQuery = sessionStorage.getItem('app_search_query');
    const timestamp = sessionStorage.getItem('app_search_timestamp');
    
    if (storedQuery && timestamp) {
      // Check if the stored search is recent (within the last 5 seconds)
      // This prevents the search from triggering on subsequent page loads
      const now = Date.now();
      const searchTime = parseInt(timestamp, 10);
      const isRecentSearch = (now - searchTime) < 5000; // 5 seconds
      
      if (isRecentSearch) {
        // Apply the search query
        setPendingSearchQuery(storedQuery);
        setSearchQuery(storedQuery);
        setSelectedCategoryId('');
        
        // Clear the timestamp to prevent re-triggering on page refresh
        // but keep the query in case we need it elsewhere
        sessionStorage.removeItem('app_search_timestamp');
      }
    }
  }, [mediaType]);

  return (
    <div className={cn("w-full", className)}>
      {/* Sticky header container */}
      <div className="sticky-header">
        {/* Search input */}
        <form 
          role="search"
          onSubmit={handleSearchSubmit} 
          className="px-4 pt-4 pb-2 mb-1"
        >
          <SearchInput
            name="search"
            value={pendingSearchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onClear={handleSearchClear}
            placeholder={`Search ${displayMediaType}...`}
            aria-label={`Search ${displayMediaType}`}
          />
        </form>

        {searchQuery ? (
          <SearchTabs 
            searchTab={searchTab}
            onTabChange={onTabChange}
            displayMediaType={displayMediaType}
            entriesTabLabel={entriesTabLabel}
          />
        ) : (
      <CategorySlider
        categories={allCategories}
        selectedCategoryId={selectedCategoryId}
            onSelectCategory={handleCategorySelect}
          />
        )}
      </div>
      
      {/* Content display */}
      {searchQuery ? (
        <div className={cn(
          "overflow-hidden prevent-overscroll-navigation",
          !isMobile && "overflow-visible" // Remove overflow hidden on desktop
        )} ref={contentRef}>
          <div className={cn(
            "flex",
            !isMobile && "!transform-none" // Prevent transform on desktop
          )}>
            <div className={cn(
              "flex-[0_0_100%] min-w-0",
              !isMobile && searchTab !== 'posts' && "hidden" // Hide when not active on desktop
            )}>
              <PostsDisplay
                categoryId={selectedCategoryId}
                mediaType={mediaType}
                initialPosts={searchResults?.posts || []}
                className="pb-8"
                searchQuery={searchQuery}
              />
            </div>
            <div className={cn(
              "flex-[0_0_100%] min-w-0",
              !isMobile && searchTab !== 'entries' && "hidden" // Hide when not active on desktop
            )}>
              <EntriesDisplay
                mediaType={mediaType}
                searchQuery={searchQuery}
                className="pb-8"
                isVisible={searchTab === 'entries'}
              />
            </div>
          </div>
        </div>
      ) : (
        // Category content carousel for mobile, normal display for desktop
        isMobile ? (
          <div className="overflow-hidden prevent-overscroll-navigation" ref={categoryContentRef}>
            <div className="flex">
              {allCategories.map((category) => (
                <div key={category._id} className="flex-[0_0_100%] min-w-0">
                  <PostsDisplay
                    categoryId={category._id}
                    mediaType={mediaType}
                    initialPosts={getInitialPostsForCategory(category._id)}
                    className="pb-8"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Normal posts display for desktop
      <PostsDisplay
        categoryId={selectedCategoryId}
        mediaType={mediaType}
        initialPosts={getInitialPostsForCategory(selectedCategoryId)}
            className="pb-8"
      />
        )
      )}
    </div>
  );
} 