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