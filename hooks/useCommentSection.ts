import { useCallback, useEffect, useMemo, useRef, useReducer } from 'react';
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useSidebar } from "@/components/ui/sidebar-context";
import { 
  UseCommentSectionReturn, 
  CommentSectionProps, 
  CommentFromAPI, 
  CommentWithReplies,
  CommentSectionState
} from '@/lib/types';

// React Reducer Actions
type CommentSectionAction =
  | { type: 'SET_IS_OPEN'; payload: boolean }
  | { type: 'SET_COMMENT'; payload: string }
  | { type: 'SET_IS_SUBMITTING'; payload: boolean }
  | { type: 'SET_REPLY_TO_COMMENT'; payload: CommentFromAPI | null }
  | { type: 'TOGGLE_REPLIES_VISIBILITY'; payload: string }
  | { type: 'ADD_DELETED_COMMENT'; payload: string }
  | { type: 'SET_OPTIMISTIC_COUNT'; payload: number | null }
  | { type: 'SET_OPTIMISTIC_TIMESTAMP'; payload: number | null }
  | { type: 'SET_METRICS_LOADED'; payload: boolean }
  | { type: 'RESET' };

// Initial state factory
const createInitialState = (): CommentSectionState => ({
  // UI State
  isOpen: false,
  comment: '',
  isSubmitting: false,
  replyToComment: null,
  expandedReplies: new Set<string>(),
  deletedComments: new Set<string>(),
  
  // Optimistic Updates
  optimisticCount: null,
  optimisticTimestamp: null,
  
  // Metrics
  metricsLoaded: false,
});

// React Reducer
const commentSectionReducer = (state: CommentSectionState, action: CommentSectionAction): CommentSectionState => {
  switch (action.type) {
    case 'SET_IS_OPEN':
      return { ...state, isOpen: action.payload };
      
    case 'SET_COMMENT':
      return { ...state, comment: action.payload.slice(0, 500) }; // Enforce 500 char limit
      
    case 'SET_IS_SUBMITTING':
      return { ...state, isSubmitting: action.payload };
      
    case 'SET_REPLY_TO_COMMENT':
      return { ...state, replyToComment: action.payload };
      
    case 'TOGGLE_REPLIES_VISIBILITY': {
      const newExpandedReplies = new Set(state.expandedReplies);
      if (newExpandedReplies.has(action.payload)) {
        newExpandedReplies.delete(action.payload);
      } else {
        newExpandedReplies.add(action.payload);
      }
      return { ...state, expandedReplies: newExpandedReplies };
    }
    
    case 'ADD_DELETED_COMMENT': {
      const newDeletedComments = new Set(state.deletedComments);
      newDeletedComments.add(action.payload);
      return { ...state, deletedComments: newDeletedComments };
    }
    
    case 'SET_OPTIMISTIC_COUNT':
      return { ...state, optimisticCount: action.payload };
      
    case 'SET_OPTIMISTIC_TIMESTAMP':
      return { ...state, optimisticTimestamp: action.payload };
      
    case 'SET_METRICS_LOADED':
      return { ...state, metricsLoaded: action.payload };
      
    case 'RESET':
      return createInitialState();
      
    default:
      return state;
  }
};

