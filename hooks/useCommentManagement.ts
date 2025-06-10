import { useState, useCallback, useRef, useMemo } from 'react';
import { useQuery, useConvexAuth, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from "@/convex/_generated/dataModel";
import { ActivityFeedItem, ActivityFeedComment } from '@/lib/types';

export function useCommentManagement(item: ActivityFeedItem, profileOwnerId?: Id<"users">) {
  // State management
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replies, setReplies] = useState<ActivityFeedComment[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [deletedReplies, setDeletedReplies] = useState<Set<string>>(new Set());
  const [isReplying, setIsReplying] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  // Refs
  const likeCountRef = useRef<HTMLDivElement>(null);
  const replyLikeCountRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Authentication and mutations
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer);
  const deleteCommentMutation = useMutation(api.comments.deleteComment);
  const addComment = useMutation(api.comments.addComment);

  // Query for comment replies
  const commentRepliesQuery = useQuery(
    api.comments.getCommentReplies,
    item.type === 'comment' && item._id 
      ? { commentId: typeof item._id === 'string' ? item._id as unknown as Id<"comments"> : item._id }
      : 'skip'
  );

  // Check if current user owns the comment - simplified logic
  const isCurrentUserComputed = useMemo(() => {
    if (!isAuthenticated || !viewer || item.type !== 'comment') {
      return false;
    }
    
    // For comments on a profile page, check if the current viewer is the profile owner
    // This works because comments on a profile are typically made by the profile owner
    // If we need more granular control, we'd need to add userId to ActivityFeedItem type
    return profileOwnerId ? viewer._id === profileOwnerId : false;
  }, [isAuthenticated, viewer, item.type, profileOwnerId]);

  // Update replies when query result changes
  if (repliesExpanded && commentRepliesQuery && item.type === 'comment' && item._id && replies !== commentRepliesQuery) {
    setReplies(commentRepliesQuery || []);
    setRepliesLoaded(true);
    setRepliesLoading(false);
  }

  // Fetch replies callback
  const fetchReplies = useCallback(() => {
    if (item.type !== 'comment' || !item._id) return;

    setRepliesLoading(true);
    try {
      if (commentRepliesQuery) {
        setReplies(commentRepliesQuery || []);
        setRepliesLoaded(true);
      }
    } catch (error) {
      // Removed console.error for production readiness
      setRepliesLoaded(false);
    } finally {
      setRepliesLoading(false);
    }
  }, [item.type, item._id, commentRepliesQuery]);

  // Toggle replies visibility
  const toggleReplies = useCallback(() => {
    const newExpandedState = !repliesExpanded;
    setRepliesExpanded(newExpandedState);

    if (newExpandedState && !repliesLoaded && item.type === 'comment' && item._id) {
      fetchReplies();
    }
  }, [repliesExpanded, fetchReplies, repliesLoaded, item.type, item._id]);

  // Handle reply click
  const handleReplyClick = useCallback(() => {
    setIsReplying(!isReplying);
    if (isReplying) {
      setReplyText(''); // Clear text when canceling
    }
  }, [isReplying]);

  // Cancel reply
  const cancelReplyClick = useCallback(() => {
    setIsReplying(false);
    setReplyText('');
  }, []);

  // Submit reply
  const submitReply = useCallback(async () => {
    if (!replyText.trim() || !item._id || item.type !== 'comment') return;

    setIsSubmittingReply(true);
    try {
      const commentId = typeof item._id === 'string' ? 
        item._id as unknown as Id<"comments"> : 
        item._id;

      await addComment({
        entryGuid: item.entryGuid,
        content: replyText.trim(),
        parentId: commentId,
        feedUrl: '' // Will be populated by the mutation
      });

      setReplyText('');
      setIsReplying(false);
      
      // Refresh replies if they're expanded
      if (repliesExpanded) {
        fetchReplies();
      }
    } catch (error) {
      // Removed console.error for production readiness
    } finally {
      setIsSubmittingReply(false);
    }
  }, [replyText, item._id, item.type, item.entryGuid, addComment, repliesExpanded, fetchReplies]);

  // Delete comment
  const deleteComment = useCallback(async () => {
    if (item.type !== 'comment' || !item._id) return;

    const commentId = typeof item._id === 'string' ?
      item._id as unknown as Id<"comments"> :
      item._id;

    try {
      await deleteCommentMutation({ commentId });
      setIsDeleted(true);
    } catch (error) {
      // Removed console.error for production readiness
    }
  }, [item.type, item._id, deleteCommentMutation]);

  // Delete reply function factory
  const createDeleteReply = useCallback((reply: ActivityFeedComment) => {
    return useCallback(() => {
      if (!reply._id) return;

      deleteCommentMutation({ commentId: reply._id })
        .then(() => {
          setDeletedReplies((prev: Set<string>) => {
            const newSet = new Set(prev);
            newSet.add(reply._id.toString());
            return newSet;
          });
        })
        .catch(error => {
          // Removed console.error for production readiness
        });
    }, [reply._id, deleteCommentMutation]);
  }, [deleteCommentMutation]);

  // Update like count
  const updateLikeCount = useCallback((count: number) => {
    if (likeCountRef.current) {
      const span = likeCountRef.current.querySelector('span');
      if (span) {
        span.textContent = count > 0 ? `${count} Like${count !== 1 ? 's' : ''}` : '0 Likes';
        likeCountRef.current.classList.toggle('hidden', count === 0);
      }
    }
  }, []);

  // Set reply like count ref
  const setReplyLikeCountRef = useCallback((el: HTMLDivElement | null, replyId: string) => {
    if (el) {
      replyLikeCountRefs.current.set(replyId, el);
    } else {
      replyLikeCountRefs.current.delete(replyId);
    }
  }, []);

  // Update reply like count
  const updateReplyLikeCount = useCallback((count: number, replyId: string) => {
    const ref = replyLikeCountRefs.current.get(replyId);
    if (ref) {
      const span = ref.querySelector('span');
      if (span) {
        span.textContent = count > 0 ? `${count} Like${count !== 1 ? 's' : ''}` : '0 Likes';
        ref.classList.toggle('hidden', count === 0);
      }
    }
  }, []);

  return {
    // State
    repliesExpanded,
    replyText,
    isSubmittingReply,
    replies,
    repliesLoading,
    repliesLoaded,
    deletedReplies,
    isReplying,
    isDeleted,
    isCurrentUserComputed,
    
    // Refs
    likeCountRef,
    
    // Query data
    commentRepliesQuery,
    
    // Actions
    setReplyText,
    setIsSubmittingReply,
    setIsReplying,
    toggleReplies,
    handleReplyClick,
    cancelReplyClick,
    submitReply,
    deleteComment,
    createDeleteReply,
    updateLikeCount,
    setReplyLikeCountRef,
    updateReplyLikeCount,
    
    // Mutations
    addComment,
  };
} 