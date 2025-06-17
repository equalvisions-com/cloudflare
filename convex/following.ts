import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Rate limiting constants for following
const FOLLOWING_RATE_LIMITS = {
  GLOBAL_COOLDOWN: 2000,          // 2 seconds between ANY follow/unfollow operations (NEW)
  PER_USER_COOLDOWN: 1000,        // 1 second between follow/unfollow same user
  BURST_LIMIT: 10,                // 10 follows max (reduced from 30)
  BURST_WINDOW: 60000,            // in 1 minute (reduced from 30 seconds)
  HOURLY_LIMIT: 50,               // 50 follows per hour (reduced from 100)
  HOURLY_WINDOW: 3600000,         // 1 hour in milliseconds
  DAILY_LIMIT: 200,               // 200 follows per day (reduced from 500)
  DAILY_WINDOW: 86400000,         // 24 hours
};

export const follow = mutation({
  args: {
    postId: v.id("posts"),
    feedUrl: v.string(),
    rssKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { postId, feedUrl, rssKey } = args;
    
    // Get authenticated user
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // 1. GLOBAL COOLDOWN: Check time since last ANY follow/unfollow operation
    const lastGlobalAction = await ctx.db
      .query("following")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (lastGlobalAction) {
      const timeSinceLastGlobalAction = Date.now() - lastGlobalAction._creationTime;
      if (timeSinceLastGlobalAction < FOLLOWING_RATE_LIMITS.GLOBAL_COOLDOWN) {
        throw new Error("Please wait 2 seconds between follow/unfollow operations");
      }
    }
    
    // 2. Check if already following (per-post cooldown)
    const existing = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();

    if (existing) {
      // Per-post cooldown: 1 second between follow/unfollow on same post
      const timeSinceLastAction = Date.now() - existing._creationTime;
      if (timeSinceLastAction < FOLLOWING_RATE_LIMITS.PER_USER_COOLDOWN) {
        throw new Error("Please wait before toggling follow again");
      }
      return; // Already following
    }

    // 2. Burst protection: Max 10 follows in 1 minute
    const burstCheck = await ctx.db
      .query("following")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - FOLLOWING_RATE_LIMITS.BURST_WINDOW))
      .take(FOLLOWING_RATE_LIMITS.BURST_LIMIT + 1);

    if (burstCheck.length >= FOLLOWING_RATE_LIMITS.BURST_LIMIT) {
      throw new Error("Too many follows too quickly. Please slow down.");
    }

    // 3. Hourly limit: Max 50 follows per hour
    const hourlyCheck = await ctx.db
      .query("following")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - FOLLOWING_RATE_LIMITS.HOURLY_WINDOW))
      .take(FOLLOWING_RATE_LIMITS.HOURLY_LIMIT + 1);

    if (hourlyCheck.length >= FOLLOWING_RATE_LIMITS.HOURLY_LIMIT) {
      throw new Error("Hourly follow limit reached. Try again later.");
    }

    // 4. Daily limit: Max 200 follows per day
    const dailyCheck = await ctx.db
      .query("following")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - FOLLOWING_RATE_LIMITS.DAILY_WINDOW))
      .take(FOLLOWING_RATE_LIMITS.DAILY_LIMIT + 1);

    if (dailyCheck.length >= FOLLOWING_RATE_LIMITS.DAILY_LIMIT) {
      throw new Error("Daily follow limit reached. Try again tomorrow.");
    }

    // Get user with only the fields we need
    let user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(user => user ? {
        _id: user._id,
        rssKeys: user.rssKeys || []
      } : null);

    if (!user) {
      throw new Error("User not found");
    } else {
      // Update user with new RSS key
      const currentKeys = user.rssKeys;
      if (!currentKeys.includes(rssKey)) {
        await ctx.db.patch(userId, {
          rssKeys: [...currentKeys, rssKey]
        });
      }
    }

    // All rate limit checks passed - create following record
    await ctx.db.insert("following", {
      userId,
      postId,
      feedUrl,
    });

    return {
      success: true,
      feedUrl,
      action: "followed"
    };
  },
});

