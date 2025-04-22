'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, memo, lazy, Suspense } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { type Category } from './CategorySlider';
import dynamic from 'next/dynamic';
import type { Post } from './PostsDisplay';
import { PostsDisplaySkeleton } from './PostsDisplay';
import { EntriesDisplay } from './EntriesDisplay';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import { UserMenuClientWithErrorBoundary } from '@/components/user-menu/UserMenuClient';
import { useSidebar } from '@/components/ui/sidebar-context';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaOptionsType } from 'embla-carousel';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import AutoHeight from 'embla-carousel-auto-height';

// Import the skeleton for fallback during lazy loading
import { CategorySliderSkeleton } from './CategorySlider';

// Define the props interface based on the original component
interface PostsDisplayProps {
  categoryId: string;
  mediaType: string;
  initialPosts?: Post[];
  className?: string;
  searchQuery?: string;
}

// Dynamically import PostsDisplay with a skeleton loader
const DynamicPostsDisplay = dynamic<PostsDisplayProps>(
  () => import('./PostsDisplay'),
  {
    loading: () => <PostsDisplaySkeleton count={10} />,
    ssr: false // Set to false to ensure client-side loading with skeleton
  }
);

// Create a wrapper component to pass props correctly
const PostsDisplay = (props: PostsDisplayProps) => {
  // Use a brief loading state to ensure skeleton shows
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Use requestAnimationFrame to show skeleton for just one frame
    // This ensures skeleton shows before hydration without artificial delay
    const frame = requestAnimationFrame(() => {
      setIsLoading(false);
    });
    
    return () => cancelAnimationFrame(frame);
  }, []);
  
  if (isLoading) {
    return <PostsDisplaySkeleton count={10} />;
  }
  
  return <DynamicPostsDisplay {...props} />;
};

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

// Memoized search tabs component
const SearchTabs = memo(({ 
  searchTab, 
  displayMediaType, 
  entriesTabLabel, 
  handleSearchTabChange 
}: { 
  searchTab: 'posts' | 'entries';
  displayMediaType: string;
  entriesTabLabel: string;
  handleSearchTabChange: (tab: 'posts' | 'entries') => void;
}) => (
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
));

SearchTabs.displayName = 'SearchTabs';

// Define the CategorySliderProps interface
interface CategorySliderProps {
  categories: Category[] | undefined;
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  className?: string;
  isLoading?: boolean;
}

// Lazy load the CategorySlider component with dynamic import
const DynamicCategorySlider = dynamic<CategorySliderProps>(
  () => import('./CategorySlider'),
  {
    loading: () => <CategorySliderSkeleton />,
    ssr: false // Set to false to ensure client-side loading with skeleton
  }
);

// Create a wrapper component to pass props correctly
const CategorySlider = (props: CategorySliderProps) => {
  // Use a brief loading state to ensure skeleton shows
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Use requestAnimationFrame to show skeleton for just one frame
    const frame = requestAnimationFrame(() => {
      setIsLoading(false);
    });
    
    return () => cancelAnimationFrame(frame);
  }, []);
  
  if (isLoading) {
    return <CategorySliderSkeleton />;
  }
  
  return <DynamicCategorySlider {...props} />;
};

