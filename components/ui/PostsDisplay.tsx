'use client';

import React, { useEffect, memo, useRef, useCallback, useMemo, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Card, CardContent } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { FollowButton } from '@/components/follow-button/CatFollowButton';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePostsData } from '@/lib/hooks/usePostsData';
import { Post, PostsDisplayProps } from '@/lib/types';

// Skeleton loader for PostsDisplay
export const PostsDisplaySkeleton = ({ count = 5, className }: { count?: number, className?: string }) => {
  return (
    <div className={cn("w-full space-y-0", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="overflow-hidden transition-all shadow-none border-l-0 border-r-0 border-t-0 border-b-1 rounded-none">
          <CardContent className="p-4 h-[116px]">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-[82px] h-[82px]">
                <AspectRatio ratio={1/1} className="overflow-hidden rounded-md">
                  <Skeleton className="h-full w-full animate-pulse" />
                </AspectRatio>
              </div>
              <div className="flex-1 min-w-0 space-y-2 pt-0">
                <div className="flex justify-between items-start gap-4 mt-[-4px]">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2 animate-pulse" />
                  </div>
                  <div className="flex-shrink-0">
                    <Skeleton className="h-[23px] w-16 rounded-md animate-pulse" />
                  </div>
                </div>
                <div className="!mt-[3px] space-y-1.5">
                  <Skeleton className="h-3.5 w-full animate-pulse" />
                  <Skeleton className="h-3.5 w-5/6 animate-pulse" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

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

// Main component using modern React patterns
const PostsDisplayComponent = ({
  categoryId,
  mediaType,
  initialPosts = [],
  className,
  searchQuery = '',
  isVisible = true,
  globalFollowStates,
}: PostsDisplayProps) => {
  // Use custom hook for all data management
  const {
    posts,
    hasMore,
    isLoading,
    isInitialLoad,
    nextCursor,
    loadMorePosts,
    updatePost,
  } = usePostsData({
    categoryId,
    mediaType,
    searchQuery,
    initialPosts,
    isVisible,
    globalFollowStates,
  });
  
  // Set up intersection observer for infinite scrolling
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  // Load more posts when intersection observer triggers
  useEffect(() => {
    if (inView && nextCursor && !isInitialLoad) {
      loadMorePosts();
    }
  }, [inView, nextCursor, isInitialLoad, loadMorePosts]);

  // No posts state
  if (posts.length === 0 && !isInitialLoad) {
    return <NoPostsState searchQuery={searchQuery} mediaType={mediaType} className={className} />;
  }

  return (
    <div className={cn("w-full space-y-0", className)}>
      {/* Post cards */}
      {posts.map((post: Post) => (
        <PostCard key={post._id} post={post} onUpdatePost={updatePost} />
      ))}

      {/* Intersection observer target with loading indicator */}
      {nextCursor && (
        <div ref={ref} className="flex justify-center items-center py-4">
          {isLoading && (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          )}
        </div>
      )}
    </div>
  );
};

// Export the memoized version of the component
export const PostsDisplay = memo(PostsDisplayComponent);

// Export the component as default as well for dynamic loading
export default PostsDisplay;

// Post card component - memoized with proper props comparison
const PostCard = memo(({ post, onUpdatePost }: { post: Post; onUpdatePost: (postId: string, updates: Partial<Post>) => void }) => {
  const [descriptionLines, setDescriptionLines] = useState(2);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Memoize the checkTitleHeight function to prevent recreation on each render
  const checkTitleHeight = useCallback(() => {
    if (!titleRef.current) return;
    
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
    const handleResize = () => checkTitleHeight();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
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

  // Handle follow state update
  const handleUpdatePost = useCallback((postId: string, updates: { isFollowing: boolean }) => {
    onUpdatePost(postId, updates);
  }, [onUpdatePost]);
  
  return (
    <Card className="overflow-hidden transition-all hover:shadow-none shadow-none border-l-0 border-r-0 border-t-0 border-b-1 rounded-none">
      <CardContent className="p-4 h-[116px]">
        <div className="flex items-start gap-4">
          {post.featuredImg && (
            <Link href={postUrl} prefetch={false}>
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
              <Link href={postUrl} className="block flex-1" prefetch={false}>
                <h3 ref={titleRef} className="text-base font-bold leading-tight line-clamp-2 mt-[2px]">
                  {post.verified ? (
                    <>
                      {post.title.split(' ').slice(0, -1).join(' ')}{' '}
                      <span className="whitespace-nowrap">
                        {post.title.split(' ').slice(-1)[0]}<VerifiedBadge className="inline-block align-middle ml-1" />
                      </span>
                    </>
                  ) : (
                    post.title
                  )}
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
                    onUpdatePost={handleUpdatePost}
                  />
                </div>
              )}
            </div>
            <Link href={postUrl} className="block !mt-[3px]" prefetch={false}>
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
    prevProps.post.isAuthenticated === nextProps.post.isAuthenticated &&
    prevProps.onUpdatePost === nextProps.onUpdatePost
  );
});

PostCard.displayName = 'PostCard'; 