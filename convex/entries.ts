import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const batchGetEntryData = query({
  args: {
    entryGuids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Get all likes and comments in parallel but within the same query
    const [likes, comments] = await Promise.all([
      // Get all likes for the requested entries
      ctx.db
        .query("likes")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect(),

      // Get all comments for the requested entries
      ctx.db
        .query("comments")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect()
    ]);

    // Process likes data
    const likeCountMap = new Map<string, number>();
    const userLikedSet = new Set<string>();
    
    for (const like of likes) {
      const count = likeCountMap.get(like.entryGuid) || 0;
      likeCountMap.set(like.entryGuid, count + 1);
      
      if (userId && like.userId === userId) {
        userLikedSet.add(like.entryGuid);
      }
    }

    // Process comments data
    const commentCountMap = new Map<string, number>();
    for (const comment of comments) {
      const count = commentCountMap.get(comment.entryGuid) || 0;
      commentCountMap.set(comment.entryGuid, count + 1);
    }

    // Return data for each entry in the same order as input guids
    return args.entryGuids.map(guid => ({
      likes: {
        isLiked: userId ? userLikedSet.has(guid) : false,
        count: likeCountMap.get(guid) || 0
      },
      comments: {
        count: commentCountMap.get(guid) || 0
      }
    }));
  },
});

// Lightweight query for entry metrics (likes, comment count) without full comment data
export const getEntryMetrics = query({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Get likes and comments counts in parallel
    const [likes, comments] = await Promise.all([
      ctx.db
        .query("likes")
        .withIndex("by_entry")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .collect(),
      ctx.db
        .query("comments")
        .withIndex("by_entry")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .collect()
    ]);

    // Check if user has liked
    const isLiked = userId ? likes.some(like => like.userId === userId) : false;

    return {
      likes: {
        count: likes.length,
        isLiked
      },
      comments: {
        count: comments.length
      }
    };
  },
});

// Full entry data query including comments with user data
export const getEntryWithComments = query({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Get all data in parallel
    const [likes, comments] = await Promise.all([
      ctx.db
        .query("likes")
        .withIndex("by_entry")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .collect(),
      ctx.db
        .query("comments")
        .withIndex("by_entry_time")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .order("desc")
        .collect()
    ]);

    if (comments.length === 0) {
      return {
        likes: {
          count: likes.length,
          isLiked: userId ? likes.some(like => like.userId === userId) : false
        },
        comments: {
          count: 0,
          items: []
        }
      };
    }

    // Get all unique user IDs from comments
    const userIds = new Set(comments.map(c => c.userId));
    
    // Fetch all user data in one query
    const users = await ctx.db
      .query("profiles")
      .filter((q) => 
        q.or(
          ...Array.from(userIds).map(id => 
            q.eq(q.field("userId"), id)
          )
        )
      )
      .collect();

    // Create a map for quick user lookup
    const userMap = new Map(users.map(u => [u.userId, u]));

    return {
      likes: {
        count: likes.length,
        isLiked: userId ? likes.some(like => like.userId === userId) : false
      },
      comments: {
        count: comments.length,
        items: comments.map(comment => ({
          ...comment,
          user: userMap.get(comment.userId)
        }))
      }
    };
  },
}); 