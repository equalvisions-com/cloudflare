'use client';

import React, { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from './skeleton';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import Link from 'next/link';

// Define the shape of a post from the database
export interface Post {
  _id: string;
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
}

interface PostsDisplayProps {
  categoryId: string;
  mediaType: string;
  initialPosts?: Post[];
  className?: string;
}

export function PostsDisplay({
  categoryId,
  mediaType,
  initialPosts = [],
  className,
}: PostsDisplayProps) {
  // Store posts and pagination state
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [isInitialLoad, setIsInitialLoad] = useState(initialPosts.length === 0);
  
  // Set up intersection observer for infinite scrolling
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  // Query for posts by category
  const postsResult = useQuery(
    api.categories.getPostsByCategory,
    { 
      categoryId, 
      mediaType,
      cursor: nextCursor || undefined,
      limit: 10
    }
  );

  // Reset posts when category changes
  useEffect(() => {
    setPosts(initialPosts);
    setNextCursor(undefined);
    setIsInitialLoad(initialPosts.length === 0);
  }, [categoryId, initialPosts]);

  // Load initial posts if not provided
  useEffect(() => {
    if (isInitialLoad && postsResult) {
      setPosts(postsResult.posts as Post[]);
      setNextCursor(postsResult.nextCursor);
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, postsResult]);

  // Load more posts when bottom is reached
  useEffect(() => {
    if (inView && nextCursor && !isInitialLoad && postsResult) {
      // Append new posts to existing ones
      setPosts(prev => [...prev, ...(postsResult.posts as Post[])]);
      setNextCursor(postsResult.nextCursor);
    }
  }, [inView, nextCursor, isInitialLoad, postsResult]);

  // Loading state
  if (isInitialLoad && !postsResult) {
    return (
      <div className={className}>
        {[1, 2, 3].map((i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // No posts state
  if (posts.length === 0 && !isInitialLoad) {
    return (
      <div className={`py-8 text-center text-muted-foreground ${className}`}>
        No posts found in this category
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-4`}>
      {/* Post cards */}
      {posts.map((post) => (
        <PostCard key={post._id} post={post} />
      ))}

      {/* Loading indicator and intersection observer target */}
      {nextCursor && (
        <div ref={ref} className="py-4 flex justify-center">
          <PostCardSkeleton />
        </div>
      )}
    </div>
  );
}

// Post card component
function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/${post.categorySlug}/${post.postSlug}`} className="block">
      <Card className="overflow-hidden transition-all hover:shadow-none shadow-none">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {post.featuredImg && (
              <div className="flex-shrink-0 w-24 h-24">
                <AspectRatio ratio={1/1} className="overflow-hidden rounded-md">
                  <img
                    src={post.featuredImg}
                    alt={post.title}
                    className="object-cover w-full h-full"
                  />
                </AspectRatio>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold mb-2 line-clamp-2">{post.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {post.body.substring(0, 150)}...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Skeleton loader for post cards
function PostCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Skeleton className="flex-shrink-0 w-24 h-24 rounded-md" />
          <div className="flex-1">
            <Skeleton className="w-3/4 h-6 mb-2" />
            <Skeleton className="w-full h-4 mb-1" />
            <Skeleton className="w-full h-4 mb-1" />
            <Skeleton className="w-2/3 h-4 mb-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 