'use client';

import React, { memo, Suspense, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { PostsDisplaySkeleton } from './PostsDisplay';
import { EntriesDisplay } from './EntriesDisplay';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import { UserMenuClientWithErrorBoundary } from '@/components/user-menu/UserMenuClient';
import { Search } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar-context';
import { SkeletonFeed } from './skeleton-feed';
import { CategorySliderSkeleton } from './CategorySlider';
import { useCategorySwipeable } from '@/lib/hooks/useCategorySwipeable';
import { useCarouselEffects } from '@/lib/hooks/useCarouselEffects';
import { 
  CategorySwipeableWrapperProps, 
  SearchTabsProps,
  PostsDisplayProps 
} from '@/lib/types';

// Dynamically import PostsDisplay with skeleton fallback
const DynamicPostsDisplay = dynamic<PostsDisplayProps>(
  () => import('./PostsDisplay'),
  {
    loading: () => <PostsDisplaySkeleton count={10} />,
    ssr: false
  }
);

// Create a wrapper component for PostsDisplay
const PostsDisplay = (props: PostsDisplayProps) => {
  // Don't use this wrapper logic for search results - let the main conditional rendering handle it
  // This wrapper was causing the premature "No matches found" display during search loading
  return <DynamicPostsDisplay {...props} />;
};

// Memoized search tabs component
const SearchTabs = memo(({ 
  searchTab, 
  displayMediaType, 
  entriesTabLabel, 
  handleSearchTabChange 
}: SearchTabsProps) => (
  <div className="flex gap-0">
    <button
      className={cn(
        "flex-1 transition-all duration-200 relative font-bold text-[15px] pb-[12px]",
        searchTab === 'posts'
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={() => handleSearchTabChange('posts')}
    >
      <span className="relative inline-flex">
        {displayMediaType}
      </span>
      <span className={cn(
        "absolute bottom-0 left-0 w-full h-[1px] rounded-full transition-all duration-200",
        searchTab === 'posts' ? "bg-primary opacity-100" : "opacity-0"
      )} />
    </button>
    <button
      className={cn(
        "flex-1 transition-all duration-200 relative font-bold text-[15px] pb-[12px]",
        searchTab === 'entries'
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={() => handleSearchTabChange('entries')}
    >
      <span className="relative inline-flex">
        {entriesTabLabel}
      </span>
      <span className={cn(
        "absolute bottom-0 left-0 w-full h-[1px] rounded-full transition-all duration-200",
        searchTab === 'entries' ? "bg-primary opacity-100" : "opacity-0"
      )} />
    </button>
  </div>
));

SearchTabs.displayName = 'SearchTabs';

// Dynamic CategorySlider import
const DynamicCategorySlider = dynamic(
  () => import('./CategorySlider'),
  {
    loading: () => <CategorySliderSkeleton />,
    ssr: false
  }
);

const CategorySlider = (props: any) => {
  if (!props.categories?.length) {
    return <CategorySliderSkeleton />;
  }
  return <DynamicCategorySlider {...props} />;
};

// Main component using modern React patterns
const CategorySwipeableWrapperComponent = ({
  mediaType,
  className,
  showEntries = true,
}: CategorySwipeableWrapperProps) => {
  // Get user profile data from context
  const { displayName, isBoarded, profileImage, pendingFriendRequestCount, isAuthenticated } = useSidebar();
  
  // Use custom hook for all state management and logic
  const {
    state,
    initialData,
    searchResults,
    allCategories,
    displayMediaType,
    entriesTabLabel,
    isLoadingCategories,
    emblaRef,
    searchEmblaRef,
    slideRefs,
    searchSlideRefs,
    scrollPositionsRef,
    tabHeightsRef,
    isRestoringScrollRef,
    isInstantJumpRef,
    observerRef,
    emblaApi,
    searchEmblaApi,
    getInitialPostsForCategory,
    restoreScrollPosition,
    updateState,
    handleSearchChange,
    handleSearchSubmit,
    handleSearchClear,
    handleKeyDown,
    handleCategorySelect,
    handleSearchTabChange,
  } = useCategorySwipeable({ mediaType });

  // Use custom hook for carousel effects (replaces 15+ useEffect hooks)
  useCarouselEffects({
    emblaApi,
    searchEmblaApi,
    state,
    allCategories,
    slideRefs,
    searchSlideRefs,
    tabHeightsRef,
    scrollPositionsRef,
    isRestoringScrollRef,
    isInstantJumpRef,
    observerRef,
    updateState,
    restoreScrollPosition,
  });

  // PAGE-LEVEL FOLLOW STATES BATCHING
  // Collect ALL post IDs from all categories and make a single batched query
  const allPostIds = useMemo(() => {
    if (!allCategories.length) return [];
    
    const categoryPostIds: any[] = [];
    
    // Collect post IDs from all categories
    allCategories.forEach(category => {
      const categoryPosts = getInitialPostsForCategory(category._id);
      const postIds = categoryPosts.map(post => post._id);
      categoryPostIds.push(...postIds);
    });
    
    // TODO: Also include featured posts from FeaturedPostsWidget if available
    // This would require getting featured posts data here or passing it down
    
    // Remove duplicates (in case same post appears in multiple categories)
    return [...new Set(categoryPostIds)];
  }, [allCategories, getInitialPostsForCategory]);

  // Single batched follow states query for ALL posts on the page
  const globalFollowStates = useQuery(
    api.following.getFollowStates,
    isAuthenticated && allPostIds.length > 0 
      ? { postIds: allPostIds }
      : "skip"
  );

  // Create a function to get follow states for specific category posts
  const getFollowStatesForCategory = useMemo(() => {
    return (categoryId: string) => {
      if (!globalFollowStates || !allPostIds.length) return undefined;
      
      const categoryPosts = getInitialPostsForCategory(categoryId);
      const categoryPostIds = categoryPosts.map(post => post._id);
      
      // Map category post IDs to their follow states from the global result
      return categoryPostIds.map(postId => {
        const globalIndex = allPostIds.findIndex(id => id === postId);
        return globalIndex !== -1 ? globalFollowStates[globalIndex] : false;
      });
    };
  }, [globalFollowStates, allPostIds, getInitialPostsForCategory]);

  return (
    <div className={cn("w-full", className)}>
      {/* Sticky header container */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-md border-b">
        {/* Search input with user menu */}
        <form 
          role="search"
          onSubmit={(e) => {
            console.log('[CategorySwipeableWrapper] Form submitted');
            handleSearchSubmit(e);
          }}
          className="pt-2 px-4 sm:pt-2 md:pt-4 pb-2 mb-1 flex items-start gap-3.5"
        >
          {/* User Menu on mobile */}
          {isAuthenticated && (
            <div className="flex-shrink-0 md:hidden">
              <UserMenuClientWithErrorBoundary />
            </div>
          )}
          
          <div className={cn(
            "md:flex-none md:w-full",
            isAuthenticated ? "flex-1" : "w-full"
          )}>
            <SearchInput
              name="search"
              value={state.pendingSearchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              onClear={handleSearchClear}
              placeholder={`Search ${displayMediaType}...`}
              aria-label={`Search ${displayMediaType}`}
            />
          </div>
        </form>

        {/* Category or Search Tabs */}
        {state.searchQuery ? (
          <SearchTabs 
            searchTab={state.searchTab}
            displayMediaType={displayMediaType}
            entriesTabLabel={entriesTabLabel}
            handleSearchTabChange={handleSearchTabChange}
          />
        ) : (
          <CategorySlider
            categories={allCategories}
            selectedCategoryId={state.selectedCategoryId}
            onSelectCategory={handleCategorySelect}
            isLoading={isLoadingCategories}
          />
        )}
      </div>
      
      {/* Content display area */}
      <div className="relative transition-all w-full">
        {/* Search Results */}
        <div 
          className="w-full overflow-hidden embla__swipeable_tabs"
          ref={searchEmblaRef}
          style={{ 
            display: state.searchQuery ? 'block' : 'none',
            willChange: 'transform',
            WebkitPerspective: '1000',
            WebkitBackfaceVisibility: 'hidden',
            touchAction: 'pan-y pinch-zoom'
          }}
        >
          <div className="flex items-start"
            style={{
              minHeight: tabHeightsRef.current[`search-${state.searchTab}`] 
                ? `${tabHeightsRef.current[`search-${state.searchTab}`]}px` 
                : undefined,
              willChange: 'transform',
              transition: state.isMobile ? `transform 20ms linear` : 'none'
            }}
          > 
            {/* Posts Search Tab */}
            <div 
              ref={(el: HTMLDivElement | null) => { 
                searchSlideRefs.current[0] = el; 
                if (el && el.offsetHeight > 0) {
                  tabHeightsRef.current['search-posts'] = el.offsetHeight;
                }
              }}
              className="min-w-0 flex-[0_0_100%] transform-gpu embla-slide"
              aria-hidden={state.searchTab !== 'posts'} 
              style={{
                willChange: 'transform', 
                transform: 'translate3d(0,0,0)',
                WebkitBackfaceVisibility: 'hidden',
                opacity: state.searchTab === 'posts' ? 1 : 0,
                transition: 'opacity 0s',
                pointerEvents: state.searchTab === 'posts' ? 'auto' : 'none',
                touchAction: 'pan-y',
                minHeight: undefined
              }}
            >
              {(() => {
                // Simplified conditional rendering logic
                const isLoading = state.isSearchLoading || searchResults === undefined;
                const hasResults = searchResults?.posts && searchResults.posts.length > 0;
                const hasEmptyResults = searchResults?.posts && searchResults.posts.length === 0;
                
                console.log('[CategorySwipeableWrapper] Rendering decision:', {
                  isLoading,
                  hasResults,
                  hasEmptyResults,
                  searchQuery: state.searchQuery,
                  searchResultsExists: !!searchResults,
                  postsCount: searchResults?.posts?.length
                });
                
                if (isLoading) {
                  console.log('[CategorySwipeableWrapper] Showing skeleton');
                  return <PostsDisplaySkeleton count={5} />;
                }
                
                if (hasEmptyResults) {
                  return (
                    <div className="flex flex-col items-center justify-center py-6 px-4">
                      {/* Icon cluster */}
                      <div className="relative mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-muted to-muted/60 rounded-2xl flex items-center justify-center border border-border shadow-lg">
                          <Search className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                        </div>
                      </div>

                      {/* Text content */}
                      <div className="text-center space-y-1">
                        <h3 className="text-foreground font-medium text-sm">No matches found</h3>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Try different keywords or browse categories
                        </p>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <Suspense fallback={<PostsDisplaySkeleton count={5} />}>
                    <PostsDisplay
                      categoryId=""
                      mediaType={mediaType}
                      initialPosts={searchResults?.posts || []}
                      className=""
                      searchQuery={state.searchQuery}
                      isVisible={state.searchTab === 'posts'}
                      key={`posts-search-${mediaType}`}
                    />
                  </Suspense>
                );
              })()}
            </div>
            
            {/* Entries Search Tab */}
            <div 
              ref={(el: HTMLDivElement | null) => { 
                searchSlideRefs.current[1] = el;
                if (el && el.offsetHeight > 0) {
                  tabHeightsRef.current['search-entries'] = el.offsetHeight;
                }
              }}
              className="min-w-0 flex-[0_0_100%] transform-gpu embla-slide"
              aria-hidden={state.searchTab !== 'entries'} 
              style={{
                willChange: 'transform', 
                transform: 'translate3d(0,0,0)',
                WebkitBackfaceVisibility: 'hidden',
                opacity: state.searchTab === 'entries' ? 1 : 0,
                transition: 'opacity 0s',
                pointerEvents: state.searchTab === 'entries' ? 'auto' : 'none',
                touchAction: 'pan-y',
                minHeight: undefined
              }}
            >
              <Suspense fallback={<SkeletonFeed count={5} />}>
              <EntriesDisplay
                mediaType={mediaType}
                  searchQuery={state.searchQuery}
                className=""
                  isVisible={state.searchTab === 'entries'}
                key={`entries-search-${mediaType}`}
              />
              </Suspense>
            </div>
          </div>
        </div>
        
        {/* Category Content */}
        <div 
          className="w-full overflow-hidden embla__swipeable_tabs"
          ref={emblaRef}
          style={{ 
            display: !state.searchQuery ? 'block' : 'none',
            willChange: 'transform',
            WebkitPerspective: '1000',
            WebkitBackfaceVisibility: 'hidden',
            touchAction: 'pan-y pinch-zoom'
          }}
        >
          <div className="flex items-start"
            style={{
              minHeight: tabHeightsRef.current[state.selectedCategoryId] 
                ? `${tabHeightsRef.current[state.selectedCategoryId]}px` 
                : undefined,
              willChange: 'transform',
              transition: state.isMobile ? `transform 20ms linear` : 'none'
            }}
          > 
            {allCategories.map((category, index) => {
              const isActive = category._id === state.selectedCategoryId;
              
              return (
                <div 
                  key={category._id} 
                  className={cn(
                    "min-w-0 flex-[0_0_100%] transform-gpu embla-slide",
                    state.isTransitioning && "transitioning"
                  )}
                  ref={(el: HTMLDivElement | null) => { slideRefs.current[index] = el; }}
                  aria-hidden={!isActive} 
                  style={{
                    willChange: 'transform', 
                    transform: 'translate3d(0,0,0)',
                    WebkitBackfaceVisibility: 'hidden',
                    opacity: isActive ? 1 : 0,
                    transition: 'opacity 0s',
                    pointerEvents: isActive ? 'auto' : 'none',
                    touchAction: 'pan-y' 
                  }}
                >
                  <Suspense fallback={<PostsDisplaySkeleton count={5} />}>
                  <PostsDisplay
                    categoryId={category._id}
                    mediaType={mediaType}
                    initialPosts={getInitialPostsForCategory(category._id)}
                    className=""
                    isVisible={isActive || state.isTransitioning}
                    globalFollowStates={getFollowStatesForCategory(category._id)}
                    key={`category-${category._id}-${mediaType}`}
                  />
                  </Suspense>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Export the memoized version of the component
export const CategorySwipeableWrapper = memo(CategorySwipeableWrapperComponent); 