// Convert to arrow function component for consistency
const CategorySwipeableWrapperComponent = ({
  mediaType,
  className,
  showEntries = true,
}: CategorySwipeableWrapperProps) => {
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
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

  // Memoize carousel options
  const mobileCarouselOptions = useMemo(() => ({
    loop: false,
    skipSnaps: false,
    align: 'start' as const,
    containScroll: 'trimSnaps',
    dragFree: false,
    duration: 20, // Match SwipeableTabs
    dragThreshold: 20,
    axis: 'x',
  }) as EmblaOptionsType, []);

  const desktopCarouselOptions = useMemo(() => ({
    loop: false,
    skipSnaps: false,
    align: 'start' as const,
    containScroll: 'trimSnaps',
    duration: 20, // Match SwipeableTabs
    axis: 'x',
  }) as EmblaOptionsType, []);

  // Add this new search carousel ref after the existing emblaRef
  const [searchEmblaRef, searchEmblaApi] = useEmblaCarousel(
    isMobile ? mobileCarouselOptions : desktopCarouselOptions,
    [
      AutoHeight(),
      ...(isMobile ? [WheelGesturesPlugin()] : [])
    ]
  );

  // Add carousel state with same options as SwipeableTabs
  const [emblaRef, emblaApi] = useEmblaCarousel(
    isMobile ? mobileCarouselOptions : desktopCarouselOptions,
    [
      AutoHeight(),
      ...(isMobile ? [WheelGesturesPlugin()] : [])
    ]
  );

  // Add refs for search slide elements
  const searchSlideRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Add state to track search content loading
  const [searchContentLoaded, setSearchContentLoaded] = useState(false);

  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Format media type for display (capitalize and pluralize)
  const displayMediaType = useMemo(() => {
    const capitalized = mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    return `${capitalized}s`;
  }, [mediaType]);

  // Get the entries tab label based on media type
  const entriesTabLabel = useMemo(() => {
    switch (mediaType) {
      case 'newsletter':
        return 'Entries';
      case 'podcast':
        return 'Episodes';
      default:
        return 'Entries';
    }
  }, [mediaType]);

  // Fetch initial data (categories and featured posts)
  const initialData = useQuery(api.categories.getCategorySliderData, { 
    mediaType,
    postsPerCategory: 10
  }) as CategoryData | undefined;

  // Add loading state for categories
  const isLoadingCategories = initialData === undefined;
  
  // Memoize the query parameters for search to prevent unnecessary request changes
  const searchQueryParams = useMemo(() => {
    if (searchQuery && searchTab === 'posts') {
      return { 
        query: searchQuery,
        mediaType,
        limit: 10
      };
    }
    return "skip";
  }, [searchQuery, searchTab, mediaType]);

  // Search query for posts across all categories
  const searchResults = useQuery(
    api.posts.searchPosts,
    searchQueryParams
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
    if (!isMountedRef.current) return;
    setPendingSearchQuery(e.target.value);
  }, []);

  // Handle search submission
  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isMountedRef.current) return;
    
    // Hide keyboard by blurring any active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Only update search state if there's an actual change
    if (pendingSearchQuery !== searchQuery) {
      // Add a short transition effect to make the state change more visible
      setIsTransitioning(true);
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setSearchQuery(pendingSearchQuery);
        
        // When searching, we don't want to filter by category
        if (pendingSearchQuery) {
          setSelectedCategoryId('');
        } else {
          setSelectedCategoryId('featured');
          setSearchTab('posts'); // Reset to posts tab when clearing search
        }
        
        // End transition after a brief delay
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setIsTransitioning(false);
        }, 100);
      }, 50);
    }
  }, [pendingSearchQuery, searchQuery]);

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // Only make changes if there's actually something to clear
    if (pendingSearchQuery || searchQuery) {
      setPendingSearchQuery('');
      
      // Add a short transition effect
      setIsTransitioning(true);
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setSearchQuery('');
        setSelectedCategoryId('featured');
        setSearchTab('posts');
        
        // End transition
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setIsTransitioning(false);
        }, 100);
      }, 50);
    }
  }, [pendingSearchQuery, searchQuery]);

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
    if (!isMountedRef.current) return;
    
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
    if (!isMountedRef.current) return;
    
    const checkMobile = () => {
      if (!isMountedRef.current) return;
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
    if (!isMountedRef.current) return;
    
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
    if (!isMountedRef.current) return;
    
    slideRefs.current.forEach((slide, index) => {
      if (slide && slide.offsetHeight > 0) {
        tabHeightsRef.current[allCategories[index]._id] = slide.offsetHeight;
      }
    });
  }, [allCategories]);

  // ResizeObserver setup - match SwipeableTabs exactly
  useEffect(() => {
    if (!isMountedRef.current) return;
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
      if (!isMountedRef.current) return;
      
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
      if (!isMountedRef.current) return;
      
      isInTransition = false;
      
      // After transition completes, let AutoHeight take over again
      const emblaContainer = emblaApi.containerNode();
      if (emblaContainer) {
        setTimeout(() => {
          if (!isMountedRef.current || !emblaContainer) return;
          
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
              if (!isMountedRef.current || !emblaContainer) return;
              
              emblaContainer.style.height = '';
              emblaContainer.style.transition = '';
              emblaApi.reInit();
              // Remeasure heights
              measureSlideHeights();
            }, 200); // Match the SwipeableTabs transition duration
          } else {
            // Fallback if height not available
            emblaContainer.style.height = '';
            emblaContainer.style.transition = '';
            emblaApi.reInit();
            // Remeasure heights
            measureSlideHeights();
          }
        }, 50); // Short delay after animation
      }
    };
    
    // Add transition listeners
    emblaApi.on('settle', onTransitionEnd);
    emblaApi.on('select', onTransitionStart);

    // Create the observer instance
    const resizeObserver = new ResizeObserver(() => {
      if (!isMountedRef.current) return;
      
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        // Wrap reInit in requestAnimationFrame
        window.requestAnimationFrame(() => {
          if (!isMountedRef.current || !emblaApi) return;
          
          // If in transition, delay reInit
          if (isInTransition) {
            // If animating, delay reInit until animation completes with a longer buffer
            if (delayedReInitTimeout) {
              clearTimeout(delayedReInitTimeout);
            }
            // Use a longer delay to ensure animation is truly complete
            delayedReInitTimeout = setTimeout(() => {
              if (!isMountedRef.current || !emblaApi) return;
              emblaApi.reInit();
            }, 300); // Buffer after animation to prevent visible snapping
          } else {
            emblaApi.reInit();
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
    if (!isMountedRef.current) return;
    if (!emblaApi || !observerRef.current) return; 

    const disableObserver = () => {
      if (!isMountedRef.current) return;
      observerRef.current?.disconnect();
    };

    const enableObserver = () => {
      if (!isMountedRef.current) return;
      if (!emblaApi || !observerRef.current || typeof window === 'undefined') return;

      // Wait before reconnecting to avoid interrupting animation
      setTimeout(() => {
        if (!isMountedRef.current || !emblaApi || !observerRef.current) return;
        
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
    if (!isMountedRef.current) return;
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
    if (!isMountedRef.current) return;
    if (!emblaApi) return;
    
    const onSelect = () => {
      if (!isMountedRef.current) return;
      
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
    if (!isMountedRef.current) return;
    if (!emblaApi) return;

    const handlePointerDown = () => {
      if (!isMountedRef.current) return;
      setIsInteracting(true);
    };

    // Set interacting to false ONLY when the animation settles
    const handleSettle = () => {
      if (!isMountedRef.current) return;
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
    if (!isMountedRef.current) return;
    if (!emblaApi) return;

    const handleTransitionStart = () => {
      if (!isMountedRef.current) return;
      setIsTransitioning(true);
    };

    const handleTransitionEnd = () => {
      if (!isMountedRef.current) return;
      // Add a small delay to ensure smooth transition
      setTimeout(() => {
        if (!isMountedRef.current) return;
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

  // Modify the handleSearchTabChange function to use the carousel
  const handleSearchTabChange = useCallback((tab: 'posts' | 'entries') => {
    if (!isMountedRef.current) return;
    
    // Don't do anything if it's the same tab
    if (tab === searchTab) return;
    
    // Save current scroll position
    scrollPositionsRef.current[`search-${searchTab}`] = window.scrollY;
    
    // Set transition state
    setIsTransitioning(true);
    
    // Update tab
    setSearchTab(tab);
    
    // Scroll to the appropriate slide
    if (searchEmblaApi) {
      searchEmblaApi.scrollTo(tab === 'posts' ? 0 : 1, true);
    }
    
    // Restore scroll position for selected tab
    restoreScrollPosition(`search-${tab}`);
    
    // End transition after animation completes
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsTransitioning(false);
    }, 50);
  }, [searchTab, restoreScrollPosition, searchEmblaApi]);

  // Add effect to sync search tab selection with carousel
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (!searchEmblaApi) return;
    
    const onSelect = () => {
      if (!isMountedRef.current) return;
      
      try {
        const index = searchEmblaApi.selectedScrollSnap();
        if (index === undefined) return;
        
        const newTab = index === 0 ? 'posts' : 'entries';
        
        if (newTab !== searchTab) {
          // Save current scroll position
          scrollPositionsRef.current[`search-${searchTab}`] = window.scrollY;
          
          // Restore scroll position for selected tab
          restoreScrollPosition(`search-${newTab}`);
          
          // Update tab state
          setSearchTab(newTab);
        }
      } catch (error) {
        console.error('Error in search carousel select handler:', error);
      }
    };
    
    searchEmblaApi.on('select', onSelect);
    
    return () => {
      searchEmblaApi.off('select', onSelect);
    };
  }, [searchEmblaApi, searchTab, restoreScrollPosition]);

  // Add similar observer effect for search slides
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (!searchEmblaApi || typeof window === 'undefined') return;

    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Function to handle resize for search slides
    const handleResize = () => {
      if (!isMountedRef.current) return;
      
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        // Wrap reInit in requestAnimationFrame
        window.requestAnimationFrame(() => {
          if (!isMountedRef.current || !searchEmblaApi) return;
          searchEmblaApi.reInit();
        });
      }, 250);
    };

    // Create the observer instance
    const searchResizeObserver = new ResizeObserver(handleResize);

    // Observe both search slides
    searchSlideRefs.current.forEach(slide => {
      if (slide) {
        searchResizeObserver.observe(slide);
      }
    });

    // Cleanup: disconnect the observer when component unmounts
    return () => {
      searchResizeObserver.disconnect();
      if (debounceTimeout) clearTimeout(debounceTimeout);
    };
  }, [searchEmblaApi, searchTab]);

  // Check for search query in sessionStorage when component mounts
  useEffect(() => {
    if (!isMountedRef.current) return;
    
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

  // Add effect to ensure content stability during tab transitions
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Add a small delay after transitioning to ensure content is stable
    const handleTransitionComplete = () => {
      if (!isMountedRef.current) return;
      
      // Wait a bit after transition to stabilize
      setTimeout(() => {
        if (!isMountedRef.current) return;
        // Force a resize event to recalculate heights properly
        window.dispatchEvent(new Event('resize'));
      }, 100);
    };
    
    // Listen for transition end on both carousels
    if (emblaApi) {
      emblaApi.on('settle', handleTransitionComplete);
    }
    
    if (searchEmblaApi) {
      searchEmblaApi.on('settle', handleTransitionComplete);
    }
    
    return () => {
      if (emblaApi) {
        emblaApi.off('settle', handleTransitionComplete);
      }
      
      if (searchEmblaApi) {
        searchEmblaApi.off('settle', handleTransitionComplete);
      }
    };
  }, [emblaApi, searchEmblaApi]);

  // Add effect to preload content for better tab transitions
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Function to ensure all components are properly initialized
    const initializeComponents = () => {
      if (!isMountedRef.current) return;
      
      // For search tabs, measure both posts and entries heights
      if (searchQuery) {
        // Make sure all tab heights are measured
        if (searchSlideRefs.current[0]) {
          tabHeightsRef.current['search-posts'] = searchSlideRefs.current[0].offsetHeight || 
                                                 tabHeightsRef.current['search-posts'] || 300;
        }
        
        if (searchSlideRefs.current[1]) {
          tabHeightsRef.current['search-entries'] = searchSlideRefs.current[1].offsetHeight || 
                                                  tabHeightsRef.current['search-entries'] || 300;
        }
        
        // Reinitialize carousel to ensure proper height
        if (searchEmblaApi) {
          setTimeout(() => {
            if (searchEmblaApi && isMountedRef.current) {
              searchEmblaApi.reInit();
            }
          }, 50);
        }
      } else {
        // For category tabs, measure all category heights
        slideRefs.current.forEach((slide, index) => {
          if (slide && slide.offsetHeight > 0 && index < allCategories.length) {
            tabHeightsRef.current[allCategories[index]._id] = slide.offsetHeight || 
                                                           tabHeightsRef.current[allCategories[index]._id] || 300;
          }
        });
        
        // Reinitialize carousel to ensure proper height
        if (emblaApi) {
          setTimeout(() => {
            if (emblaApi && isMountedRef.current) {
              emblaApi.reInit();
            }
          }, 50);
        }
      }
    };
    
    // Initialize components on mount and when tabs change
    initializeComponents();
    
    // Also initialize on window resize
    window.addEventListener('resize', initializeComponents);
    
    return () => {
      window.removeEventListener('resize', initializeComponents);
    };
  }, [emblaApi, searchEmblaApi, searchQuery, allCategories, searchTab]);

  // Add effect to handle search state changes
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Reset loaded state when search query changes
    setSearchContentLoaded(false);
    
    // Set a timer to mark content as loaded after a short delay
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setSearchContentLoaded(true);
        
        // Trigger a reInit to adjust height after content is assumed to be loaded
        if (searchEmblaApi) {
          searchEmblaApi.reInit();
        }
      }
    }, 300); // Allow time for content to render
    
    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, searchEmblaApi]);

  // Add effect to watch for DOM changes in search slides to handle content loading
  useEffect(() => {
    if (!isMountedRef.current || typeof MutationObserver === 'undefined') return;
    
    // Setup observers for both search slides to detect content changes
    const observers: MutationObserver[] = [];
    
    // Function to handle content mutations
    const handleMutation = () => {
      if (!isMountedRef.current) return;
      
      // Update heights and reinitialize carousel
      searchSlideRefs.current.forEach((slide, index) => {
        if (slide && slide.offsetHeight > 0) {
          const key = index === 0 ? 'search-posts' : 'search-entries';
          tabHeightsRef.current[key] = slide.offsetHeight;
        }
      });
      
      // Schedule a reInit to adjust to the new content
      if (searchEmblaApi) {
        setTimeout(() => {
          if (isMountedRef.current && searchEmblaApi) {
            searchEmblaApi.reInit();
          }
        }, 50);
      }
    };
    
    // Create and connect observers
    searchSlideRefs.current.forEach((slide) => {
      if (slide) {
        const observer = new MutationObserver(handleMutation);
        observer.observe(slide, { 
          childList: true, 
          subtree: true,
          attributes: true
        });
        observers.push(observer);
      }
    });
    
    // Cleanup function
    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, [searchContentLoaded, searchEmblaApi]);

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
          <SearchTabs 
            searchTab={searchTab}
            displayMediaType={displayMediaType}
            entriesTabLabel={entriesTabLabel}
            handleSearchTabChange={handleSearchTabChange}
          />
        ) : (
          <CategorySlider
            categories={allCategories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={handleCategorySelect}
            isLoading={isLoadingCategories}
          />
        )}
      </div>
      
      {/* Content display area */}
      <div className="relative transition-all w-full">
        {/* Search Results */}
        {searchQuery && (
          <div 
            className="w-full overflow-hidden embla__swipeable_tabs"
            ref={searchEmblaRef}
            style={{ 
              willChange: 'transform',
              WebkitPerspective: '1000',
              WebkitBackfaceVisibility: 'hidden',
              touchAction: 'pan-y pinch-zoom',
              // Add minimum height during initial load to prevent clipping
              minHeight: !searchContentLoaded ? '400px' : undefined
            }}
          >
            <div className="flex items-start"
              style={{
                minHeight: tabHeightsRef.current[`search-${searchTab}`] 
                  ? `${tabHeightsRef.current[`search-${searchTab}`]}px` 
                  : !searchContentLoaded ? '400px' : undefined,
                willChange: 'transform',
                transition: isMobile ? `transform 20ms linear` : 'none'
              }}
            > 
              {/* Posts Search Tab */}
              <div 
                ref={(el: HTMLDivElement | null) => { 
                  searchSlideRefs.current[0] = el; 
                  // Update height when element is available
                  if (el && el.offsetHeight > 0) {
                    tabHeightsRef.current['search-posts'] = el.offsetHeight;
                  }
                }}
                className="min-w-0 flex-[0_0_100%] transform-gpu embla-slide"
                aria-hidden={searchTab !== 'posts'} 
                style={{
                  willChange: 'transform', 
                  transform: 'translate3d(0,0,0)',
                  WebkitBackfaceVisibility: 'hidden',
                  // Only adjust opacity, not visibility to maintain DOM presence
                  opacity: searchTab === 'posts' ? 1 : 0,
                  transition: 'opacity 0s',
                  pointerEvents: searchTab === 'posts' ? 'auto' : 'none',
                  touchAction: 'pan-y',
                  // Add minimum height for initial rendering
                  minHeight: !searchContentLoaded ? '400px' : undefined
                }}
              >
                <PostsDisplay
                  categoryId=""
                  mediaType={mediaType}
                  initialPosts={searchResults?.posts || []}
                  className=""
                  searchQuery={searchQuery}
                  // Use a stable key that doesn't change with the search query
                  key={`posts-search-${mediaType}`}
                />
              </div>
              
              {/* Entries Search Tab */}
              <div 
                ref={(el: HTMLDivElement | null) => { 
                  searchSlideRefs.current[1] = el;
                  // Update height when element is available
                  if (el && el.offsetHeight > 0) {
                    tabHeightsRef.current['search-entries'] = el.offsetHeight;
                  }
                }}
                className="min-w-0 flex-[0_0_100%] transform-gpu embla-slide"
                aria-hidden={searchTab !== 'entries'} 
                style={{
                  willChange: 'transform', 
                  transform: 'translate3d(0,0,0)',
                  WebkitBackfaceVisibility: 'hidden',
                  // Only adjust opacity, not visibility to maintain DOM presence
                  opacity: searchTab === 'entries' ? 1 : 0,
                  transition: 'opacity 0s',
                  pointerEvents: searchTab === 'entries' ? 'auto' : 'none',
                  touchAction: 'pan-y',
                  // Add minimum height for initial rendering
                  minHeight: !searchContentLoaded ? '400px' : undefined
                }}
              >
                <EntriesDisplay
                  mediaType={mediaType}
                  searchQuery={searchQuery}
                  className=""
                  isVisible={searchTab === 'entries' || isTransitioning}
                  // Use a stable key that doesn't change with the search query
                  key={`entries-search-${mediaType}`}
                />
              </div>
            </div>
          </div>
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
                      // Modified to maintain stability during transitions
                      opacity: isActive ? 1 : 0,
                      transition: 'opacity 0s',
                      pointerEvents: isActive ? 'auto' : 'none',
                      touchAction: 'pan-y' 
                    }}
                  >
                    <PostsDisplay
                      categoryId={category._id}
                      mediaType={mediaType}
                      initialPosts={getInitialPostsForCategory(category._id)}
                      className=""
                      // Add key to prevent remounting when swiping
                      key={`category-${category._id}-${mediaType}`}
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
};

// Export the memoized version of the component
export const CategorySwipeableWrapper = memo(CategorySwipeableWrapperComponent); 