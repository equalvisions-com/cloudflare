import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

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
    
    // Check if already following
    const existing = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();

    if (existing) {
      return; // Already following
    }

    // Get user
    let user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found");
    } else {
      // Update user with new RSS key
      const currentKeys = user.rssKeys || [];
      if (!currentKeys.includes(rssKey)) {
        await ctx.db.patch(userId, {
          rssKeys: [...currentKeys, rssKey]
        });
      }
    }

    // Create following record
    await ctx.db.insert("following", {
      userId,
      postId,
      feedUrl,
    });

    return {
      success: true,
      feedUrl,
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
    
    // Get following record
    const following = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();

    if (!following) {
      return { success: false, error: "Not following this feed" };
    }

    // Remove RSS key from user
    const user = await ctx.db.get(userId);
    if (user && user.rssKeys) {
      await ctx.db.patch(userId, {
        rssKeys: user.rssKeys.filter(key => key !== rssKey)
      });
    }

    // Delete following record
    await ctx.db.delete(following._id);

    return {
      success: true,
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
    
    // Get all following records for this post
    const followers = await ctx.db
      .query("following")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .collect();
    
    if (followers.length === 0) {
      return [];
    }

    // Get user data for all followers
    const users = await Promise.all(
      followers.map(follow => ctx.db.get(follow.userId))
    );
    
    // Return only valid users with usernames
    return users
      .filter(Boolean)
      .map(user => ({
        userId: user!._id,
        username: user!.username || user!.name || "User",
        name: user!.name,
        profileImage: user!.profileImage || user!.image
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

    // Get all following records for this user
    const followings = await ctx.db
      .query("following")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    // Create a Set of post IDs that the user follows for quick lookup
    const followedPostIds = new Set(followings.map(f => f.postId.toString()));
    
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
    
    // Get user by username using the by_username index
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
    const followings = await query.take(limit + 1);
    
    // Check if there are more results
    const hasMore = followings.length > limit;
    if (hasMore) {
      followings.pop(); // Remove the extra item
    }
    
    // Get post details for each following
    const followingWithDetails = await Promise.all(
      followings.map(async (following) => {
        const post = await ctx.db.get(following.postId);
        if (!post) {
          return null;
        }
        
        return {
          following,
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