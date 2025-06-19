'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

interface CommentLikeButtonProps {
  commentId: Id<"comments">;
  initialData?: {
    isLiked: boolean;
    count: number;
  };
  size?: 'sm' | 'md';
  hideCount?: boolean;
  onCountChange?: (count: number) => void;
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
  onCountChange
}: CommentLikeButtonProps) => {
  const [optimisticIsLiked, setOptimisticIsLiked] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const [optimisticTimestamp, setOptimisticTimestamp] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Add authentication and router hooks
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Use Convex's real-time query with proper loading state handling
  const likeStatus = useQuery(api.commentLikes.getCommentLikeStatus, { commentId });
  
  // Track if the like status has been loaded at least once
  const [statusLoaded, setStatusLoaded] = useState(false);
  
  // Update statusLoaded when like status is received
  useEffect(() => {
    if (likeStatus && !statusLoaded) {
      setStatusLoaded(true);
    }
  }, [likeStatus, statusLoaded]);
  
  // Get the like status and count, prioritizing optimistic updates
  // If status hasn't loaded yet, use initialData to prevent flickering
  const isLiked = optimisticIsLiked ?? (statusLoaded ? (likeStatus?.isLiked ?? initialData.isLiked) : initialData.isLiked);
  const count = optimisticCount ?? (statusLoaded ? (likeStatus?.count ?? initialData.count) : initialData.count);
  
  // Notify parent component of count changes
  useEffect(() => {
    if (onCountChange) {
      onCountChange(count);
    }
  }, [count, onCountChange]);
  
  // Only reset optimistic state when real data arrives and matches our expected state
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (likeStatus && (optimisticIsLiked !== null || optimisticCount !== null) && optimisticTimestamp !== null) {
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
  }, [likeStatus, optimisticIsLiked, optimisticCount, optimisticTimestamp]);
  
  const toggleLike = useMutation(api.commentLikes.toggleCommentLike);
  
  // Memoize the toggleLike handler with useCallback to prevent recreating the function on every render
  const handleToggleLike = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Optimistic update with timestamp
    const newIsLiked = !isLiked;
    const currentCount = count ?? 0; // Ensure count is not undefined
    const newCount = currentCount + (newIsLiked ? 1 : -1);
    
    setOptimisticIsLiked(newIsLiked);
    setOptimisticCount(newCount);
    setOptimisticTimestamp(Date.now());
    
    try {
      await toggleLike({ commentId });
      // Successful submission - no need to do anything as Convex will update the UI
    } catch (error) {

      // Revert optimistic update on error
      if (isMountedRef.current) {
        setOptimisticIsLiked(null);
        setOptimisticCount(null);
        setOptimisticTimestamp(null);

        const errorMessage = (error as Error).message || 'Something went wrong';
        let toastTitle = "Error";
        let toastDescription = "Could not update like status. Please try again."; // Generic default

        if (errorMessage.includes("Please wait before toggling again")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "You're liking comments too quickly. Please slow down.";
        } else if (errorMessage.includes("Too many comment likes too quickly")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "You're liking comments too quickly. Please slow down.";
        } else if (errorMessage.includes("Hourly comment like limit reached")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "Hourly limit for liking comments reached. Try again later.";
        } else if (errorMessage.includes("Comment not found")) {
          // Keep generic message for this, as it might be a sync issue
          toastTitle = "Error";
          toastDescription = "Could not find the comment to like. It might have been deleted.";
        }
        // No specific toast for "Not authenticated" as user is redirected.

        toast({
          title: toastTitle,
          description: toastDescription,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [isAuthenticated, router, isSubmitting, isLiked, count, toggleLike, commentId, toast]);
  
  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'sm' : 'default'}
      className={`gap-1 hover:bg-transparent text-muted-foreground !px-0 items-center justify-center ${size === 'sm' ? 'h-6' : ''}`}
      onClick={handleToggleLike}
      disabled={isSubmitting}
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