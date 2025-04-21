'use client';

import React, { useEffect, useState, memo, useRef, useCallback, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { FollowButton } from '@/components/follow-button/FollowButton';
import { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from "@/components/VerifiedBadge";

// Define the shape of a post from the database
export interface Post {
  _id: Id<"posts">;
  _creationTime: number;
  title: string;
  postSlug: string;
  category: string;
  categorySlug: string;
  body: string;
  featuredImg: string;
  mediaType: string;
  isFeatured?: boolean;
  // Optional fields that might not be present in all posts
  publishedAt?: number;
  feedUrl?: string;
  // Follow state fields
  isFollowing?: boolean;
  isAuthenticated?: boolean;
  verified?: boolean;
}

interface PostsDisplayProps {
  categoryId: string;
  mediaType: string;
  initialPosts?: Post[];
  className?: string;
  searchQuery?: string;
}

// Memoize no posts state component
const NoPostsState = memo(({ 
  searchQuery, 
  mediaType, 
  className 
}: { 
  searchQuery?: string;
  mediaType: string;
  className?: string;
}) => (
  <div className={cn("py-8 text-center", className)}>
    <p className="text-muted-foreground text-sm">
      {searchQuery 
        ? `No ${mediaType} found matching "${searchQuery}"`
        : `No ${mediaType} found in this category`}
    </p>
  </div>
));

NoPostsState.displayName = 'NoPostsState';

// Convert to arrow function component for consistency
const PostsDisplayComponent = ({
  categoryId,
  mediaType,
  initialPosts = [],
  className,
  searchQuery = '',
}: PostsDisplayProps) => {
  // Store posts and pagination state
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [isInitialLoad, setIsInitialLoad] = useState(initialPosts.length === 0);
  const { isAuthenticated } = useConvexAuth();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Set up intersection observer for infinite scrolling
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  // Memoize query parameters to prevent unnecessary re-renders
  const queryParams = useMemo(() => {
    return searchQuery 
      ? { query: searchQuery, mediaType, cursor: nextCursor || undefined, limit: 10 }
      : { categoryId, mediaType, cursor: nextCursor || undefined, limit: 10 };
  }, [searchQuery, mediaType, nextCursor, categoryId]);

  // Query for posts - either search results or category posts
  const postsResult = useQuery(
    searchQuery ? api.posts.searchPosts : api.categories.getPostsByCategory,
    queryParams
  );

  // Memoize the array of post IDs for the follow states query
  const postIds = useMemo(() => posts.map(post => post._id), [posts]);

  // Query for follow states if authenticated and we have posts
  const followStates = useQuery(
    api.following.getFollowStates,
    isAuthenticated && posts.length > 0
      ? { postIds } 
      : "skip"
  );

  // Reset posts when category or search query changes - memoized
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (initialPosts.length > 0) {
      setPosts(initialPosts.map(post => ({
        ...post,
        isAuthenticated
      })));
      setNextCursor(undefined);
    }
    setIsInitialLoad(initialPosts.length === 0);
  }, [categoryId, searchQuery, initialPosts, isAuthenticated]);

  // Process and update posts with authentication state
  const processNewPosts = useCallback((newPosts: Post[]) => {
    if (!isMountedRef.current) return [];
    
    // Initialize posts with authenticated state but without follow state yet
    return newPosts.map(post => ({
      ...post,
      isAuthenticated,
    }));
  }, [isAuthenticated]);

  // Load initial posts if not provided
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (isInitialLoad && postsResult) {
      const newPosts = postsResult.posts as Post[];
      const postsWithAuth = processNewPosts(newPosts);
      
      setPosts(postsWithAuth);
      setNextCursor(postsResult.nextCursor);
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, postsResult, processNewPosts]);

  // Update posts with follow states - memoized function
  const updatePostsWithFollowStates = useCallback((currentPosts: Post[], followStateMap: Map<string, boolean>) => {
    if (!isMountedRef.current) return currentPosts;
    
    return currentPosts.map(post => {
      const postIdStr = post._id.toString();
      // If we have a follow state for this post, use it, otherwise keep the current value
      const isFollowing = followStateMap.has(postIdStr) 
        ? followStateMap.get(postIdStr) 
        : post.isFollowing;
      
      // Only update if the follow state actually changed
      if (post.isFollowing === isFollowing) {
        return post;
      }
      
      return {
        ...post,
        isAuthenticated,
        isFollowing
      };
    });
  }, [isAuthenticated]);

  // Update follow states when they load
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (followStates && Array.isArray(followStates) && posts.length > 0) {
      // Map postIds to their respective follow states
      const followStateMap = new Map();
      
      // For each post ID we queried, get its corresponding follow state
      posts.forEach((post, index) => {
        if (index < followStates.length) {
          followStateMap.set(post._id.toString(), followStates[index]);
        }
      });
      
      // Update posts with their follow states
      setPosts(currentPosts => updatePostsWithFollowStates(currentPosts, followStateMap));
    }
  }, [followStates, updatePostsWithFollowStates, posts.length]);

  // Load more posts when bottom is reached
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (inView && nextCursor && !isInitialLoad && postsResult) {
      const newPosts = postsResult.posts as Post[];
      const processedNewPosts = processNewPosts(newPosts);
      
      // Add new posts with authentication but no follow state yet
      setPosts(prev => [...prev, ...processedNewPosts]);
      setNextCursor(postsResult.nextCursor);
    }
  }, [inView, nextCursor, isInitialLoad, postsResult, processNewPosts]);

  // No posts state
  if (posts.length === 0 && !isInitialLoad) {
    return <NoPostsState searchQuery={searchQuery} mediaType={mediaType} className={className} />;
  }

  return (
    <div className={cn("w-full space-y-0", className)}>
      {/* Post cards */}
      {posts.map((post) => (
        <PostCard key={post._id} post={post} />
      ))}

      {/* Intersection observer target - without loading indicator */}
      {nextCursor && (
        <div ref={ref} />
      )}
    </div>
  );
};

