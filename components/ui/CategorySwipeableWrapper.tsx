'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { CategorySlider, type Category } from './CategorySlider';
import { PostsDisplay, type Post } from './PostsDisplay';
import { EntriesDisplay } from './EntriesDisplay';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import { UserMenuClientWithErrorBoundary } from '@/components/user-menu/UserMenuClient';
import { useSidebar } from '@/components/ui/sidebar-context';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import AutoHeight from 'embla-carousel-auto-height';

interface CategorySwipeableWrapperProps {
  mediaType: string;
  className?: string;
  showEntries?: boolean;
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

export function CategorySwipeableWrapper({
  mediaType,
  className,
  showEntries = true,
}: CategorySwipeableWrapperProps) {
  // Get user profile data from context
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount, isAuthenticated } = useSidebar();
  
  // Add state for selected category
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('featured');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string>('');
  const [searchTab, setSearchTab] = useState<'posts' | 'entries'>('posts');
  
  // Transitioning state
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Track user interaction state - for hiding inactive slides
  const [isInteracting, setIsInteracting] = useState(false);
  
  // Store scroll positions for each category/tab
  const scrollPositionsRef = useRef<Record<string, number>>({});
  
  // Flag to prevent scroll events during restoration
  const isRestoringScrollRef = useRef(false);
  
  // Flag to indicate the current selection change is from a click
  const isInstantJumpRef = useRef(false);
  
  // Refs for slide elements
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Track tab heights exactly like SwipeableTabs
  const tabHeightsRef = useRef<Record<string, number>>({});
  
  // Detect if we're on mobile
  const [isMobile, setIsMobile] = useState(false);
  
  // Initialize ResizeObserver
  const observerRef = useRef<ResizeObserver | null>(null);

  // Format media type for display (capitalize and pluralize)
  const displayMediaType = useMemo(() => {
    const capitalized = mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    return `${capitalized}s`;
  }, [mediaType]);

  // Get the entries tab label based on media type
  const entriesTabLabel = useMemo(() => {
    switch (mediaType) {
      case 'newsletter':
        return 'Posts';
      case 'podcast':
        return 'Episodes';
      default:
        return 'Entries';
    }
  }, [mediaType]);

