import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Rate limiting constants
const RATE_LIMITS = {
  PER_POST_COOLDOWN: 1000,        // 1 second between like/unlike on same post
  BURST_LIMIT: 5,                 // 5 likes max
  BURST_WINDOW: 30000,            // in 30 seconds
  HOURLY_LIMIT: 50,               // 50 likes per hour
  HOURLY_WINDOW: 3600000,         // 1 hour in milliseconds
};

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

    // 1. Check if already liked (per-post cooldown)
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_entry", (q) =>
        q.eq("userId", userId).eq("entryGuid", args.entryGuid)
      )
      .first();

    if (existing) {
      // Per-post cooldown: 1 second between like/unlike on same post
      const timeSinceLastAction = Date.now() - existing._creationTime;
      if (timeSinceLastAction < RATE_LIMITS.PER_POST_COOLDOWN) {
        throw new Error("Please wait before toggling again");
      }
      // If cooldown passed, this is an unlike action - delete and return
      await ctx.db.delete(existing._id);
      return { action: "unliked", likeId: existing._id };
    }

    // 2. Burst protection: Max 5 likes in 30 seconds
    const burstCheck = await ctx.db
      .query("likes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - RATE_LIMITS.BURST_WINDOW))
      .take(RATE_LIMITS.BURST_LIMIT + 1); // Check for limit + 1

    if (burstCheck.length >= RATE_LIMITS.BURST_LIMIT) {
      throw new Error("Too many likes too quickly. Please slow down.");
    }

    // 3. Hourly limit: Max 50 likes per hour
    const hourlyCheck = await ctx.db
      .query("likes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - RATE_LIMITS.HOURLY_WINDOW))
      .take(RATE_LIMITS.HOURLY_LIMIT + 1); // Check for limit + 1

    if (hourlyCheck.length >= RATE_LIMITS.HOURLY_LIMIT) {
      throw new Error("Hourly like limit reached. Try again later.");
    }

    // All rate limit checks passed - create new like
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

    // Per-post cooldown: 1 second between like/unlike on same post
    const timeSinceLastAction = Date.now() - existing._creationTime;
    if (timeSinceLastAction < RATE_LIMITS.PER_POST_COOLDOWN) {
      throw new Error("Please wait before toggling again");
    }

    await ctx.db.delete(existing._id);
    return { action: "unliked", likeId: existing._id };
  },
});
