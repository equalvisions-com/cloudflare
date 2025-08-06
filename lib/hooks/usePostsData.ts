import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSidebar } from '@/components/ui/sidebar-context';
import { Post } from '@/lib/types';
import { mutate as globalMutate } from 'swr';

interface UsePostsDataProps {
  categoryId: string;
  mediaType: string;
  searchQuery?: string;
  initialPosts: Post[];
  isVisible: boolean;
  globalFollowStates?: boolean[] | undefined;
}

export const usePostsData = ({
  categoryId,
  mediaType,
  searchQuery = '',
  initialPosts,
  isVisible,
  globalFollowStates,
}: UsePostsDataProps) => {
  const { isAuthenticated } = useSidebar();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [shouldLoadMore, setShouldLoadMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Track whether follow states have been processed to prevent double processing
  const followStatesProcessedRef = useRef(false);

  // Check if we should make individual queries (skip for initial load efficiency)
  const shouldMakeIndividualQuery = useMemo(() => {
    // For search queries, always make individual queries since we don't have initial data
    if (searchQuery) return true;
    
    // For category queries, skip if we have initial posts to use batched approach
    return initialPosts.length === 0;
  }, [searchQuery, initialPosts.length]);

  // Build query parameters based on whether it's a search or category query
  const queryParams = useMemo(() => {
    if (searchQuery) {
      return {
        query: searchQuery, // API expects 'query', not 'searchQuery'
        mediaType,
        limit: 10,
        cursor: shouldLoadMore ? nextCursor || undefined : undefined
      };
    } else {
      return {
        categoryId,
        mediaType,
        limit: 10,
        cursor: shouldLoadMore ? nextCursor || undefined : undefined
      };
    }
  }, [searchQuery, mediaType, categoryId, shouldLoadMore, nextCursor]);

  const postsResult = useQuery(
    searchQuery ? api.posts.searchPosts : api.categories.getPostsByCategory,
    isVisible && shouldMakeIndividualQuery ? queryParams : "skip"
  );

  // Get post IDs for posts that don't have follow states yet
  const postsNeedingFollowStates = useMemo(() => {
    return posts.filter(post => post.isFollowing === undefined);
  }, [posts]);

  const postIdsNeedingFollowStates = useMemo(() => {
    return postsNeedingFollowStates.map(post => post._id);
  }, [postsNeedingFollowStates]);

  // Query for follow states ONLY for posts that need them (pagination case)
  const paginationFollowStates = useQuery(
    api.following.getFollowStates,
    isVisible && isAuthenticated && postIdsNeedingFollowStates.length > 0 && !globalFollowStates
      ? { postIds: postIdsNeedingFollowStates } 
      : "skip"
  );

  // Process new posts with authentication state (stable function)
  const processNewPosts = useCallback((newPosts: Post[]) => {
    return newPosts.map(post => ({
      ...post,
      isAuthenticated,
    }));
  }, [isAuthenticated]);

  // Handle query results for pagination
  useEffect(() => {
    if (!isVisible || !postsResult || !shouldLoadMore) return;

    const { posts: newPosts, nextCursor: newNextCursor, hasMore: newHasMore } = postsResult;

    if (newPosts && newPosts.length > 0) {
      const processedNewPosts = processNewPosts(newPosts);
      
      setPosts(prevPosts => [...prevPosts, ...processedNewPosts]);
      setNextCursor(newNextCursor || undefined);
      setHasMore(newHasMore ?? false);
    } else {
      setHasMore(false);
    }

    setIsLoading(false);
    setShouldLoadMore(false);
  }, [isVisible, postsResult, shouldLoadMore, processNewPosts]);

  // Initialize posts and pagination for both initial data and individual queries
  useEffect(() => {
    if (!isVisible) return;

    // For search queries or when we don't have initial data, use query results
    if (shouldMakeIndividualQuery && postsResult && !shouldLoadMore) {
      const { posts: newPosts, nextCursor: newNextCursor, hasMore: newHasMore } = postsResult;
      
      if (newPosts !== undefined) {
        const processedPosts = processNewPosts(newPosts);
        setPosts(processedPosts);
        setNextCursor(newNextCursor || undefined);
        setHasMore(newHasMore ?? false);
        // Always set isInitialLoad to false once we have query results,
        // whether they're empty or not (for genuine empty search results)
        setIsInitialLoad(false);
      }
    } 
    // For category queries with initial data, use the provided posts
    else if (!shouldMakeIndividualQuery && initialPosts.length > 0) {
      const processedPosts = processNewPosts(initialPosts);
      setPosts(processedPosts);
      
      // Set pagination state based on initial data
      setHasMore(processedPosts.length >= 10); // Assume more if we have a full page
      setNextCursor(undefined); // Will be set when we need to load more
      setIsInitialLoad(false);
    }
  }, [isVisible, shouldMakeIndividualQuery, postsResult, initialPosts, shouldLoadMore, processNewPosts, searchQuery]);

  // Reset state when query params change (for searches)
  const previousSearchQueryRef = useRef<string>('');
  
  useEffect(() => {
    if (!isVisible) return;
    
    if (searchQuery) {
      // Only reset state if this is a completely different search term
      const isDifferentSearch = previousSearchQueryRef.current !== searchQuery;
      
      if (isDifferentSearch) {
        previousSearchQueryRef.current = searchQuery;
        // Only reset isInitialLoad for truly different searches
        setIsInitialLoad(true);
        setHasMore(true);
        setNextCursor(undefined);
        followStatesProcessedRef.current = false;
      }
    }
  }, [isVisible, searchQuery]);

  // Update follow states when they load - handle both global and pagination follow states
  useEffect(() => {
    if (isVisible && posts.length > 0 && !followStatesProcessedRef.current) {
      let shouldUpdate = false;
      let updatedPosts = [...posts];
      
      // Handle global follow states (for initial posts)
      if (globalFollowStates && Array.isArray(globalFollowStates)) {
        posts.forEach((post, index) => {
          if (index < globalFollowStates.length && post.isFollowing === undefined) {
            updatedPosts[index] = {
              ...post,
              isAuthenticated,
              isFollowing: globalFollowStates[index]
            };
            shouldUpdate = true;
          }
        });
      }
      
      // Handle pagination follow states (for newly loaded posts)
      if (paginationFollowStates && Array.isArray(paginationFollowStates) && postsNeedingFollowStates.length > 0) {
        postsNeedingFollowStates.forEach((post, index) => {
          if (index < paginationFollowStates.length) {
            const postIndex = posts.findIndex(p => p._id === post._id);
            if (postIndex !== -1) {
              updatedPosts[postIndex] = {
                ...post,
                isAuthenticated,
                isFollowing: paginationFollowStates[index]
              };
              shouldUpdate = true;
            }
          }
        });
      }
      
      if (shouldUpdate) {
        followStatesProcessedRef.current = true;
        setPosts(updatedPosts);
      }
    }
  }, [isVisible, globalFollowStates, paginationFollowStates, posts, postsNeedingFollowStates, isAuthenticated]);

  // Load more posts function (ONLY when visible)
  const loadMorePosts = useCallback(() => {
    if (!isVisible || !hasMore || isLoading || shouldLoadMore || !nextCursor) return;
    
    setIsLoading(true);
    setShouldLoadMore(true);
  }, [isVisible, hasMore, isLoading, shouldLoadMore, nextCursor]);

  // GLOBAL update post function for follow button interactions
  const updatePost = useCallback((postId: string, updates: Partial<Post>) => {
    // Update local state
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post._id === postId ? { ...post, ...updates } : post
      )
    );
    
    // CRITICAL: Also trigger global SWR mutations to sync across ALL PostsDisplay components
    // This ensures that when a post is followed in one category, it updates everywhere
    if (updates.hasOwnProperty('isFollowing')) {
      // Invalidate all follow-related SWR caches globally
      globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/follows'));
      globalMutate('/api/rss');
      globalMutate('/api/rss?refresh=true');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup function for component unmount
    };
  }, []);

  return {
    posts,
    hasMore,
    isLoading,
    isInitialLoad,
    nextCursor,
    loadMorePosts,
    updatePost,
  };
}; 