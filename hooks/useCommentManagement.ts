import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from "@/convex/_generated/dataModel";
import { useSidebar } from "@/components/ui/sidebar-context";
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

  // Authentication and mutations - use sidebar context exclusively to eliminate duplicate users:viewer query
  const { isAuthenticated, userId, username, displayName, profileImage } = useSidebar();
  const deleteCommentMutation = useMutation(api.comments.deleteComment);
  const addComment = useMutation(api.comments.addComment);

  // Use pre-loaded replies from activity data instead of making individual queries
  // Only fall back to query if replies are not pre-loaded (for backward compatibility)
  const shouldQuery = item.type === 'comment' && item._id && !item.replies;
  const commentRepliesQuery = useQuery(
    api.comments.getCommentReplies,
    shouldQuery 
      ? { commentId: typeof item._id === 'string' ? item._id as unknown as Id<"comments"> : item._id }
      : 'skip'
  );

  // Initialize replies from pre-loaded data or query result
  useEffect(() => {
    if (item.type === 'comment') {
      if (item.replies) {
        // Use pre-loaded replies from activity data
        setReplies(item.replies);
        setRepliesLoaded(true);
        setRepliesLoading(false);
      } else if (commentRepliesQuery) {
        // Fall back to query result (for backward compatibility)
        setReplies(commentRepliesQuery);
        setRepliesLoaded(true);
        setRepliesLoading(false);
      }
    }
  }, [item.type, item.replies, commentRepliesQuery]);

  // Check if current user owns the comment - simplified logic
  const isCurrentUserComputed = useMemo(() => {
    if (!isAuthenticated || !userId || item.type !== 'comment') {
      return false;
    }
    
    // For comments on a profile page, check if the current viewer is the profile owner
    // This works because comments on a profile are typically made by the profile owner
    // If we need more granular control, we'd need to add userId to ActivityFeedItem type
    return profileOwnerId ? userId === profileOwnerId : false;
  }, [isAuthenticated, userId, item.type, profileOwnerId]);

  // Update replies when query result changes (fallback only)
  useEffect(() => {
    if (commentRepliesQuery && !item.replies) {
      setReplies(commentRepliesQuery);
      setRepliesLoaded(true);
      setRepliesLoading(false);
    }
  }, [commentRepliesQuery, item.replies]);

  // Toggle replies visibility
  const toggleReplies = useCallback(() => {
    setRepliesExpanded(!repliesExpanded);
  }, [repliesExpanded]);

  // Handle reply button click
  const handleReplyClick = useCallback(() => {
    setIsReplying(!isReplying);
  }, [isReplying]);

  // Handle cancel reply
  const cancelReplyClick = useCallback(() => {
    setIsReplying(false);
    setReplyText('');
  }, []);

  // Submit reply
  const submitReply = useCallback(async () => {
    if (!replyText.trim() || isSubmittingReply || !item._id) return;

    setIsSubmittingReply(true);
    try {
      const result = await addComment({
        entryGuid: item.entryGuid,
        feedUrl: item.feedUrl,
        content: replyText.trim(),
        parentId: typeof item._id === 'string' ? item._id as unknown as Id<"comments"> : item._id,
      });

      // Create a temporary reply object for optimistic UI update
      // The actual reply data will be refreshed from the server
      const tempReply: ActivityFeedComment = {
        _id: result.commentId,
        _creationTime: Date.now(),
        userId: userId!,
        username: username || 'You',
        content: replyText.trim(),
        parentId: typeof item._id === 'string' ? item._id as unknown as Id<"comments"> : item._id,
        entryGuid: item.entryGuid,
        feedUrl: item.feedUrl,
        createdAt: Date.now(),
        user: {
          username: username || 'You',
          name: displayName || 'You',
          profileImage: profileImage || undefined
        }
      };

      setReplies(prev => [...prev, tempReply]);
      setReplyText('');
      setIsReplying(false);
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  }, [replyText, isSubmittingReply, item._id, item.entryGuid, item.feedUrl, addComment, userId, username, displayName, profileImage]);

  // Delete comment
  const deleteComment = useCallback(async () => {
    if (!item._id) return;
    
    try {
      await deleteCommentMutation({
        commentId: typeof item._id === 'string' ? item._id as unknown as Id<"comments"> : item._id,
      });
      setIsDeleted(true);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  }, [item._id, deleteCommentMutation]);

  // Create delete reply function
  const createDeleteReply = useCallback((reply: ActivityFeedComment) => {
    return async () => {
      try {
        await deleteCommentMutation({
          commentId: reply._id,
        });
        setDeletedReplies(prev => new Set([...prev, reply._id.toString()]));
      } catch (error) {
        console.error('Error deleting reply:', error);
      }
    };
  }, [deleteCommentMutation]);

  // Update like count
  const updateLikeCount = useCallback((count: number) => {
    if (likeCountRef.current) {
      const countElement = likeCountRef.current.querySelector('span');
      if (countElement) {
        countElement.textContent = count === 1 ? '1 Like' : `${count} Likes`;
        likeCountRef.current.style.display = count > 0 ? 'block' : 'none';
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
    const element = replyLikeCountRefs.current.get(replyId);
    if (element) {
      const countElement = element.querySelector('span');
      if (countElement) {
        countElement.textContent = count === 1 ? '1 Like' : `${count} Likes`;
        element.style.display = count > 0 ? 'block' : 'none';
      }
    }
  }, []);

  return {
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
    likeCountRef,
    commentRepliesQuery: replies, // Return replies instead of query for backward compatibility
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
    addComment,
  };
} 