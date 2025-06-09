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
}

export const usePostsData = ({
  categoryId,
  mediaType,
  searchQuery = '',
  initialPosts = [],
  isVisible = true,
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
  const postsResult = useQuery(
    searchQuery ? api.posts.searchPosts : api.categories.getPostsByCategory,
    isVisible ? queryParams : "skip"
  );

  // Memoize the array of post IDs for the follow states query
  const postIds = useMemo(() => posts.map(post => post._id), [posts]);

  // Query for follow states if authenticated and we have posts (ONLY when visible)
  const followStates = useQuery(
    api.following.getFollowStates,
    isVisible && isAuthenticated && posts.length > 0
      ? { postIds } 
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

  // Update follow states when they load (FIXED - removed posts from dependencies)
  useEffect(() => {
    if (isVisible && followStates && Array.isArray(followStates) && posts.length > 0 && !followStatesProcessedRef.current) {
      // Map postIds to their respective follow states
      const followStateMap = new Map();
      
      posts.forEach((post, index) => {
        if (index < followStates.length) {
          followStateMap.set(post._id.toString(), followStates[index]);
        }
      });
      
      // Update posts with their follow states
      if (followStateMap.size > 0) {
        const updatedPosts = posts.map(post => {
          const postIdStr = post._id.toString();
          const isFollowing = followStateMap.has(postIdStr)
            ? followStateMap.get(postIdStr)
            : post.isFollowing;
          
          if (post.isFollowing === isFollowing) {
            return post;
          }
          
          return {
            ...post,
            isAuthenticated,
            isFollowing
          };
        });
        
        // Mark as processed to prevent infinite loops
        followStatesProcessedRef.current = true;
        setPosts(updatedPosts);
      }
    }
  }, [isVisible, followStates, isAuthenticated]); // Removed 'posts' from dependencies

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