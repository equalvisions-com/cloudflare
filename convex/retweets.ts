import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { actionLimiter } from "./rateLimiters";

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

    // Check rate limits before any database operations
    // 1. Burst limit (3 retweets in 30 seconds)
    const burstResult = await actionLimiter.limit(ctx, "retweetsBurst", { key: userId });
    if (!burstResult.ok) {
      throw new Error("Too many retweets too quickly. Please slow down.");
    }

    // 2. Hourly limit (25 retweets per hour)
    const hourlyResult = await actionLimiter.limit(ctx, "retweetsHourly", { key: userId });
    if (!hourlyResult.ok) {
      throw new Error("Hourly retweet limit reached. Try again later.");
    }

    // 3. Daily limit (100 retweets per day)
    const dailyResult = await actionLimiter.limit(ctx, "retweetsDaily", { key: userId });
    if (!dailyResult.ok) {
      throw new Error("Daily retweet limit reached. Try again tomorrow.");
    }

    // Check if already retweeted
    const existing = await ctx.db
      .query("retweets")
      .withIndex("by_user_entry", (q) => q.eq("userId", userId).eq("entryGuid", args.entryGuid))
      .unique();

    if (existing) {
      // If already retweeted, this is an unretweet action - delete and return
      await ctx.db.delete(existing._id);
      return { action: "unretweeted", retweetId: existing._id };
    }

    // Create new retweet
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