export const unfollow = mutation({
  args: {
    postId: v.id("posts"),
    rssKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { postId, rssKey } = args;
    
    // Get authenticated user
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // 1. GLOBAL COOLDOWN: Check time since last ANY follow/unfollow operation
    const lastGlobalAction = await ctx.db
      .query("following")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (lastGlobalAction) {
      const timeSinceLastGlobalAction = Date.now() - lastGlobalAction._creationTime;
      if (timeSinceLastGlobalAction < FOLLOWING_RATE_LIMITS.GLOBAL_COOLDOWN) {
        throw new Error("Please wait 2 seconds between follow/unfollow operations");
      }
    }
    
    // 2. Get following record
    const following = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();

    if (!following) {
      return { success: false, error: "Not following this feed" };
    }

    // 3. Per-post cooldown: 1 second between follow/unfollow on same post
    const timeSinceLastAction = Date.now() - following._creationTime;
    if (timeSinceLastAction < FOLLOWING_RATE_LIMITS.PER_USER_COOLDOWN) {
      throw new Error("Please wait before toggling follow again");
    }

    // Get user with only the fields we need
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(user => user ? {
        _id: user._id,
        rssKeys: user.rssKeys || []
      } : null);
      
    if (user && user.rssKeys.length > 0) {
      await ctx.db.patch(userId, {
        rssKeys: user.rssKeys.filter(key => key !== rssKey)
      });
    }

    // Delete following record
    await ctx.db.delete(following._id);

    return {
      success: true,
      action: "unfollowed"
    };
  },
});

export const isFollowing = query({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const { postId } = args;
    
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const following = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();

    return !!following;
  },
});

export const getFollowers = query({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const { postId } = args;
    
    // Get all following records for this post - only select the userId
    const followers = await ctx.db
      .query("following")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .collect()
      .then(followers => followers.map(follow => ({
        userId: follow.userId
      })));
    
    if (followers.length === 0) {
      return [];
    }

    // Get only the required user fields using filtered queries
    const users = await Promise.all(
      followers.map(follow => 
        ctx.db
          .query("users")
          .filter(q => q.eq(q.field("_id"), follow.userId))
          .first()
          .then(user => user ? {
            _id: user._id,
            username: user.username || user.name || "User",
            name: user.name,
            profileImage: user.profileImage
          } : null)
      )
    );
    
    // Return only valid users with usernames
    return users
      .filter(Boolean)
      .map(user => ({
        userId: user!._id,
        username: user!.username,
        name: user!.name,
        profileImage: user!.profileImage
      }));
  },
});

export const getFollowStates = query({
  args: {
    postIds: v.array(v.id("posts")),
  },
  handler: async (ctx, args) => {
    const { postIds } = args;
    
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return postIds.map(() => false);
    }

    // Get only the postIds from the following records that we need
    // Use batch approach for efficiency
    const followedPostIds = new Set<string>();
    
    // Process in batches to avoid large queries
    const batchSize = 50;
    for (let i = 0; i < postIds.length; i += batchSize) {
      const batchIds = postIds.slice(i, i + batchSize);
      
      const followingBatch = await ctx.db
        .query("following")
        .withIndex("by_user_post")
        .filter(q => 
          q.and(
            q.eq(q.field("userId"), userId),
            q.or(...batchIds.map(postId => q.eq(q.field("postId"), postId)))
          )
        )
        // We only need the postId field, minimize data transfer
        .collect()
        .then(results => results.map(f => f.postId.toString()));
      
      // Add to our set
      followingBatch.forEach(id => followedPostIds.add(id));
    }
    
    // Return a boolean array indicating whether the user follows each post
    return postIds.map(postId => followedPostIds.has(postId.toString()));
  },
});

export const getFollowingCountByUsername = query({
  args: { 
    username: v.string() 
  },
  handler: async (ctx, args) => {
    // Get user by username using the by_username index
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", args.username))
      .first();
    
    if (!user) {
      return 0;
    }
    
    // Count posts this user is following using the by_user index
    const count = await ctx.db
      .query("following")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect();
      
    return count.length;
  },
});

