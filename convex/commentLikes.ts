import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Rate limiting constants for comment likes
const COMMENT_LIKE_RATE_LIMITS = {
  PER_COMMENT_COOLDOWN: 500,      // 0.5 seconds between like/unlike on same comment
  BURST_LIMIT: 5,                // 5 comment likes max
  BURST_WINDOW: 30000,            // in 30 seconds
  HOURLY_LIMIT: 50,              // 50 comment likes per hour
  HOURLY_WINDOW: 3600000,         // 1 hour in milliseconds
};

// Toggle like status for a comment
export const toggleCommentLike = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if the comment exists with field filtering
    const comment = await ctx.db
      .query("comments")
      .filter(q => q.eq(q.field("_id"), args.commentId))
      .first()
      .then(comment => comment ? { _id: comment._id } : null);
      
    if (!comment) throw new Error("Comment not found");

    // 1. Check if already liked (per-comment cooldown)
    const existingLike = await ctx.db
      .query("commentLikes")
      .withIndex("by_user_comment", (q) => 
        q.eq("userId", userId).eq("commentId", args.commentId)
      )
      .first();

    if (existingLike) {
      // Per-comment cooldown: 0.5 seconds between like/unlike on same comment
      const timeSinceLastAction = Date.now() - existingLike._creationTime;
      if (timeSinceLastAction < COMMENT_LIKE_RATE_LIMITS.PER_COMMENT_COOLDOWN) {
        throw new Error("Please wait before toggling again");
      }
      // If cooldown passed, this is an unlike action - delete and return
      await ctx.db.delete(existingLike._id);
      return { isLiked: false, action: "unliked" };
    }

    // 2. Burst protection: Max 10 comment likes in 30 seconds
    const burstCheck = await ctx.db
      .query("commentLikes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - COMMENT_LIKE_RATE_LIMITS.BURST_WINDOW))
      .take(COMMENT_LIKE_RATE_LIMITS.BURST_LIMIT + 1);

    if (burstCheck.length >= COMMENT_LIKE_RATE_LIMITS.BURST_LIMIT) {
      throw new Error("Too many comment likes too quickly. Please slow down.");
    }

    // 3. Hourly limit: Max 100 comment likes per hour
    const hourlyCheck = await ctx.db
      .query("commentLikes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - COMMENT_LIKE_RATE_LIMITS.HOURLY_WINDOW))
      .take(COMMENT_LIKE_RATE_LIMITS.HOURLY_LIMIT + 1);

    if (hourlyCheck.length >= COMMENT_LIKE_RATE_LIMITS.HOURLY_LIMIT) {
      throw new Error("Hourly comment like limit reached. Try again later.");
    }

    // All rate limit checks passed - create new like
    await ctx.db.insert("commentLikes", {
      userId,
      commentId: args.commentId,
      likedAt: Date.now(),
    });
    
    return { isLiked: true, action: "liked" };
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
