import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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

    // Check if already bookmarked
    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_entry", (q) =>
        q.eq("userId", userId).eq("entryGuid", args.entryGuid)
      )
      .first();

    if (existing) return existing._id;

    // Create new bookmark
    return await ctx.db.insert("bookmarks", {
      userId,
      entryGuid: args.entryGuid,
      feedUrl: args.feedUrl,
      title: args.title,
      pubDate: args.pubDate,
      link: args.link,
      bookmarkedAt: Date.now(),
    });
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
    return existing._id;
  },
}); 