// Get all posts that a user is following by username with pagination
export const getFollowingByUsername = query({
  args: { 
    username: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.id("following")),
  },
  handler: async (ctx, args) => {
    const { username, limit = 30, cursor } = args;
    
    // Get user by username - only get the _id field
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", username))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get all posts this user is following using the by_user index
    let query = ctx.db
      .query("following")
      .withIndex("by_user", q => q.eq("userId", user._id));
    
    // Apply cursor if provided
    if (cursor) {
      query = query.filter(q => q.gt(q.field("_id"), cursor));
    }
    
    // Fetch one more than requested to know if there are more
    const followings = await query.take(limit + 1)
      .then(followings => followings.map(following => ({
        _id: following._id,
        userId: following.userId,
        postId: following.postId,
        feedUrl: following.feedUrl
      })));
    
    // Check if there are more results
    const hasMore = followings.length > limit;
    if (hasMore) {
      followings.pop(); // Remove the extra item
    }
    
    // Get post details for each following - only select required fields
    const followingWithDetails = await Promise.all(
      followings.map(async (following) => {
        const post = await ctx.db
          .query("posts")
          .filter(q => q.eq(q.field("_id"), following.postId))
          .first()
          .then(post => post ? {
            _id: post._id,
            title: post.title,
            postSlug: post.postSlug,
            categorySlug: post.categorySlug,
            featuredImg: post.featuredImg,
            mediaType: post.mediaType,
            verified: post.verified ?? false
          } : null);
        
        if (!post) {
          return null;
        }
        
        return {
          following: {
            _id: following._id,
            userId: following.userId,
            postId: following.postId,
            feedUrl: following.feedUrl
          },
          post
        };
      })
    );
    
    // Filter out null values
    const results = followingWithDetails.filter(Boolean);
    
    return {
      following: results,
      hasMore,
      cursor: hasMore ? followings[followings.length - 1]._id : null
    };
  },
});

export const followFeed = mutation({
  args: {
    feedUrl: v.string(),
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const { feedUrl, postId } = args;
    
    // Get user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // 1. Check if already following (per-post cooldown)
    const existing = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();
      
    if (existing) {
      // Per-post cooldown: 2 seconds between follow/unfollow on same post
      const timeSinceLastAction = Date.now() - existing._creationTime;
      if (timeSinceLastAction < FOLLOWING_RATE_LIMITS.PER_USER_COOLDOWN) {
        throw new Error("Please wait before toggling follow again");
      }
      return { success: false, message: "Already following this feed" };
    }

    // 2. Burst protection: Max 10 follows in 1 minute
    const burstCheck = await ctx.db
      .query("following")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - FOLLOWING_RATE_LIMITS.BURST_WINDOW))
      .take(FOLLOWING_RATE_LIMITS.BURST_LIMIT + 1);

    if (burstCheck.length >= FOLLOWING_RATE_LIMITS.BURST_LIMIT) {
      throw new Error("Too many follows too quickly. Please slow down.");
    }

    // 3. Hourly limit: Max 100 follows per hour
    const hourlyCheck = await ctx.db
      .query("following")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - FOLLOWING_RATE_LIMITS.HOURLY_WINDOW))
      .take(FOLLOWING_RATE_LIMITS.HOURLY_LIMIT + 1);

    if (hourlyCheck.length >= FOLLOWING_RATE_LIMITS.HOURLY_LIMIT) {
      throw new Error("Hourly follow limit reached. Try again later.");
    }

    // 4. Daily limit: Max 500 follows per day
    const dailyCheck = await ctx.db
      .query("following")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - FOLLOWING_RATE_LIMITS.DAILY_WINDOW))
      .take(FOLLOWING_RATE_LIMITS.DAILY_LIMIT + 1);

    if (dailyCheck.length >= FOLLOWING_RATE_LIMITS.DAILY_LIMIT) {
      throw new Error("Daily follow limit reached. Try again tomorrow.");
    }
    
    // Get only required user fields with query filtering rather than full document
    let user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(user => user ? {
        _id: user._id,
        username: user.username
      } : null);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // All rate limit checks passed - add new following entry
    await ctx.db.insert("following", {
      userId,
      postId,
      feedUrl,
    });
    
    return { success: true, action: "followed" };
  },
});
