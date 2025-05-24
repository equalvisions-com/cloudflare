import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Rate limiting constants for retweets
const RETWEET_RATE_LIMITS = {
  PER_POST_COOLDOWN: 2000,        // 2 seconds between retweet/unretweet on same post
  BURST_LIMIT: 3,                 // 3 retweets max
  BURST_WINDOW: 30000,            // in 30 seconds
  HOURLY_LIMIT: 25,               // 25 retweets per hour (more restrictive than likes)
  HOURLY_WINDOW: 3600000,         // 1 hour in milliseconds
};

// Retweet an entry
export const retweet = mutation({
  args: {
    entryGuid: v.string(),
    feedUrl: v.string(),
    title: v.string(),
    pubDate: v.string(),
    link: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // 1. Check if already retweeted (per-post cooldown)
    const existing = await ctx.db
      .query("retweets")
      .withIndex("by_user_entry", (q) => q.eq("userId", userId).eq("entryGuid", args.entryGuid))
      .unique();

    if (existing) {
      // Per-post cooldown: 2 seconds between retweet/unretweet on same post
      const timeSinceLastAction = Date.now() - existing._creationTime;
      if (timeSinceLastAction < RETWEET_RATE_LIMITS.PER_POST_COOLDOWN) {
        throw new Error("Please wait before toggling retweet again");
      }
      // If cooldown passed, this is an unretweet action - delete and return
      await ctx.db.delete(existing._id);
      return { action: "unretweeted", retweetId: existing._id };
    }

    // 2. Burst protection: Max 3 retweets in 30 seconds
    const burstCheck = await ctx.db
      .query("retweets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - RETWEET_RATE_LIMITS.BURST_WINDOW))
      .take(RETWEET_RATE_LIMITS.BURST_LIMIT + 1); // Check for limit + 1

    if (burstCheck.length >= RETWEET_RATE_LIMITS.BURST_LIMIT) {
      throw new Error("Too many retweets too quickly. Please slow down.");
    }

    // 3. Hourly limit: Max 25 retweets per hour
    const hourlyCheck = await ctx.db
      .query("retweets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - RETWEET_RATE_LIMITS.HOURLY_WINDOW))
      .take(RETWEET_RATE_LIMITS.HOURLY_LIMIT + 1); // Check for limit + 1

    if (hourlyCheck.length >= RETWEET_RATE_LIMITS.HOURLY_LIMIT) {
      throw new Error("Hourly retweet limit reached. Try again later.");
    }

    // All rate limit checks passed - create new retweet
    const retweetId = await ctx.db.insert("retweets", {
      userId,
      entryGuid: args.entryGuid,
      feedUrl: args.feedUrl,
      title: args.title,
      pubDate: args.pubDate,
      link: args.link,
      retweetedAt: Date.now(),
    });

    return { action: "retweeted", retweetId };
  },
});

// Unretweet an entry
export const unretweet = mutation({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("retweets")
      .withIndex("by_user_entry", (q) => q.eq("userId", userId).eq("entryGuid", args.entryGuid))
      .unique();

    if (!existing) {
      return { success: true, notFound: true };
    }

    // Per-post cooldown: 2 seconds between retweet/unretweet on same post
    const timeSinceLastAction = Date.now() - existing._creationTime;
    if (timeSinceLastAction < RETWEET_RATE_LIMITS.PER_POST_COOLDOWN) {
      throw new Error("Please wait before toggling retweet again");
    }

    await ctx.db.delete(existing._id);
    return { action: "unretweeted", retweetId: existing._id };
  },
});

// Check if user has retweeted an entry and get total retweet count
export const getRetweetStatus = query({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    // Get total retweet count
    const retweets = await ctx.db
      .query("retweets")
      .withIndex("by_entry", (q) => q.eq("entryGuid", args.entryGuid))
      .collect();
    
    const count = retweets.length;
    
    // Check if user has retweeted
    let isRetweeted = false;
    if (userId) {
      const userRetweet = await ctx.db
        .query("retweets")
        .withIndex("by_user_entry", (q) => q.eq("userId", userId).eq("entryGuid", args.entryGuid))
        .unique();
      
      isRetweeted = !!userRetweet;
    }
    
    return {
      isRetweeted,
      count,
    };
  },
});

// Get recent retweets for a user
export const getUserRetweets = query({
  args: {
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId || await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }
    
    const limit = args.limit || 10;
    
    const retweets = await ctx.db
      .query("retweets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit)
      .then(retweets => retweets.map(retweet => ({
        _id: retweet._id,
        _creationTime: retweet._creationTime,
        userId: retweet.userId,
        entryGuid: retweet.entryGuid,
        feedUrl: retweet.feedUrl,
        title: retweet.title,
        pubDate: retweet.pubDate,
        link: retweet.link,
        retweetedAt: retweet.retweetedAt
      })));
    
    return retweets;
  },
});

// Get retweet counts for multiple entries
export const batchGetRetweetCounts = query({
  args: {
    entryGuids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const results: Record<string, { isRetweeted: boolean; count: number }> = {};
    
    // Initialize with default values
    for (const guid of args.entryGuids) {
      results[guid] = { isRetweeted: false, count: 0 };
    }
    
    // Get all retweets for these entries in a single batch query
    const allRetweets = await ctx.db
      .query("retweets")
      .withIndex("by_entry")
      .filter((q) => 
        q.or(
          ...args.entryGuids.map(guid => 
            q.eq(q.field("entryGuid"), guid)
          )
        )
      )
      .collect()
      .then(retweets => retweets.map(retweet => ({
        entryGuid: retweet.entryGuid,
        userId: retweet.userId
      })));
    
    // Count retweets by entryGuid
    for (const retweet of allRetweets) {
      const count = results[retweet.entryGuid].count + 1;
      results[retweet.entryGuid].count = count;
      
      // Check if user has retweeted this entry
      if (userId && retweet.userId === userId) {
        results[retweet.entryGuid].isRetweeted = true;
      }
    }
    
    return results;
  },
});
