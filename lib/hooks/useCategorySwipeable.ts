import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import AutoHeight from 'embla-carousel-auto-height';
import type { EmblaOptionsType } from 'embla-carousel';
import { 
  CategorySwipeableState, 
  CategoryData, 
  Category, 
  Post, 
  ScrollPositions, 
  TabHeights 
} from '@/lib/types';

interface UseCategorySwipeableProps {
  mediaType: string;
}

export const useCategorySwipeable = ({ mediaType }: UseCategorySwipeableProps) => {
  // Consolidated state
  const [state, setState] = useState<CategorySwipeableState>({
    selectedCategoryId: 'featured',
    searchQuery: '',
    pendingSearchQuery: '',
    searchTab: 'posts',
    isSearchLoading: false,
    isTransitioning: false,
    isInteracting: false,
    searchContentLoaded: false,
    isMobile: false,
  });

  // Refs for managing scroll positions and heights
  const scrollPositionsRef = useRef<ScrollPositions>({});
  const tabHeightsRef = useRef<TabHeights>({});
  const isRestoringScrollRef = useRef(false);
  const isInstantJumpRef = useRef(false);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchSlideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Memoize carousel options
  const mobileCarouselOptions = useMemo(() => ({
    loop: false,
    skipSnaps: false,
    align: 'start' as const,
    containScroll: 'trimSnaps',
    dragFree: false,
    duration: 20,
    dragThreshold: 20,
    axis: 'x',
  }) as EmblaOptionsType, []);

  const desktopCarouselOptions = useMemo(() => ({
    loop: false,
    skipSnaps: false,
    align: 'start' as const,
    containScroll: 'trimSnaps',
    duration: 20,
    axis: 'x',
  }) as EmblaOptionsType, []);

  // Initialize carousels
  const [emblaRef, emblaApi] = useEmblaCarousel(
    state.isMobile ? mobileCarouselOptions : desktopCarouselOptions,
    [
      AutoHeight(),
      ...(state.isMobile ? [WheelGesturesPlugin()] : [])
    ]
  );

  const [searchEmblaRef, searchEmblaApi] = useEmblaCarousel(
    state.isMobile ? mobileCarouselOptions : desktopCarouselOptions,
    [
      AutoHeight(),
      ...(state.isMobile ? [WheelGesturesPlugin()] : [])
    ]
  );

  // Fetch initial data
  const initialData = useQuery(api.categories.getCategorySliderData, { 
    mediaType,
    postsPerCategory: 10
  }) as CategoryData | undefined;

  // Search query for posts - always fetch when we have a search query
  const searchQueryParams = useMemo(() => {
    if (state.searchQuery) {
      return { 
        query: state.searchQuery,
        mediaType,
        limit: 10
      };
    }
    return "skip";
  }, [state.searchQuery, mediaType]);

  const searchResults = useQuery(
    api.posts.searchPosts,
    searchQueryParams
  );

  // Prepare categories array
  const allCategories: Category[] = useMemo(() => {
    if (!initialData?.categories) return [{ _id: 'featured', name: 'Featured', slug: 'featured', mediaType }];
    
    return [
      { _id: 'featured', name: 'Featured', slug: 'featured', mediaType },
      ...initialData.categories
    ];
  }, [initialData?.categories, mediaType]);

  // Format media type for display
  const displayMediaType = useMemo(() => {
    const capitalized = mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    return `${capitalized}s`;
  }, [mediaType]);

  // Get entries tab label
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

  // Get initial posts for category
  const getInitialPostsForCategory = useCallback((categoryId: string): Post[] => {
    if (!initialData) return [];
    
    if (categoryId === 'featured') {
      return initialData.featured.posts;
    }
    
    const categoryData = initialData.initialPostsByCategory[categoryId];
    return categoryData?.posts || [];
  }, [initialData]);

  // Restore scroll position
  const restoreScrollPosition = useCallback((categoryId: string) => {
    isRestoringScrollRef.current = true;
    const savedPosition = scrollPositionsRef.current[categoryId] ?? 0;
    
    requestAnimationFrame(() => {
      window.scrollTo(0, savedPosition);
      setTimeout(() => {
        isRestoringScrollRef.current = false;
      }, 100);
    });
  }, []);

  // Update state helper
  const updateState = useCallback((updates: Partial<CategorySwipeableState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateState({ pendingSearchQuery: e.target.value });
  }, [updateState]);

  // Handle search submission
  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    if (state.pendingSearchQuery !== state.searchQuery) {
      updateState({ 
        isSearchLoading: true,
        searchQuery: state.pendingSearchQuery,
        selectedCategoryId: state.pendingSearchQuery ? '' : 'featured',
        searchTab: state.pendingSearchQuery ? state.searchTab : 'posts',
        searchContentLoaded: false
      });
    }
  }, [state.pendingSearchQuery, state.searchQuery, state.searchTab, updateState]);

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    if (state.pendingSearchQuery || state.searchQuery) {
      updateState({ 
        pendingSearchQuery: '',
        searchQuery: '',
        selectedCategoryId: 'featured',
        searchTab: 'posts',
        searchContentLoaded: false
      });
    }
  }, [state.pendingSearchQuery, state.searchQuery, updateState]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleSearchClear();
    }
  }, [handleSearchClear]);

  // Handle category selection
  const handleCategorySelect = useCallback((categoryId: string) => {
    if (categoryId === state.selectedCategoryId || !emblaApi) return;

    scrollPositionsRef.current[state.selectedCategoryId] = window.scrollY;
    isInstantJumpRef.current = true;

    const categoryIndex = allCategories.findIndex(cat => cat._id === categoryId);
    if (categoryIndex !== -1) {
      emblaApi.scrollTo(categoryIndex, true);
    }
  }, [emblaApi, state.selectedCategoryId, allCategories]);

  // Handle search tab change
  const handleSearchTabChange = useCallback((tab: 'posts' | 'entries') => {
    if (tab === state.searchTab || !searchEmblaApi) return;
    
    scrollPositionsRef.current[`search-${state.searchTab}`] = window.scrollY;
    updateState({ isTransitioning: true, searchTab: tab });
    
    searchEmblaApi.scrollTo(tab === 'posts' ? 0 : 1, true);
    restoreScrollPosition(`search-${tab}`);
    
    setTimeout(() => {
      updateState({ isTransitioning: false });
    }, 50);
  }, [state.searchTab, state.searchQuery, restoreScrollPosition, searchEmblaApi, updateState]);

  // Initialize mobile detection
  useEffect(() => {
    const checkMobile = () => {
      updateState({ isMobile: window.innerWidth < 768 });
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [updateState]);

  // Initialize scroll positions
  useEffect(() => {
    allCategories.forEach(category => {
      if (scrollPositionsRef.current[category._id] === undefined) {
        scrollPositionsRef.current[category._id] = 0;
      }
    });
    
    if (scrollPositionsRef.current['search-posts'] === undefined) {
      scrollPositionsRef.current['search-posts'] = 0;
    }
    if (scrollPositionsRef.current['search-entries'] === undefined) {
      scrollPositionsRef.current['search-entries'] = 0;
    }
  }, [allCategories]);

  // Save scroll position when scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (!isRestoringScrollRef.current) {
        const key = state.searchQuery 
          ? `search-${state.searchTab}` 
          : state.selectedCategoryId;
        scrollPositionsRef.current[key] = window.scrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [state.selectedCategoryId, state.searchTab, state.searchQuery]);

  // Turn off loading state when search results arrive
  useEffect(() => {
    if (state.searchQuery && searchResults !== undefined) {
      updateState({ isSearchLoading: false, searchContentLoaded: true });
    }
    if (!state.searchQuery) {
      updateState({ isSearchLoading: false, searchContentLoaded: false });
    }
  }, [searchResults, state.searchQuery, updateState]);

  // Check for search query in sessionStorage
  useEffect(() => {
    const storedMediaType = sessionStorage.getItem('app_search_mediaType');
    if (storedMediaType && storedMediaType !== mediaType) return;
    
    const storedQuery = sessionStorage.getItem('app_search_query');
    const timestamp = sessionStorage.getItem('app_search_timestamp');
    
    if (storedQuery && timestamp) {
      const now = Date.now();
      const searchTime = parseInt(timestamp, 10);
      const isRecentSearch = (now - searchTime) < 5000;
      
      if (isRecentSearch) {
        updateState({
          pendingSearchQuery: storedQuery,
          searchQuery: storedQuery,
          selectedCategoryId: ''
        });
        sessionStorage.removeItem('app_search_timestamp');
      }
    }
  }, [mediaType, updateState]);

  return {
    // State
    state,
    
    // Data
    initialData,
    searchResults,
    allCategories,
    displayMediaType,
    entriesTabLabel,
    isLoadingCategories: initialData === undefined,
    
    // Refs
    emblaRef,
    searchEmblaRef,
    slideRefs,
    searchSlideRefs,
    scrollPositionsRef,
    tabHeightsRef,
    isRestoringScrollRef,
    isInstantJumpRef,
    observerRef,
    
    // APIs
    emblaApi,
    searchEmblaApi,
    
    // Functions
    getInitialPostsForCategory,
    restoreScrollPosition,
    updateState,
    handleSearchChange,
    handleSearchSubmit,
    handleSearchClear,
    handleKeyDown,
    handleCategorySelect,
    handleSearchTabChange,
  };
}; 