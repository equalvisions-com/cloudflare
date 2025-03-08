'use client';

import React, { useEffect, useState, memo, useRef } from 'react';
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
  author?: string;
  authorUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  platform?: string;
  // Follow state fields
  isFollowing?: boolean;
  isAuthenticated?: boolean;
}

interface PostsDisplayProps {
  categoryId: string;
  mediaType: string;
  initialPosts?: Post[];
  className?: string;
  searchQuery?: string;
}

// Memoize loading state component
const LoadingState = memo(({ className }: { className?: string }) => (
  <div className={cn("flex justify-center items-center py-12", className)}>
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
));

LoadingState.displayName = 'LoadingState';

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

// Memoize loading indicator component
const LoadingIndicator = memo(() => (
  <div className="py-4 flex justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
));

LoadingIndicator.displayName = 'LoadingIndicator';

export function PostsDisplay({
  categoryId,
  mediaType,
  initialPosts = [],
  className,
  searchQuery = '',
}: PostsDisplayProps) {
  // Store posts and pagination state
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [isInitialLoad, setIsInitialLoad] = useState(initialPosts.length === 0);
  const { isAuthenticated } = useConvexAuth();
  
  // Set up intersection observer for infinite scrolling
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  // Query for posts - either search results or category posts
  const postsResult = useQuery(
    searchQuery ? api.posts.searchPosts : api.categories.getPostsByCategory,
    searchQuery 
      ? { query: searchQuery, mediaType, cursor: nextCursor || undefined, limit: 10 }
      : { categoryId, mediaType, cursor: nextCursor || undefined, limit: 10 }
  );

  // Query for follow states if authenticated and we have posts
  const followStates = useQuery(
    api.following.getFollowStates,
    isAuthenticated && posts.length > 0
      ? { postIds: posts.map(post => post._id) }
      : "skip"
  );

  // Reset posts when category or search query changes
  useEffect(() => {
    if (initialPosts.length > 0) {
      setPosts(initialPosts.map(post => ({
        ...post,
        isAuthenticated
      })));
      setNextCursor(undefined);
    }
    setIsInitialLoad(initialPosts.length === 0);
  }, [categoryId, searchQuery, initialPosts, isAuthenticated]);

  // Load initial posts if not provided
  useEffect(() => {
    if (isInitialLoad && postsResult) {
      const newPosts = postsResult.posts as Post[];
      const postsWithAuth = newPosts.map(post => ({
        ...post,
        isAuthenticated,
        isFollowing: followStates && Array.isArray(followStates) 
          ? followStates.includes(post._id)
          : false
      }));
      setPosts(postsWithAuth);
      setNextCursor(postsResult.nextCursor);
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, postsResult, isAuthenticated, followStates]);

  // Update follow states when they load
  useEffect(() => {
    if (followStates && Array.isArray(followStates)) {
      setPosts(currentPosts => 
        currentPosts.map(post => ({
          ...post,
          isAuthenticated,
          isFollowing: followStates.includes(post._id)
        }))
      );
    }
  }, [followStates, isAuthenticated]);

  // Load more posts when bottom is reached
  useEffect(() => {
    if (inView && nextCursor && !isInitialLoad && postsResult) {
      const newPosts = (postsResult.posts as Post[]).map(post => ({
        ...post,
        isAuthenticated,
        isFollowing: followStates && Array.isArray(followStates) 
          ? followStates.includes(post._id)
          : false
      }));
      setPosts(prev => [...prev, ...newPosts]);
      setNextCursor(postsResult.nextCursor);
    }
  }, [inView, nextCursor, isInitialLoad, postsResult, isAuthenticated, followStates]);

  // Loading state
  if (isInitialLoad && !postsResult) {
    return <LoadingState className={className} />;
  }

  // No posts state
  if (posts.length === 0 && !isInitialLoad) {
    return <NoPostsState searchQuery={searchQuery} mediaType={mediaType} className={className} />;
  }

  return (
    <div className={cn("space-y-0", className)}>
      {/* Post cards */}
      {posts.map((post) => (
        <PostCard key={post._id} post={post} />
      ))}

      {/* Loading indicator and intersection observer target */}
      {nextCursor && (
        <div ref={ref}>
          <LoadingIndicator />
        </div>
      )}
    </div>
  );
}

// Post card component - memoized with proper props comparison
const PostCard = memo(({ post }: { post: Post }) => {
  const [descriptionLines, setDescriptionLines] = useState(2);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const checkTitleHeight = () => {
      if (titleRef.current) {
        const styles = window.getComputedStyle(titleRef.current);
        const lineHeight = styles.lineHeight;
        const titleHeight = titleRef.current.offsetHeight;
        const fontSize = parseInt(styles.fontSize);
        
        // Calculate approximate number of lines (using fontSize as fallback if lineHeight is 'normal')
        const effectiveLineHeight = lineHeight === 'normal' ? fontSize * 1.2 : parseInt(lineHeight);
        const numberOfLines = Math.round(titleHeight / effectiveLineHeight);
        
        // If title is single line, show 3 lines of description, else show 2
        setDescriptionLines(numberOfLines === 1 ? 3 : 2);
      }
    };

    checkTitleHeight();
    // Add resize listener to handle window size changes
    window.addEventListener('resize', checkTitleHeight);
    return () => window.removeEventListener('resize', checkTitleHeight);
  }, []);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-none shadow-none border-l-0 border-r-0 border-t-0 border-b-1 rounded-none">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {post.featuredImg && (
            <Link href={`/${post.categorySlug}/${post.postSlug}`}>
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
              <Link href={`/${post.categorySlug}/${post.postSlug}`} className="block flex-1">
                <h3 ref={titleRef} className="text-lg font-semibold leading-tight line-clamp-2 mt-[2px]">{post.title}</h3>
              </Link>
              {post.feedUrl && (
                <div className="flex-shrink-0">
                  <FollowButton
                    postId={post._id}
                    feedUrl={post.feedUrl}
                    postTitle={post.title}
                    initialIsFollowing={post.isFollowing ?? false}
                    isAuthenticated={post.isAuthenticated}
                    className="px-2 h-[23px] text-xs"
                  />
                </div>
              )}
            </div>
            <Link href={`/${post.categorySlug}/${post.postSlug}`} className="block !mt-[3px]">
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