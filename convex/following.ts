import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const follow = mutation({
  args: { 
    postId: v.id("posts"), 
    feedUrl: v.string(),
    rssKey: v.string()
  },
  handler: async (ctx, { postId, feedUrl, rssKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if already following
    const existing = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();

    if (existing) {
      return; // Already following
    }

    // Get or create user profile
    let profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (!profile) {
      // Create new profile if it doesn't exist
      const profileId = await ctx.db.insert("profiles", {
        userId,
        username: "", // You might want to set this from somewhere
        rssKeys: [rssKey]
      });
      profile = await ctx.db.get(profileId);
    } else {
      // Update existing profile with new RSS key
      const currentKeys = profile.rssKeys || [];
      if (!currentKeys.includes(rssKey)) {
        await ctx.db.patch(profile._id, {
          rssKeys: [...currentKeys, rssKey]
        });
      }
    }

    // Create new following relationship
    await ctx.db.insert("following", {
      userId,
      postId,
      feedUrl,
    });
  },
});

export const unfollow = mutation({
  args: { 
    postId: v.id("posts"),
    rssKey: v.string()
  },
  handler: async (ctx, { postId, rssKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);

      // Remove RSS key from profile
      const profile = await ctx.db
        .query("profiles")
        .filter((q) => q.eq(q.field("userId"), userId))
        .first();

      if (profile && profile.rssKeys) {
        await ctx.db.patch(profile._id, {
          rssKeys: profile.rssKeys.filter((key: string) => key !== rssKey)
        });
      }
    }
  },
});

export const isFollowing = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const following = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();

    return !!following;
  },
}); 