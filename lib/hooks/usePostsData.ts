import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Post } from '@/lib/types';

interface UsePostsDataProps {
  categoryId: string;
  mediaType: string;
  searchQuery?: string;
  initialPosts?: Post[];
  isVisible?: boolean;
  globalFollowStates?: boolean[] | undefined;
}

export const usePostsData = ({
  categoryId,
  mediaType,
  searchQuery = '',
  initialPosts = [],
  isVisible = true,
  globalFollowStates,
}: UsePostsDataProps) => {
  const { isAuthenticated } = useConvexAuth();
  
  // Local state for each PostsDisplay instance
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [shouldLoadMore, setShouldLoadMore] = useState(false);

  // Track the last category/search to detect changes
  const lastParamsRef = useRef({ categoryId: '', searchQuery: '', isAuthenticated: false });
  
  // Track if we've already processed follow states for current posts
  const followStatesProcessedRef = useRef(false);

  // Memoize query parameters to prevent unnecessary re-renders
  const queryParams = useMemo(() => {
    const cursor = shouldLoadMore ? nextCursor : undefined;
    return searchQuery 
      ? { query: searchQuery, mediaType, cursor: cursor || undefined, limit: 10 }
      : { categoryId, mediaType, cursor: cursor || undefined, limit: 10 };
  }, [searchQuery, mediaType, nextCursor, categoryId, shouldLoadMore]);

  // Query for posts - either search results or category posts (ONLY when visible)
  // Skip individual queries if we have initial posts (use only for pagination)
  const shouldMakeIndividualQuery = useMemo(() => {
    // Always query for search results
    if (searchQuery) return true;
    
    // For category posts, only query if:
    // 1. We don't have initial posts (fallback), OR
    // 2. We're paginating (shouldLoadMore is true)
    return initialPosts.length === 0 || shouldLoadMore;
  }, [searchQuery, initialPosts.length, shouldLoadMore]);

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

  // Reset and initialize when category, search, or auth changes
  useEffect(() => {
    const currentParams = { categoryId, searchQuery, isAuthenticated };
    const lastParams = lastParamsRef.current;
    
    // Only reset if the parameters actually changed
    if (lastParams.categoryId !== currentParams.categoryId || 
        lastParams.searchQuery !== currentParams.searchQuery ||
        lastParams.isAuthenticated !== currentParams.isAuthenticated) {
      
      // Update the ref first to prevent infinite loops
      lastParamsRef.current = currentParams;
      
      // Reset follow states processed flag
      followStatesProcessedRef.current = false;
      
      // Reset local state
      setPosts([]);
      setNextCursor(undefined);
      setHasMore(true);
      setIsLoading(false);
      setShouldLoadMore(false);
      
      // Initialize with initial posts if provided
      if (initialPosts.length > 0) {
        const postsWithAuth = initialPosts.map(post => ({
          ...post,
          isAuthenticated,
        }));
        setPosts(postsWithAuth);
        setNextCursor(undefined);
        setIsInitialLoad(false);
      } else {
        setIsInitialLoad(true);
      }
    }
  }, [categoryId, searchQuery, isAuthenticated, initialPosts]);

  // Handle query results (both initial and pagination)
  useEffect(() => {
    if (isVisible && postsResult) {
      const newPosts = postsResult.posts as Post[];
      const postsWithAuth = newPosts.map(post => ({
        ...post,
        isAuthenticated,
      }));
      
      if (shouldLoadMore) {
        // This is a pagination request - append to existing posts
        setPosts(prevPosts => [...prevPosts, ...postsWithAuth]);
        setShouldLoadMore(false);
        setIsLoading(false);
      } else if (isInitialLoad) {
        // This is the initial load
        setPosts(postsWithAuth);
        setIsInitialLoad(false);
      }
      
      setNextCursor(postsResult.nextCursor);
      setHasMore(!!postsResult.nextCursor);
      
      // Reset follow states processed flag when new posts are loaded
      followStatesProcessedRef.current = false;
    }
  }, [isVisible, postsResult, isAuthenticated, shouldLoadMore, isInitialLoad]);

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

  // Update post function for follow button interactions
  const updatePost = useCallback((postId: string, updates: Partial<Post>) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post._id === postId ? { ...post, ...updates } : post
      )
    );
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