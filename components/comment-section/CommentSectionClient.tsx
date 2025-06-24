'use client';

import { memo, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MessageCircle, X, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ProfileImage } from "@/components/profile/ProfileImage";
import { CommentLikeButton } from "@/components/comment-section/CommentLikeButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from 'next/link';
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  CommentSectionProps, 
  CommentProps, 
  CommentButtonProps,
  CommentWithReplies,
  CommentFromAPI
} from '@/lib/types';
import { useCommentSection } from '@/hooks/useCommentSection';

// Memoized Comment component for optimal performance
const Comment = memo<CommentProps>(({ 
  comment, 
  isReply = false,
  isAuthenticated,
  viewer,
  deletedComments,
  expandedReplies,
  onReply,
  onDeleteComment,
  onToggleReplies,
  onSetCommentLikeCountRef,
  onUpdateCommentLikeCount,
}) => {
  const hasReplies = 'replies' in comment && comment.replies.length > 0;
  const isDeleted = deletedComments.has(comment._id.toString());
  const areRepliesExpanded = expandedReplies.has(comment._id.toString());
  
  // Memoize user checks to prevent unnecessary re-renders
  const isCommentFromCurrentUser = useMemo(() => 
    isAuthenticated && viewer && (viewer._id === comment.userId),
    [isAuthenticated, viewer, comment.userId]
  );
  
  // Memoize profile data to prevent re-renders
  const profileData = useMemo(() => ({
    imageUrl: comment.user?.profileImage || null,
    displayName: comment.user?.name || comment.username || 'Anonymous',
    username: comment.username || (comment.user?.username || ''),
  }), [comment.user, comment.username]);
  
  // Memoize formatted time to prevent recalculation on every render
  const formattedTime = useMemo(() => {
    const now = new Date();
    const commentDate = new Date(comment._creationTime);
    
    if (isNaN(commentDate.getTime())) return '';

    const diffInMs = now.getTime() - commentDate.getTime();
    const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);
    
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 30) return `${diffInDays}d`;
      return `${diffInMonths}mo`;
  }, [comment._creationTime]);
  
  // Don't render deleted comments
  if (isDeleted) return null;
  
  return (
    <div className={`${isReply ? '' : 'border-t border-border'}`}>
      <div className={`flex items-start gap-4 ${isReply ? 'pb-4' : 'py-4 pl-4'}`}>
        {profileData.username ? (
          <Link href={`/@${profileData.username}`} className="flex-shrink-0">
            <ProfileImage 
              profileImage={profileData.imageUrl}
              username={profileData.username}
              size="md-lg"
            />
          </Link>
        ) : (
          <ProfileImage 
            profileImage={profileData.imageUrl}
            username={profileData.username}
            size="md-lg"
            className="flex-shrink-0"
          />
        )}
        
        <div className="flex-1 flex">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              {profileData.username ? (
                <Link href={`/@${profileData.username}`} className="text-sm font-bold leading-none hover:none overflow-anywhere">
                  {profileData.displayName}
                </Link>
              ) : (
                <span className="text-sm font-bold overflow-anywhere leading-none">
                  {profileData.displayName}
                </span>
              )}
            </div>
            
            <p className="text-sm">{comment.content}</p>
            
            <div className="flex items-center gap-4 mt-1">
              <div className="leading-none font-semibold text-muted-foreground text-xs">
                {formattedTime}
              </div>
              
              <div 
                ref={(el) => onSetCommentLikeCountRef(comment._id.toString(), el)}
                className="leading-none font-semibold text-muted-foreground text-xs hidden"
              >
                <span>0 Likes</span>
              </div>
              
              {!isReply && (
                <button 
                  onClick={() => onReply(comment)}
                  className="leading-none font-semibold text-muted-foreground text-xs cursor-pointer hover:underline"
                >
                  Reply
                </button>
              )}
              
              {!isReply && hasReplies && (
                <button 
                  onClick={() => onToggleReplies(comment._id.toString())}
                  className="leading-none font-semibold text-muted-foreground text-xs cursor-pointer hover:underline"
                >
                  {areRepliesExpanded 
                    ? "Hide Replies" 
                    : `View Replies (${(comment as CommentWithReplies).replies.length})`
                  }
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-shrink-0 flex items-center ml-2 pr-4">
            <div className="flex flex-col items-end w-full">
              {isCommentFromCurrentUser && (
                <div className="mb-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-transparent">
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => onDeleteComment(comment._id)}
                        className="text-red-500 focus:text-red-500 cursor-pointer"
                      >
                        Delete Comment
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              
              <CommentLikeButton 
                commentId={comment._id}
                size="sm"
                hideCount={true}
                onCountChange={(count) => onUpdateCommentLikeCount(comment._id.toString(), count)}
              />
            </div>
          </div>
        </div>
      </div>
      
      {hasReplies && areRepliesExpanded && (
        <div style={{ paddingLeft: '44px' }}>
          {(comment as CommentWithReplies).replies.map(reply => (
            <Comment
              key={reply._id}
              comment={reply}
              isReply={true}
              isAuthenticated={isAuthenticated}
              viewer={viewer}
              deletedComments={deletedComments}
              expandedReplies={expandedReplies}
              onReply={onReply}
              onDeleteComment={onDeleteComment}
              onToggleReplies={onToggleReplies}
              onSetCommentLikeCountRef={onSetCommentLikeCountRef}
              onUpdateCommentLikeCount={onUpdateCommentLikeCount}
            />
          ))}
        </div>
      )}
    </div>
  );
});

Comment.displayName = 'Comment';

// Memoized comment button component
const CommentButton = memo<CommentButtonProps>(({ onClick, commentCount }) => (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 px-0 hover:bg-transparent items-center justify-center w-full focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
      onClick={onClick}
      data-comment-input
    >
      <MessageCircle className="h-4 w-4 text-muted-foreground stroke-[2.5] transition-colors duration-200" />
    <span className="text-[14px] text-muted-foreground font-semibold transition-all duration-200">
      {commentCount}
    </span>
    </Button>
));

CommentButton.displayName = 'CommentButton';

// Main component with error boundary wrapper
export function CommentSectionClientWithErrorBoundary(props: CommentSectionProps) {
  return (
    <ErrorBoundary>
      <CommentSectionClient {...props} />
    </ErrorBoundary>
  );
}

// Optimized main component
export const CommentSectionClient = memo<CommentSectionProps>(({ 
  entryGuid, 
  feedUrl,
  initialData = { count: 0 },
  isOpen: externalIsOpen,
  setIsOpen: externalSetIsOpen,
  buttonOnly = false
}) => {
  // Use custom hook for all business logic
  const {
    state,
    actions,
    commentHierarchy,
    handleSubmit,
    handleReply,
    handleDeleteComment,
    handleToggleReplies,
    setCommentLikeCountRef,
    updateCommentLikeCount,
  } = useCommentSection({
    entryGuid,
    feedUrl,
    initialData,
    isOpen: externalIsOpen,
    setIsOpen: externalSetIsOpen,
    buttonOnly,
  });
  
  // Get authentication state and viewer
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer);
  
  // Memoize the drawer open handler to prevent re-renders
  const handleOpenDrawer = useMemo(() => () => {
    actions.setIsOpen(true);
  }, [actions.setIsOpen]);
  
  // Only render the button if buttonOnly is true
  if (buttonOnly) {
    return <CommentButton onClick={handleOpenDrawer} commentCount={state.commentCount} />;
  }
  
  return (
    <Drawer open={state.isOpen} onOpenChange={actions.setIsOpen}>
      <DrawerContent 
        className="h-[75vh] w-full max-w-[550px] mx-auto" 
        data-drawer-content="comment-section"
      >
          <DrawerHeader 
             className={`px-4 pb-4 ${commentHierarchy.length === 0 ? 'border-b' : ''}`}
           >
          <DrawerTitle className="text-center text-base font-extrabold leading-none tracking-tight">
            Comments
          </DrawerTitle>
          </DrawerHeader>
          
          <ScrollArea className="h-[calc(75vh-160px)]" scrollHideDelay={0} type="always">
            <div className="mt-0">
              {commentHierarchy.length > 0 ? (
                commentHierarchy.map(comment => (
                  <Comment
                    key={comment._id}
                    comment={comment}
                    isAuthenticated={isAuthenticated}
                    viewer={viewer}
                  deletedComments={state.deletedComments}
                  expandedReplies={state.expandedReplies}
                    onReply={handleReply}
                  onDeleteComment={handleDeleteComment}
                  onToggleReplies={handleToggleReplies}
                    onSetCommentLikeCountRef={setCommentLikeCountRef}
                    onUpdateCommentLikeCount={updateCommentLikeCount}
                  />
                ))
              ) : (
              <p className="text-muted-foreground py-4 text-center">
                No comments yet. Be the first to comment!
              </p>
              )}
            </div>
          </ScrollArea>
          
          <div className="flex flex-col gap-2 mt-2 border-t border-border p-4">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Textarea
                placeholder={state.replyToComment 
                  ? `Reply to ${state.replyToComment.username}...`
                    : "Add a comment..."}
                value={state.comment}
                onChange={(e) => actions.setComment(e.target.value)}
                  className="resize-none h-9 py-2 min-h-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  maxLength={500}
                  rows={1}
                  data-comment-input
                />
                <Button 
                  onClick={handleSubmit} 
                disabled={!state.comment.trim() || state.isSubmitting}
                >
                {state.isSubmitting ? "Posting..." : "Post"}
                </Button>
              </div>
            
              <div className="flex justify-between items-center text-xs text-muted-foreground">
              {state.replyToComment && (
                  <button 
                  onClick={() => actions.setReplyToComment(null)}
                    className="text-xs text-muted-foreground hover:underline flex items-center font-semibold"
                  >
                    <X className="h-3.5 w-3.5 mr-1 stroke-[2.5]" />
                    Cancel Reply
                  </button>
                )}
              <div className={`${state.replyToComment ? '' : 'w-full'} text-right`}>
                {state.comment.length}/500 characters
                </div>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
  );
});

CommentSectionClient.displayName = 'CommentSectionClient'; 