// Export the memoized version of the component
export const PostsDisplay = memo(PostsDisplayComponent);

// Post card component - memoized with proper props comparison
const PostCard = memo(({ post }: { post: Post }) => {
  const [descriptionLines, setDescriptionLines] = useState(2);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Memoize the checkTitleHeight function to prevent recreation on each render
  const checkTitleHeight = useCallback(() => {
    if (!isMountedRef.current || !titleRef.current) return;
    
    const styles = window.getComputedStyle(titleRef.current);
    const lineHeight = styles.lineHeight;
    const titleHeight = titleRef.current.offsetHeight;
    const fontSize = parseInt(styles.fontSize);
    
    // Calculate approximate number of lines (using fontSize as fallback if lineHeight is 'normal')
    const effectiveLineHeight = lineHeight === 'normal' ? fontSize * 1.2 : parseInt(lineHeight);
    const numberOfLines = Math.round(titleHeight / effectiveLineHeight);
    
    // If title is single line, show 3 lines of description, else show 2
    setDescriptionLines(numberOfLines === 1 ? 3 : 2);
  }, []);

  useEffect(() => {
    checkTitleHeight();
    // Add resize listener to handle window size changes
    window.addEventListener('resize', checkTitleHeight);
    return () => {
      window.removeEventListener('resize', checkTitleHeight);
    };
  }, [checkTitleHeight]);

  // Generate a unique key for the follow button based on post ID and follow state
  // This ensures the button re-renders when follow state changes
  const followButtonKey = `follow-${post._id}-${post.isFollowing ? 'following' : 'follow'}`;
  
  // Memoize the URL for the post
  const postUrl = useMemo(() => {
    const prefix = post.mediaType === 'newsletter' ? 'newsletters' : 
                  post.mediaType === 'podcast' ? 'podcasts' : '';
    return `/${prefix}/${post.postSlug}`;
  }, [post.mediaType, post.postSlug]);
  
  return (
    <Card className="overflow-hidden transition-all hover:shadow-none shadow-none border-l-0 border-r-0 border-t-0 border-b-1 rounded-none">
      <CardContent className="p-4 h-[116px]">
        <div className="flex items-start gap-4">
          {post.featuredImg && (
            <Link href={postUrl}>
              <div className="flex-shrink-0 w-[82px] h-[82px]">
                <AspectRatio ratio={1/1} className="overflow-hidden rounded-md">
                  <Image
                    src={post.featuredImg}
                    alt={post.title}
                    fill
                    sizes="82px"
                    className="object-cover"
                  />
                </AspectRatio>
              </div>
            </Link>
          )}
          <div className="flex-1 min-w-0 space-y-2 pt-0">
            <div className="flex justify-between items-start gap-4 mt-[-4px]">
              <Link href={postUrl} className="block flex-1">
                <h3 ref={titleRef} className="text-base font-bold leading-tight line-clamp-2 mt-[2px]">
                  {post.title}
                  {post.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                </h3>
              </Link>
              {post.feedUrl && (
                <div className="flex-shrink-0">
                  <FollowButton
                    postId={post._id}
                    feedUrl={post.feedUrl}
                    postTitle={post.title}
                    initialIsFollowing={post.isFollowing ?? false}
                    isAuthenticated={post.isAuthenticated}
                    className="px-2 h-[23px] text-xs font-semibold"
                    key={followButtonKey}
                    disableAutoFetch={true}
                  />
                </div>
              )}
            </div>
            <Link href={postUrl} className="block !mt-[3px]">
              <p className={cn(
                "text-sm text-muted-foreground",
                descriptionLines === 3 ? "line-clamp-3" : "line-clamp-2"
              )}>
                {post.body}
              </p>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memoization
  return (
    prevProps.post._id === nextProps.post._id &&
    prevProps.post.isFollowing === nextProps.post.isFollowing &&
    prevProps.post.isAuthenticated === nextProps.post.isAuthenticated
  );
});

PostCard.displayName = 'PostCard'; 