export function useCommentSection({
  entryGuid,
  feedUrl,
  initialData = { count: 0 },
  isOpen: externalIsOpen,
  setIsOpen: externalSetIsOpen,
  buttonOnly = false,
  skipQuery = false,
}: Omit<CommentSectionProps, 'buttonOnly'> & { buttonOnly?: boolean; skipQuery?: boolean }): UseCommentSectionReturn {
  // React state management (replaces Zustand)
  const [state, dispatch] = useReducer(commentSectionReducer, createInitialState());
  
  // External dependencies - use sidebar context to eliminate duplicate users:viewer query
  const { isAuthenticated } = useSidebar();
  const router = useRouter();
  const { toast } = useToast();
  
  // AbortController for request cleanup (replaces isMountedRef anti-pattern)
  const abortControllerRef = useRef<AbortController | null>(null);
  const commentLikeCountRefs = useRef(new Map<string, HTMLDivElement>());
  
  // Setup AbortController on mount and cleanup on unmount
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    
    return () => {
      // Cleanup: abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Cleanup: clear DOM references
      commentLikeCountRefs.current.clear();
    };
  }, []);
  
  // Handle external isOpen state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : state.isOpen;
  const setIsOpen = useCallback((open: boolean) => {
    if (externalSetIsOpen) {
      externalSetIsOpen(open);
    } else {
      dispatch({ type: 'SET_IS_OPEN', payload: open });
    }
  }, [externalSetIsOpen]);
  
  // Convex queries and mutations - only query comments when drawer is open or not button-only
  const shouldQueryComments = !buttonOnly || isOpen;
  const metrics = useQuery(
    api.entries.getEntryMetrics, 
    skipQuery ? 'skip' : { entryGuid }
  );
  const comments = useQuery(api.comments.getComments, shouldQueryComments ? { entryGuid } : "skip");
  const addComment = useMutation(api.comments.addComment);
  const deleteCommentMutation = useMutation(api.comments.deleteComment);
  
  // Update metrics loaded state
  useEffect(() => {
    if (metrics && !state.metricsLoaded) {
      dispatch({ type: 'SET_METRICS_LOADED', payload: true });
    }
  }, [metrics, state.metricsLoaded]);
  
  // Calculate comment count with optimistic updates
  const commentCount = useMemo(() => {
    return state.optimisticCount ?? 
           (state.metricsLoaded ? (metrics?.comments.count ?? initialData.count) : initialData.count);
  }, [state.optimisticCount, state.metricsLoaded, metrics, initialData.count]);
  
  // Reset optimistic updates when server data arrives
  useEffect(() => {
    // Check if request was aborted
    if (abortControllerRef.current?.signal.aborted) return;
    
    if (metrics && state.optimisticCount !== null && state.optimisticTimestamp !== null) {
      const serverCountReflectsOurUpdate = metrics.comments.count >= state.optimisticCount;
      const isOptimisticUpdateStale = Date.now() - state.optimisticTimestamp > 5000;
      
      if (serverCountReflectsOurUpdate || isOptimisticUpdateStale) {
        dispatch({ type: 'SET_OPTIMISTIC_COUNT', payload: null });
        dispatch({ type: 'SET_OPTIMISTIC_TIMESTAMP', payload: null });
      }
    }
  }, [metrics, state.optimisticCount, state.optimisticTimestamp]);
  
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
    if (!state.comment.trim() || state.isSubmitting) return;
    
    dispatch({ type: 'SET_IS_SUBMITTING', payload: true });
    
    // Optimistic update
    dispatch({ type: 'SET_OPTIMISTIC_COUNT', payload: (state.optimisticCount ?? commentCount) + 1 });
    dispatch({ type: 'SET_OPTIMISTIC_TIMESTAMP', payload: Date.now() });
    
    const commentContent = state.comment.trim();
    const parentId = state.replyToComment?._id;
    
    try {
      // Clear input immediately for better UX
      dispatch({ type: 'SET_COMMENT', payload: '' });
      dispatch({ type: 'SET_REPLY_TO_COMMENT', payload: null });
      
      await addComment({
        entryGuid,
        feedUrl,
        content: commentContent,
        parentId
      });
      
    } catch (error) {
      // Check if request was aborted (component unmounted)
      if (abortControllerRef.current?.signal.aborted) return;
      
      // Revert optimistic update
      dispatch({ type: 'SET_OPTIMISTIC_COUNT', payload: null });
      dispatch({ type: 'SET_OPTIMISTIC_TIMESTAMP', payload: null });
      
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
    } finally {
      // Check if request was aborted before updating state
      if (!abortControllerRef.current?.signal.aborted) {
        dispatch({ type: 'SET_IS_SUBMITTING', payload: false });
      }
    }
  }, [
    isAuthenticated, 
    state.comment, 
    state.isSubmitting, 
    state.replyToComment, 
    commentCount, 
    entryGuid, 
    feedUrl, 
    addComment, 
    router, 
    toast,
    state.optimisticCount
  ]);
  
  // Reply handler
  const handleReply = useCallback((comment: CommentFromAPI) => {
    dispatch({ type: 'SET_REPLY_TO_COMMENT', payload: comment });
  }, []);
  
  // Delete comment handler
  const handleDeleteComment = useCallback(async (commentId: Id<"comments">) => {
    try {
      await deleteCommentMutation({ commentId });
      
      // Mark comment as deleted
      dispatch({ type: 'ADD_DELETED_COMMENT', payload: commentId.toString() });
      
    } catch (error) {
      // Silent error handling for production
      console.error('Failed to delete comment:', error);
    }
  }, [deleteCommentMutation]);
  
  // Toggle replies handler
  const handleToggleReplies = useCallback((commentId: string) => {
    dispatch({ type: 'TOGGLE_REPLIES_VISIBILITY', payload: commentId });
  }, []);
  
  // Like count ref handler with proper cleanup
  const setCommentLikeCountRef = useCallback((commentId: string, el: HTMLDivElement | null) => {
    if (el && commentId) {
      commentLikeCountRefs.current.set(commentId, el);
    } else if (commentId) {
      commentLikeCountRefs.current.delete(commentId);
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
  
  // Create actions object that matches the old Zustand interface
  const actions = useMemo(() => ({
    setIsOpen,
    setComment: (comment: string) => dispatch({ type: 'SET_COMMENT', payload: comment }),
    setIsSubmitting: (submitting: boolean) => dispatch({ type: 'SET_IS_SUBMITTING', payload: submitting }),
    setReplyToComment: (comment: CommentFromAPI | null) => dispatch({ type: 'SET_REPLY_TO_COMMENT', payload: comment }),
    toggleRepliesVisibility: (commentId: string) => dispatch({ type: 'TOGGLE_REPLIES_VISIBILITY', payload: commentId }),
    addDeletedComment: (commentId: string) => dispatch({ type: 'ADD_DELETED_COMMENT', payload: commentId }),
    setOptimisticCount: (count: number | null) => dispatch({ type: 'SET_OPTIMISTIC_COUNT', payload: count }),
    setOptimisticTimestamp: (timestamp: number | null) => dispatch({ type: 'SET_OPTIMISTIC_TIMESTAMP', payload: timestamp }),
    setMetricsLoaded: (loaded: boolean) => dispatch({ type: 'SET_METRICS_LOADED', payload: loaded }),
    reset: () => dispatch({ type: 'RESET' }),
    // Legacy methods for compatibility (will be removed in cleanup)
    submitComment: async () => {},
    deleteComment: async (commentId: Id<"comments">) => {},
  }), [setIsOpen]);
  
  return {
    // State
    state: {
      ...state,
      isOpen,
      commentCount,
    },
    
    // Actions
    actions,
    
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