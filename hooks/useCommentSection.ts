import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { 
  UseCommentSectionReturn, 
  CommentSectionProps, 
  CommentFromAPI, 
  CommentWithReplies 
} from '@/lib/types';
import { createCommentSectionStore } from '@/lib/stores/commentSectionStore';

export function useCommentSection({
  entryGuid,
  feedUrl,
  initialData = { count: 0 },
  isOpen: externalIsOpen,
  setIsOpen: externalSetIsOpen,
  buttonOnly = false,
}: Omit<CommentSectionProps, 'buttonOnly'> & { buttonOnly?: boolean }): UseCommentSectionReturn {
  // Create a unique store instance for this component
  const useStore = useMemo(() => createCommentSectionStore(), []);
  
  // Get store state and actions
  const storeState = useStore();
  
  // External dependencies
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const viewer = useQuery(api.users.viewer);
  const { toast } = useToast();
  
  // Handle external isOpen state first (needed for conditional queries)
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : storeState.isOpen;
  const setIsOpen = externalSetIsOpen !== undefined ? externalSetIsOpen : storeState.setIsOpen;
  
  // Convex queries and mutations - only query comments when drawer is open or not button-only
  const shouldQueryComments = !buttonOnly || isOpen;
  const metrics = useQuery(api.entries.getEntryMetrics, { entryGuid });
  const comments = useQuery(api.comments.getComments, shouldQueryComments ? { entryGuid } : "skip");
  const addComment = useMutation(api.comments.addComment);
  const deleteCommentMutation = useMutation(api.comments.deleteComment);
  
  // Refs for cleanup and like count tracking
  const isMountedRef = useRef(true);
  const commentLikeCountRefs = useRef(new Map<string, HTMLDivElement>());
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Update metrics loaded state
  useEffect(() => {
    if (metrics && !storeState.metricsLoaded) {
      storeState.setMetricsLoaded(true);
    }
  }, [metrics, storeState.metricsLoaded, storeState.setMetricsLoaded]);
  
  // Calculate comment count with optimistic updates
  const commentCount = useMemo(() => {
    return storeState.optimisticCount ?? 
           (storeState.metricsLoaded ? (metrics?.comments.count ?? initialData.count) : initialData.count);
  }, [storeState.optimisticCount, storeState.metricsLoaded, metrics, initialData.count]);
  
  // Reset optimistic updates when server data arrives
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (metrics && storeState.optimisticCount !== null && storeState.optimisticTimestamp !== null) {
      const serverCountReflectsOurUpdate = metrics.comments.count >= storeState.optimisticCount;
      const isOptimisticUpdateStale = Date.now() - storeState.optimisticTimestamp > 5000;
      
      if (serverCountReflectsOurUpdate || isOptimisticUpdateStale) {
        storeState.setOptimisticCount(null);
        storeState.setOptimisticTimestamp(null);
      }
    }
  }, [metrics, storeState.optimisticCount, storeState.optimisticTimestamp, storeState.setOptimisticCount, storeState.setOptimisticTimestamp]);
  
  // Organize comments into hierarchy
  const commentHierarchy = useMemo((): CommentWithReplies[] => {
    if (!comments) return [];
    
    const commentMap = new Map<string, CommentWithReplies>();
    const topLevelComments: CommentWithReplies[] = [];
    
    // First pass: create enhanced comment objects
    comments.forEach(comment => {
      commentMap.set(comment._id, { ...comment, replies: [] });
    });
    
    // Second pass: organize into hierarchy
    comments.forEach(comment => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        const enhancedComment = commentMap.get(comment._id);
        if (enhancedComment) {
          topLevelComments.push(enhancedComment);
        }
      }
    });
    
    return topLevelComments;
  }, [comments]);
  
  // Submit comment handler
  const handleSubmit = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    if (!storeState.comment.trim() || storeState.isSubmitting) return;
    
    storeState.setIsSubmitting(true);
    
    // Optimistic update
    storeState.setOptimisticCount((storeState.optimisticCount ?? commentCount) + 1);
    storeState.setOptimisticTimestamp(Date.now());
    
    const commentContent = storeState.comment.trim();
    const parentId = storeState.replyToComment?._id;
    
    try {
      // Clear input immediately for better UX
      storeState.setComment('');
      storeState.setReplyToComment(null);
      
      await addComment({
        entryGuid,
        feedUrl,
        content: commentContent,
        parentId
      });
      
    } catch (error) {
      console.error('❌ Error adding comment:', error);
      
      if (isMountedRef.current) {
        // Revert optimistic update
        storeState.setOptimisticCount(null);
        storeState.setOptimisticTimestamp(null);
        
        // Show appropriate error message
        const errorMessage = (error as Error).message || 'Something went wrong';
        let toastTitle = "Error Adding Comment";
        let toastDescription = errorMessage;
        
        if (errorMessage.includes("Comment cannot be empty")) {
          toastTitle = "Validation Error";
          toastDescription = "Comment cannot be empty. Please enter some text.";
        } else if (errorMessage.includes("Comment too long")) {
          toastTitle = "Validation Error";
          toastDescription = "Your comment is too long. Maximum 500 characters allowed.";
        } else if (errorMessage.includes("Please wait") && errorMessage.includes("seconds before commenting again")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "You're commenting too quickly. Please slow down.";
        } else if (errorMessage.includes("Too many comments too quickly")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "You've posted too many comments quickly. Please slow down.";
        } else if (errorMessage.includes("Hourly comment limit reached")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "You've reached the hourly limit for comments. Please try again later.";
        }
        
        toast({
          title: toastTitle,
          description: toastDescription,
        });
      }
    } finally {
      if (isMountedRef.current) {
        storeState.setIsSubmitting(false);
      }
    }
  }, [
    isAuthenticated, 
    storeState.comment, 
    storeState.isSubmitting, 
    storeState.replyToComment, 
    commentCount, 
    entryGuid, 
    feedUrl, 
    addComment, 
    router, 
    toast,
    storeState.setIsSubmitting,
    storeState.setOptimisticCount,
    storeState.setOptimisticTimestamp,
    storeState.setComment,
    storeState.setReplyToComment,
    storeState.optimisticCount
  ]);
  
  // Reply handler
  const handleReply = useCallback((comment: CommentFromAPI) => {
    storeState.setReplyToComment(comment);
  }, [storeState.setReplyToComment]);
  
  // Delete comment handler
  const handleDeleteComment = useCallback(async (commentId: Id<"comments">) => {
    try {
      await deleteCommentMutation({ commentId });
      
      // Mark comment as deleted in store
      storeState.addDeletedComment(commentId.toString());
      
    } catch (error) {
      console.error('❌ Error deleting comment:', error);
    }
  }, [deleteCommentMutation, storeState.addDeletedComment]);
  
  // Toggle replies handler
  const handleToggleReplies = useCallback((commentId: string) => {
    storeState.toggleRepliesVisibility(commentId);
  }, [storeState.toggleRepliesVisibility]);
  
  // Like count ref handler
  const setCommentLikeCountRef = useCallback((commentId: string, el: HTMLDivElement | null) => {
    if (el && commentId) {
      commentLikeCountRefs.current.set(commentId, el);
    }
  }, []);
  
  // Update like count handler
  const updateCommentLikeCount = useCallback((commentId: string, count: number) => {
    const commentLikeCountElement = commentLikeCountRefs.current.get(commentId);
    if (commentLikeCountElement) {
      if (count > 0) {
        const countText = `${count} ${count === 1 ? 'Like' : 'Likes'}`;
        const countElement = commentLikeCountElement.querySelector('span');
        if (countElement) {
          countElement.textContent = countText;
        }
        commentLikeCountElement.classList.remove('hidden');
      } else {
        commentLikeCountElement.classList.add('hidden');
      }
    }
  }, []);
  
  return {
    // State
    state: {
      ...storeState,
      isOpen,
      commentCount,
    },
    
    // Actions
    actions: {
      ...storeState,
      setIsOpen,
    },
    
    // Computed
    commentHierarchy,
    
    // Handlers
    handleSubmit,
    handleReply,
    handleDeleteComment,
    handleToggleReplies,
    
    // Refs and utilities
    setCommentLikeCountRef,
    updateCommentLikeCount,
  };
} 