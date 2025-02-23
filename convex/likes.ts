import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const like = mutation({
  args: {
    entryGuid: v.string(),
    feedUrl: v.string(),
    title: v.string(),
    pubDate: v.string(),
    link: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if already liked
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_entry", (q) =>
        q.eq("userId", userId).eq("entryGuid", args.entryGuid)
      )
      .first();

    if (existing) return existing._id;

    // Create new like
    return await ctx.db.insert("likes", {
      userId,
      entryGuid: args.entryGuid,
      feedUrl: args.feedUrl,
      title: args.title,
      pubDate: args.pubDate,
      link: args.link,
    });
  },
});

export const unlike = mutation({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_entry", (q) =>
        q.eq("userId", userId).eq("entryGuid", args.entryGuid)
      )
      .first();

    if (!existing) return null;

    await ctx.db.delete(existing._id);
    return existing._id;
  },
});

export const isLiked = query({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_entry", (q) =>
        q.eq("userId", userId).eq("entryGuid", args.entryGuid)
      )
      .first();

    return !!existing;
  },
});

export const getLikeCount = query({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    const count = await ctx.db
      .query("likes")
      .withIndex("by_entry", (q) => q.eq("entryGuid", args.entryGuid)) 
      .collect();

    return count.length;
  },
});

export const batchGetLikeCounts = query({
  args: {
    entryGuids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all likes for the requested entries in a single query
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_entry")
      .filter((q) => 
        q.or(
          ...args.entryGuids.map(guid => 
            q.eq(q.field("entryGuid"), guid)
          )
        )
      )
      .collect();

    // Count likes for each entry
    const countMap = new Map<string, number>();
    for (const like of likes) {
      const count = countMap.get(like.entryGuid) || 0;
      countMap.set(like.entryGuid, count + 1);
    }

    // Return counts in the same order as input guids
    return args.entryGuids.map(guid => countMap.get(guid) || 0);
  },
});

export const batchGetIsLiked = query({
  args: {
    entryGuids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return args.entryGuids.map(() => false);

    // Get all likes for this user and these entries using compound index
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user_entry")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), userId),
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
      )
      .collect();

    // Create a Set of liked entry GUIDs for O(1) lookup
    const likedGuids = new Set(likes.map(like => like.entryGuid));

    // Map each requested GUID to whether it exists in the Set
    return args.entryGuids.map(guid => likedGuids.has(guid));
  },
});

export const batchGetLikeData = query({
  args: {
    entryGuids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Get all likes for the requested entries in a single query
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_entry")
      .filter((q) => 
        q.or(
          ...args.entryGuids.map(guid => 
            q.eq(q.field("entryGuid"), guid)
          )
        )
      )
      .collect();

    // Count likes for each entry and track user's likes
    const countMap = new Map<string, number>();
    const userLikedSet = new Set<string>();
    
    for (const like of likes) {
      // Count total likes
      const count = countMap.get(like.entryGuid) || 0;
      countMap.set(like.entryGuid, count + 1);
      
      // Track user's likes if authenticated
      if (userId && like.userId === userId) {
        userLikedSet.add(like.entryGuid);
      }
    }

    // Return combined data in the same order as input guids
    return args.entryGuids.map(guid => ({
      count: countMap.get(guid) || 0,
      isLiked: userId ? userLikedSet.has(guid) : false
    }));
  },
});