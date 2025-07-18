'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useSidebar } from '@/components/ui/sidebar-context';

interface CommentLikeButtonProps {
  commentId: Id<"comments">;
  initialData?: {
    isLiked: boolean;
    count: number;
  };
  size?: 'sm' | 'md';
  hideCount?: boolean;
  onCountChange?: (count: number) => void;
  onStoreUpdate?: (commentId: string, isLiked: boolean, count: number) => void; // New prop to update store
  skipQuery?: boolean; // When true, don't use individual query
}

export function CommentLikeButtonWithErrorBoundary(props: CommentLikeButtonProps) {
  return (
    <ErrorBoundary>
      <CommentLikeButton {...props} />
    </ErrorBoundary>
  );
}

// The main component that will be memoized
const CommentLikeButtonComponent = ({ 
  commentId, 
  initialData = { isLiked: false, count: 0 },
  size = 'sm',
  hideCount = false,
  onCountChange,
  onStoreUpdate,
  skipQuery = false
}: CommentLikeButtonProps) => {
  const [optimisticIsLiked, setOptimisticIsLiked] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const [optimisticTimestamp, setOptimisticTimestamp] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  
  // AbortController for request cleanup (replaces isMountedRef anti-pattern)
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Add authentication and router hooks
  // Use sidebar context to eliminate duplicate users:viewer query (same as other buttons)
  const { isAuthenticated } = useSidebar();
  const router = useRouter();
  const { toast } = useToast();
  
  useEffect(() => {
    // Setup AbortController on mount
    abortControllerRef.current = new AbortController();
    
    // Cleanup function to abort requests when component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  // Use Convex's real-time query with proper loading state handling
  // Skip query if parent is handling batch comment likes
  const likeStatus = useQuery(
    api.commentLikes.getCommentLikeStatus, 
    skipQuery ? 'skip' : { commentId }
  );
  
  // Track if the like status has been loaded at least once
  const [statusLoaded, setStatusLoaded] = useState(false);
  
  // Update statusLoaded when like status is received OR when skipQuery is true
  useEffect(() => {
    if ((likeStatus && !statusLoaded) || (skipQuery && !statusLoaded)) {
      setStatusLoaded(true);
    }
  }, [likeStatus, statusLoaded, skipQuery]);
  
  // Get the like status and count, prioritizing optimistic updates
  // When skipQuery is true, always use initialData as the base (it comes from batch comment likes)
  // When skipQuery is false, use server like status after it loads
  const isLiked = optimisticIsLiked ?? (skipQuery ? initialData.isLiked : (statusLoaded ? (likeStatus?.isLiked ?? initialData.isLiked) : initialData.isLiked));
  const count = optimisticCount ?? (skipQuery ? initialData.count : (statusLoaded ? (likeStatus?.count ?? initialData.count) : initialData.count));
  
  // Notify parent component of count changes
  useEffect(() => {
    if (onCountChange) {
      onCountChange(count);
    }
  }, [count, onCountChange]);
  
  // Only reset optimistic state when real data arrives and matches our expected state
  useEffect(() => {
    // Check if request was aborted
    if (abortControllerRef.current?.signal.aborted) return;
    
    // When skipQuery is true, we rely on initialData updates from parent batch comment likes
    // When skipQuery is false, we rely on individual like status query
    if (skipQuery) {
      // For skipQuery mode, clear optimistic state when initialData changes and matches our expected state
      if (optimisticIsLiked !== null || optimisticCount !== null) {
        const isServerMatchingOptimistic = initialData.isLiked === optimisticIsLiked && initialData.count === optimisticCount;
        const isOptimisticUpdateStale = optimisticTimestamp !== null && Date.now() - optimisticTimestamp > 3000; // 3 seconds
        
        if (isServerMatchingOptimistic || isOptimisticUpdateStale) {
          setOptimisticIsLiked(null);
          setOptimisticCount(null);
          setOptimisticTimestamp(null);
        }
      }
    } else if (likeStatus && (optimisticIsLiked !== null || optimisticCount !== null) && optimisticTimestamp !== null) {
      // Only clear optimistic state if:
      // 1. The server state matches our optimistic state (meaning our update was processed)
      // 2. OR if the optimistic update is older than 5 seconds (fallback)
      const serverStateReflectsOurUpdate = 
        (optimisticIsLiked === null || likeStatus.isLiked === optimisticIsLiked) &&
        (optimisticCount === null || (likeStatus.count ?? 0) === optimisticCount);
      const isOptimisticUpdateStale = Date.now() - optimisticTimestamp > 5000;
      
      if (serverStateReflectsOurUpdate || isOptimisticUpdateStale) {
        setOptimisticIsLiked(null);
        setOptimisticCount(null);
        setOptimisticTimestamp(null);
      }
    }
  }, [likeStatus, optimisticIsLiked, optimisticCount, optimisticTimestamp, skipQuery, initialData]);
  
  const toggleLike = useMutation(api.commentLikes.toggleCommentLike);
  
  // Memoize the toggleLike handler with useCallback to prevent recreating the function on every render
  const handleToggleLike = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    if (isBusy) return;
    
    setIsBusy(true);
    
    // Optimistic update with timestamp
    const newIsLiked = !isLiked;
    const currentCount = count ?? 0; // Ensure count is not undefined
    const newCount = currentCount + (newIsLiked ? 1 : -1);
    
    setOptimisticIsLiked(newIsLiked);
    setOptimisticCount(newCount);
    setOptimisticTimestamp(Date.now());
    
    try {
      await toggleLike({ commentId });
      // Successful submission - update store if callback provided
      if (onStoreUpdate) {
        onStoreUpdate(commentId, newIsLiked, newCount);
      }
    } catch (error) {

      // Check if request was aborted (component unmounted)
      if (abortControllerRef.current?.signal.aborted) return;
      
      // Revert optimistic update on error
      setOptimisticIsLiked(null);
      setOptimisticCount(null);
      setOptimisticTimestamp(null);

      // Show user-friendly error messages - server handles all rate limiting
      const errorMessage = (error as Error).message || 'Something went wrong';
      let toastTitle = "Error";
      let toastDescription = "Could not update like status. Please try again.";

      // Handle rate limiting errors from server
      if (errorMessage.includes("rate limit") || errorMessage.includes("Rate limit") || 
          errorMessage.includes("too quickly") || errorMessage.includes("limit reached")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "You're performing actions too quickly. Please slow down.";
      } else if (errorMessage.includes("Comment not found")) {
        toastDescription = "Could not find the comment to like. It might have been deleted.";
      }

      toast({
        title: toastTitle,
        description: toastDescription,
      });
    } finally {
      // Check if request was aborted before updating state
      if (!abortControllerRef.current?.signal.aborted) {
        setIsBusy(false);
      }
    }
  }, [isAuthenticated, router, isBusy, isLiked, count, toggleLike, commentId, onStoreUpdate, toast]);
  
  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'sm' : 'default'}
      className={`gap-1 hover:bg-transparent text-muted-foreground !px-0 items-center justify-center ${size === 'sm' ? 'h-6' : ''}`}
      onClick={handleToggleLike}
      disabled={isBusy}
    >
      <Heart 
        className={`${size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} transition-colors duration-200 ${isLiked ? 'fill-current text-[#f91880]' : ''}`} 
      />
      {!hideCount && (count ?? 0) > 0 && (
        <span className={`transition-all duration-200 ${isLiked ? 'text-[#f91880]' : ''} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {count}
        </span>
      )}
    </Button>
  );
};

// Export the memoized version of the component
export const CommentLikeButton = memo(CommentLikeButtonComponent); 