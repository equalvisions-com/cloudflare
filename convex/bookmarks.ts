import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { actionLimiter } from "./rateLimiters";

export const bookmark = mutation({
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
    // 1. Burst limit (5 bookmarks in 30 seconds)
    const burstResult = await actionLimiter.limit(ctx, "bookmarksBurst", { key: userId });
    if (!burstResult.ok) {
      throw new Error("Too many bookmarks too quickly. Please slow down.");
    }

    // 2. Hourly limit (50 bookmarks per hour)
    const hourlyResult = await actionLimiter.limit(ctx, "bookmarksHourly", { key: userId });
    if (!hourlyResult.ok) {
      throw new Error("Hourly bookmark limit reached. Try again later.");
    }

    // 3. Daily limit (200 bookmarks per day)
    const dailyResult = await actionLimiter.limit(ctx, "bookmarksDaily", { key: userId });
    if (!dailyResult.ok) {
      throw new Error("Daily bookmark limit reached. Try again tomorrow.");
    }

    // Check if already bookmarked
    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_entry", (q) =>
        q.eq("userId", userId).eq("entryGuid", args.entryGuid)
      )
      .first();

    if (existing) {
      // If already bookmarked, this is an unbookmark action - delete and return
      await ctx.db.delete(existing._id);
      return { action: "unbookmarked", bookmarkId: existing._id };
    }

    // Create new bookmark
    const bookmarkId = await ctx.db.insert("bookmarks", {
      userId,
      entryGuid: args.entryGuid,
      feedUrl: args.feedUrl,
      title: args.title,
      pubDate: args.pubDate,
      link: args.link,
      bookmarkedAt: Date.now(),
    });

    return { action: "bookmarked", bookmarkId };
  },
});

export const removeBookmark = mutation({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_entry", (q) =>
        q.eq("userId", userId).eq("entryGuid", args.entryGuid)
      )
      .first();

    if (!existing) return null;

    await ctx.db.delete(existing._id);
    return { action: "unbookmarked", bookmarkId: existing._id };
  },
});
