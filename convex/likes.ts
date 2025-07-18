import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { actionLimiter } from "./rateLimiters";

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

    // Check rate limits before any database operations
    // 1. Burst limit (5 likes in 30 seconds)
    const burstResult = await actionLimiter.limit(ctx, "likesBurst", { key: userId });
    if (!burstResult.ok) {
      throw new Error("Too many likes too quickly. Please slow down.");
    }

    // 2. Hourly limit (50 likes per hour)
    const hourlyResult = await actionLimiter.limit(ctx, "likesHourly", { key: userId });
    if (!hourlyResult.ok) {
      throw new Error("Hourly like limit reached. Try again later.");
    }

    // 3. Daily limit (200 likes per day)
    const dailyResult = await actionLimiter.limit(ctx, "likesDaily", { key: userId });
    if (!dailyResult.ok) {
      throw new Error("Daily like limit reached. Try again tomorrow.");
    }

    // Check if already liked
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_entry", (q) =>
        q.eq("userId", userId).eq("entryGuid", args.entryGuid)
      )
      .first();

    if (existing) {
      // If already liked, this is an unlike action - delete and return
      await ctx.db.delete(existing._id);
      return { action: "unliked", likeId: existing._id };
    }

    // Create new like
    const likeId = await ctx.db.insert("likes", {
      userId,
      entryGuid: args.entryGuid,
      feedUrl: args.feedUrl,
      title: args.title,
      pubDate: args.pubDate,
      link: args.link,
    });

    return { action: "liked", likeId };
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
    return { action: "unliked", likeId: existing._id };
  },
});