  // Add carousel state with same options as SwipeableTabs
  const [emblaRef, emblaApi] = useEmblaCarousel(
    isMobile 
      ? { 
          loop: false,
          skipSnaps: false,
          align: 'start',
          containScroll: 'trimSnaps',
          dragFree: false,
          duration: 20, // Match SwipeableTabs
          dragThreshold: 20,
          axis: 'x',
        }
      : {
          loop: false,
          skipSnaps: false,
          align: 'start',
          containScroll: 'trimSnaps',
          duration: 20, // Match SwipeableTabs
          axis: 'x',
        },
    [
      AutoHeight(),
      ...(isMobile ? [WheelGesturesPlugin()] : [])
    ]
  );

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
  const allCategories: Category[] = useMemo(() => {
    if (!initialData?.categories) return [{ _id: 'featured', name: 'Featured', slug: 'featured', mediaType }];
    
    // Ensure "Featured" is always the first item
    const regularCategories = initialData.categories;
    
    return [
      { _id: 'featured', name: 'Featured', slug: 'featured', mediaType },
      ...regularCategories
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

  // Function to restore scroll position - directly from SwipeableTabs
  const restoreScrollPosition = useCallback((categoryId: string) => {
    // Set flag to prevent scroll events during restoration
    isRestoringScrollRef.current = true;
    
    // Get saved position (default to 0 if not set)
    const savedPosition = scrollPositionsRef.current[categoryId] ?? 0;
    
    // Always use requestAnimationFrame for smoothness
    requestAnimationFrame(() => {
      window.scrollTo(0, savedPosition);
      // Reset flag after a short delay
      setTimeout(() => {
        isRestoringScrollRef.current = false;
      }, 100);
    });
  }, []);

  // Initialize scroll positions for all categories to 0
  useEffect(() => {
    allCategories.forEach(category => {
      if (scrollPositionsRef.current[category._id] === undefined) {
        scrollPositionsRef.current[category._id] = 0;
      }
    });
    
    // Initialize search tab scroll positions
    if (scrollPositionsRef.current['search-posts'] === undefined) {
      scrollPositionsRef.current['search-posts'] = 0;
    }
    if (scrollPositionsRef.current['search-entries'] === undefined) {
      scrollPositionsRef.current['search-entries'] = 0;
    }
  }, [allCategories]);
  
  // Add effect to check screen size and update isMobile state
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Save scroll position when user scrolls
  useEffect(() => {
    if (searchQuery) {
      const handleScroll = () => {
        // Only save scroll position if we're not in the middle of restoring
        if (!isRestoringScrollRef.current) {
          scrollPositionsRef.current[`search-${searchTab}`] = window.scrollY;
        }
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    } else {
      const handleScroll = () => {
        // Only save scroll position if we're not in the middle of restoring
        if (!isRestoringScrollRef.current) {
          scrollPositionsRef.current[selectedCategoryId] = window.scrollY;
        }
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [selectedCategoryId, searchTab, searchQuery]);

  // Pre-measure slide heights to avoid layout shifts during animation
  const measureSlideHeights = useCallback(() => {
    slideRefs.current.forEach((slide, index) => {
      if (slide && slide.offsetHeight > 0) {
        tabHeightsRef.current[allCategories[index]._id] = slide.offsetHeight;
      }
    });
  }, [allCategories]);

  // ResizeObserver setup - match SwipeableTabs exactly
  useEffect(() => {
    if (!emblaApi || typeof window === 'undefined' || !allCategories.length) return;

    const categoryIndex = allCategories.findIndex(cat => cat._id === selectedCategoryId);
    if (categoryIndex === -1) return;
    
    const activeSlideNode = slideRefs.current[categoryIndex];
    if (!activeSlideNode) return;

    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    let isInTransition = false;
    let delayedReInitTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Call initially
    measureSlideHeights();
    
    // Function to track transition state
    const onTransitionStart = () => {
      isInTransition = true;
      
      // Apply fixed height to container during animation
      const emblaContainer = emblaApi.containerNode();
      const selectedIndex = emblaApi.selectedScrollSnap();
      const selectedCategory = allCategories[selectedIndex];
      const targetHeight = selectedCategory ? tabHeightsRef.current[selectedCategory._id] : undefined;
      
      if (emblaContainer && targetHeight) {
        emblaContainer.style.height = `${targetHeight}px`;
        emblaContainer.style.transition = 'none';
      }
      
      // Clear any pending reInit when a new transition starts
      if (delayedReInitTimeout) {
        clearTimeout(delayedReInitTimeout);
        delayedReInitTimeout = null;
      }
    };
    
    const onTransitionEnd = () => {
      isInTransition = false;
      
      // After transition completes, let AutoHeight take over again
      const emblaContainer = emblaApi.containerNode();
      if (emblaContainer) {
        setTimeout(() => {
          if (emblaContainer) {
            // First, add a smooth transition for height
            emblaContainer.style.transition = 'height 200ms ease-out';
            
            // Get the next category's height
            const selectedIndex = emblaApi.selectedScrollSnap();
            const selectedCategory = allCategories[selectedIndex];
            const targetHeight = selectedCategory ? tabHeightsRef.current[selectedCategory._id] : undefined;
            
            if (targetHeight) {
              // Apply the exact target height with a transition
              emblaContainer.style.height = `${targetHeight}px`;
              
              // After transition completes, remove fixed height and let AutoHeight take over
              setTimeout(() => {
                if (emblaContainer) {
                  emblaContainer.style.height = '';
                  emblaContainer.style.transition = '';
                  emblaApi.reInit();
                  // Remeasure heights
                  measureSlideHeights();
                }
              }, 200); // Match the SwipeableTabs transition duration
            } else {
              // Fallback if height not available
              emblaContainer.style.height = '';
              emblaContainer.style.transition = '';
              emblaApi.reInit();
              // Remeasure heights
              measureSlideHeights();
            }
          }
        }, 50); // Short delay after animation
      }
    };
    
    // Add transition listeners
    emblaApi.on('settle', onTransitionEnd);
    emblaApi.on('select', onTransitionStart);

    // Create the observer instance
    const resizeObserver = new ResizeObserver(() => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        // Wrap reInit in requestAnimationFrame
        window.requestAnimationFrame(() => {
          if (emblaApi) {
            // If in transition, delay reInit
            if (isInTransition) {
              // If animating, delay reInit until animation completes with a longer buffer
              if (delayedReInitTimeout) {
                clearTimeout(delayedReInitTimeout);
              }
              // Use a longer delay to ensure animation is truly complete
              delayedReInitTimeout = setTimeout(() => {
                if (emblaApi) emblaApi.reInit();
              }, 300); // Buffer after animation to prevent visible snapping
            } else {
              emblaApi.reInit();
            }
          }
        });
      }, 250); // Slightly longer debounce
    });

    // Observe the active node
    resizeObserver.observe(activeSlideNode);
    // Store the instance
    observerRef.current = resizeObserver;

    // Cleanup: disconnect the observer when category changes or component unmounts
    return () => {
      resizeObserver.disconnect();
      observerRef.current = null; // Clear the ref
      if (debounceTimeout) clearTimeout(debounceTimeout);
      if (delayedReInitTimeout) clearTimeout(delayedReInitTimeout);
      emblaApi.off('settle', onTransitionEnd);
      emblaApi.off('select', onTransitionStart);
    };
  }, [emblaApi, selectedCategoryId, allCategories, measureSlideHeights]);

  // Effect to PAUSE/RESUME observer during interaction - EXACTLY like SwipeableTabs
  useEffect(() => {
    if (!emblaApi || !observerRef.current) return; 

    const disableObserver = () => {
      observerRef.current?.disconnect();
    };

    const enableObserver = () => {
      if (!emblaApi || !observerRef.current || typeof window === 'undefined') return;

      // Wait before reconnecting to avoid interrupting animation
      setTimeout(() => {
        // Get the CURRENT selected index directly from emblaApi
        const currentSelectedIndex = emblaApi.selectedScrollSnap();
        const activeSlideNode = slideRefs.current[currentSelectedIndex];

        if (activeSlideNode && observerRef.current) {
          // Ensure we don't observe multiple times if events fire closely
          observerRef.current.disconnect(); 
          observerRef.current.observe(activeSlideNode);
        }
      }, 250); // Wait 250ms after settle/pointerUp before re-enabling
    };

    // Add listeners
    emblaApi.on('pointerDown', disableObserver);
    emblaApi.on('pointerUp', enableObserver);
    emblaApi.on('settle', enableObserver); // Handles programmatic scrolls

    // Cleanup listeners
    return () => {
      emblaApi.off('pointerDown', disableObserver);
      emblaApi.off('pointerUp', enableObserver);
      emblaApi.off('settle', enableObserver);
    };
  }, [emblaApi]);

  // Handle category selection from CategorySlider
  const handleCategorySelect = useCallback((categoryId: string) => {
    if (!emblaApi || categoryId === selectedCategoryId) return;

    // Save current scroll position before jumping
    scrollPositionsRef.current[selectedCategoryId] = window.scrollY;

    // Signal that the next 'select' event is from an instant jump
    isInstantJumpRef.current = true; 

    // Find category index and jump instantly
    const categoryIndex = allCategories.findIndex(cat => cat._id === categoryId);
    if (categoryIndex !== -1) {
      emblaApi.scrollTo(categoryIndex, true);
    }
  }, [emblaApi, selectedCategoryId, allCategories]);

  // Sync category selection with carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      if (index >= 0 && index < allCategories.length) {
        const selectedCategory = allCategories[index];
        
        if (selectedCategory._id !== selectedCategoryId) {
          // For non-instant jumps (swipes), save the scroll position
          if (!isInstantJumpRef.current && !isRestoringScrollRef.current) {
            scrollPositionsRef.current[selectedCategoryId] = window.scrollY;
          }

          // Call restoreScrollPosition - it runs async via requestAnimationFrame
          restoreScrollPosition(selectedCategory._id); 

          // Reset instant jump flag after restoration starts
          if (isInstantJumpRef.current) {
            isInstantJumpRef.current = false;
          }
          
          // Update state
          setSelectedCategoryId(selectedCategory._id);
        }
      }
    };
    
    emblaApi.on('select', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, selectedCategoryId, allCategories, restoreScrollPosition]);

  // Add effect to track interaction state for hiding inactive slides
  useEffect(() => {
    if (!emblaApi) return;

    const handlePointerDown = () => {
      setIsInteracting(true);
    };

    // Set interacting to false ONLY when the animation settles
    const handleSettle = () => {
      setIsInteracting(false);
    };

    emblaApi.on('pointerDown', handlePointerDown);
    emblaApi.on('settle', handleSettle);

    return () => {
      emblaApi.off('pointerDown', handlePointerDown);
      emblaApi.off('settle', handleSettle);
    };
  }, [emblaApi]);

  // Transition state handling - exactly like SwipeableTabs
  useEffect(() => {
    if (!emblaApi) return;

    const handleTransitionStart = () => {
      setIsTransitioning(true);
    };

    const handleTransitionEnd = () => {
      // Add a small delay to ensure smooth transition
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    };

    emblaApi.on('settle', handleTransitionEnd);
    emblaApi.on('select', handleTransitionStart);

    return () => {
      emblaApi.off('settle', handleTransitionEnd);
      emblaApi.off('select', handleTransitionStart);
    };
  }, [emblaApi]);

  // Handle search tab change
  const handleSearchTabChange = useCallback((tab: 'posts' | 'entries') => {
    // Don't do anything if it's the same tab
    if (tab === searchTab) return;
    
    // Save current scroll position
    scrollPositionsRef.current[`search-${searchTab}`] = window.scrollY;
    
    // Set transition state
    setIsTransitioning(true);
    
    // Update tab
    setSearchTab(tab);
    
    // Restore scroll position for selected tab
    restoreScrollPosition(`search-${tab}`);
    
    // End transition after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
    }, 50);
  }, [searchTab, restoreScrollPosition]);

  // SearchTabs component for search mode
  const SearchTabs = useCallback(() => (
    <div className="flex mx-4 gap-6">
      <button
        className={cn(
          "flex-1 transition-all duration-200 relative font-medium text-sm",
          searchTab === 'posts'
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => handleSearchTabChange('posts')}
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
        onClick={() => handleSearchTabChange('entries')}
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
  ), [searchTab, displayMediaType, entriesTabLabel, handleSearchTabChange]);
  
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
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-md border-b">
        {/* Search input with user menu */}
        <form 
          role="search"
          onSubmit={handleSearchSubmit} 
          className="pt-2 px-4 sm:pt-2 md:pt-4 pb-2 mb-1 flex items-start gap-3.5"
        >
          {/* User Menu on mobile */}
          {isAuthenticated && (
            <div className="flex-shrink-0 md:hidden">
              <UserMenuClientWithErrorBoundary 
                initialDisplayName={displayName}
                initialProfileImage={profileImage}
                isBoarded={isBoarded}
                pendingFriendRequestCount={pendingFriendRequestCount}
              />
            </div>
          )}
          
          <div className={cn(
            "md:flex-none md:w-full",
            isAuthenticated ? "flex-1" : "w-full" // Full width if not authenticated
          )}>
            <SearchInput
              name="search"
              value={pendingSearchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              onClear={handleSearchClear}
              placeholder={`Search ${displayMediaType}...`}
              aria-label={`Search ${displayMediaType}`}
            />
          </div>
        </form>

        {/* Category or Search Tabs */}
        {searchQuery ? (
          <SearchTabs />
        ) : (
          <CategorySlider
            categories={allCategories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={handleCategorySelect}
          />
        )}
      </div>
      
      {/* Content display area */}
      <div className="relative transition-all">
        {/* Search Results */}
        {searchQuery && (
          <>
            {/* Posts Search Tab */}
            <div 
              className={cn(
                "min-w-0 transition-opacity duration-50",
                searchTab !== 'posts' && "hidden",
                isTransitioning && "opacity-0"
              )}
              data-tab-id="search-posts"
              style={{
                minHeight: tabHeightsRef.current['search-posts'] 
                  ? `${tabHeightsRef.current['search-posts']}px` 
                  : undefined
              }}
            >
              <PostsDisplay
                categoryId=""
                mediaType={mediaType}
                initialPosts={searchResults?.posts || []}
                className=""
                searchQuery={searchQuery}
              />
            </div>
            
            {/* Entries Search Tab */}
            <div 
              className={cn(
                "min-w-0 transition-opacity duration-50",
                searchTab !== 'entries' && "hidden",
                isTransitioning && "opacity-0"
              )}
              data-tab-id="search-entries"
              style={{
                minHeight: tabHeightsRef.current['search-entries'] 
                  ? `${tabHeightsRef.current['search-entries']}px` 
                  : undefined
              }}
            >
              <EntriesDisplay
                mediaType={mediaType}
                searchQuery={searchQuery}
                className=""
                isVisible={searchTab === 'entries'}
              />
            </div>
          </>
        )}
        
        {/* Category Content - Exactly like SwipeableTabs */}
        {!searchQuery && (
          <div 
            className="w-full overflow-hidden embla__swipeable_tabs"
            ref={emblaRef}
            style={{ 
              willChange: 'transform',
              WebkitPerspective: '1000',
              WebkitBackfaceVisibility: 'hidden',
              touchAction: 'pan-y pinch-zoom'
            }}
          >
            <div className="flex items-start"
              style={{
                minHeight: tabHeightsRef.current[selectedCategoryId] 
                  ? `${tabHeightsRef.current[selectedCategoryId]}px` 
                  : undefined,
                willChange: 'transform',
                transition: isMobile ? `transform 20ms linear` : 'none'
              }}
            > 
              {allCategories.map((category, index) => {
                const isActive = category._id === selectedCategoryId;
                
                return (
                  <div 
                    key={category._id} 
                    className={cn(
                      "min-w-0 flex-[0_0_100%] transform-gpu embla-slide",
                      isTransitioning && "transitioning"
                    )}
                    ref={(el: HTMLDivElement | null) => { slideRefs.current[index] = el; }}
                    aria-hidden={!isActive} 
                    style={{
                      willChange: 'transform', 
                      transform: 'translate3d(0,0,0)',
                      WebkitBackfaceVisibility: 'hidden',
                      // Hide inactive tabs instantly during interaction - exactly like SwipeableTabs
                      opacity: !isActive && isInteracting ? 0 : 1,
                      transition: 'opacity 0s',
                      // Make slide content interactive only when active
                      pointerEvents: isActive ? 'auto' : 'none',
                      // Explicitly allow vertical panning on the slide itself
                      touchAction: 'pan-y' 
                    }}
                  >
                    <PostsDisplay
                      categoryId={category._id}
                      mediaType={mediaType}
                      initialPosts={getInitialPostsForCategory(category._id)}
                      className=""
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 