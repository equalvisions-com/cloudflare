import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Toggle like status for a comment
export const toggleCommentLike = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if the comment exists
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Check if the user has already liked this comment
    const existingLike = await ctx.db
      .query("commentLikes")
      .withIndex("by_user_comment", (q) => 
        q.eq("userId", userId).eq("commentId", args.commentId)
      )
      .first();

    // If like exists, remove it; otherwise, add it
    if (existingLike) {
      await ctx.db.delete(existingLike._id);
      return { isLiked: false };
    } else {
      await ctx.db.insert("commentLikes", {
        userId,
        commentId: args.commentId,
        likedAt: Date.now(),
      });
      return { isLiked: true };
    }
  },
});

// Get like status and count for a single comment
export const getCommentLikeStatus = query({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    // Count total likes for this comment
    const totalLikes = await ctx.db
      .query("commentLikes")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();
    
    // If user is not authenticated, return only the count
    if (!userId) {
      return { isLiked: false, count: totalLikes.length };
    }
    
    // Check if the current user has liked this comment
    const userLike = await ctx.db
      .query("commentLikes")
      .withIndex("by_user_comment", (q) => 
        q.eq("userId", userId).eq("commentId", args.commentId)
      )
      .first();
    
    return {
      isLiked: !!userLike,
      count: totalLikes.length
    };
  },
});

// Batch get like status and counts for multiple comments
export const batchGetCommentLikes = query({
  args: {
    commentIds: v.array(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const { commentIds } = args;
    
    if (commentIds.length === 0) {
      return [];
    }
    
    // Get all likes for these comments
    const allLikes = await ctx.db
      .query("commentLikes")
      .withIndex("by_comment")
      .filter((q) => 
        q.or(...commentIds.map(id => q.eq(q.field("commentId"), id)))
      )
      .collect();
    
    // Count likes per comment
    const likesCountMap = new Map<string, number>();
    for (const like of allLikes) {
      const commentId = like.commentId.toString();
      likesCountMap.set(commentId, (likesCountMap.get(commentId) || 0) + 1);
    }
    
    // If user is authenticated, check which comments they've liked
    const userLikedMap = new Map<string, boolean>();
    if (userId) {
      const userLikes = await ctx.db
        .query("commentLikes")
        .withIndex("by_user")
        .filter((q) => 
          q.and(
            q.eq(q.field("userId"), userId),
            q.or(...commentIds.map(id => q.eq(q.field("commentId"), id)))
          )
        )
        .collect();
      
      for (const like of userLikes) {
        userLikedMap.set(like.commentId.toString(), true);
      }
    }
    
    // Return results in the same order as input
    return commentIds.map(commentId => ({
      commentId,
      isLiked: !!userLikedMap.get(commentId.toString()),
      count: likesCountMap.get(commentId.toString()) || 0
    }));
  },
}); 