import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { actionLimiter } from "./rateLimiters";

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
    
    // Check rate limits before any database operations
    // 1. Burst limit (10 follows in 1 minute)
    const burstResult = await actionLimiter.limit(ctx, "followingBurst", { key: userId });
    if (!burstResult.ok) {
      throw new Error("Too many follows too quickly. Please slow down.");
    }

    // 2. Hourly limit (50 follows per hour)
    const hourlyResult = await actionLimiter.limit(ctx, "followingHourly", { key: userId });
    if (!hourlyResult.ok) {
      throw new Error("Hourly follow limit reached. Try again later.");
    }

    // 3. Daily limit (200 follows per day)
    const dailyResult = await actionLimiter.limit(ctx, "followingDaily", { key: userId });
    if (!dailyResult.ok) {
      throw new Error("Daily follow limit reached. Try again tomorrow.");
    }
    
    // Check if already following
    const existing = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();

    if (existing) {
      return; // Already following
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
    
    // Get following record
    const following = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();

    if (!following) {
      return { success: false, error: "Not following this feed" };
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
    limit: v.optional(v.number()),
    cursor: v.optional(v.id("following")),
  },
  handler: async (ctx, args) => {
    const { postId, limit = 30, cursor } = args;
    
    // Get following records for this post with pagination
    let query = ctx.db
      .query("following")
      .withIndex("by_post", (q) => q.eq("postId", postId));
    
    // Apply cursor if provided
    if (cursor) {
      query = query.filter(q => q.gt(q.field("_id"), cursor));
    }
    
    // Fetch one more than requested to know if there are more
    const followers = await query.take(limit + 1)
      .then(followers => followers.map(follow => ({
        _id: follow._id,
        userId: follow.userId
      })));
    
    // Check if there are more results
    const hasMore = followers.length > limit;
    if (hasMore) {
      followers.pop(); // Remove the extra item
    }
    
    if (followers.length === 0) {
      return {
        followers: [],
        hasMore: false,
        cursor: null,
      };
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
    const validUsers = users
      .filter(Boolean)
      .map(user => ({
        userId: user!._id,
        username: user!.username,
        name: user!.name,
        profileImage: user!.profileImage
      }));
    
    // Get the cursor for the next page (last following record's _id)
    const nextCursor = followers.length > 0 ? followers[followers.length - 1]._id : null;
    
    return {
      followers: validUsers,
      hasMore,
      cursor: nextCursor,
    };
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

    // Check rate limits before any database operations
    // 1. Burst limit (10 follows in 1 minute)
    const burstResult = await actionLimiter.limit(ctx, "followingBurst", { key: userId });
    if (!burstResult.ok) {
      throw new Error("Too many follows too quickly. Please slow down.");
    }

    // 2. Hourly limit (50 follows per hour)
    const hourlyResult = await actionLimiter.limit(ctx, "followingHourly", { key: userId });
    if (!hourlyResult.ok) {
      throw new Error("Hourly follow limit reached. Try again later.");
    }

    // 3. Daily limit (200 follows per day)
    const dailyResult = await actionLimiter.limit(ctx, "followingDaily", { key: userId });
    if (!dailyResult.ok) {
      throw new Error("Daily follow limit reached. Try again tomorrow.");
    }

    // Check if already following
    const existing = await ctx.db
      .query("following")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
      .first();
      
    if (existing) {
      return { success: false, message: "Already following this feed" };
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

/**
 * Optimized query that retrieves a user's following list with current user's follow states.
 * 
 * This combines two operations in a single query to prevent UI flashing:
 * 1. Get posts that the target user is following (with pagination)
 * 2. Get current authenticated user's follow status for those same posts
 * 
 * @param username - Username of the user whose following list to retrieve
 * @param limit - Maximum number of items to return (default: 30)
 * @param cursor - Pagination cursor for loading more items
 * 
 * @returns Object containing:
 * - following: Array of following items with post details
 * - hasMore: Whether there are more items to load
 * - cursor: Pagination cursor for next page
 * - followStates: Map of postId -> boolean indicating current user's follow status
 */
export const getFollowingByUsernameWithFollowStates = query({
  args: { 
    username: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.id("following")),
  },
  handler: async (ctx, args) => {
    const { username, limit = 30, cursor } = args;
    
    // Get target user by username - only get the _id field
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", username))
      .first();
    
    if (!targetUser) {
      throw new Error("User not found");
    }
    
    // Get current authenticated user (for follow states)
    const currentUserId = await getAuthUserId(ctx);
    
    // Get all posts this target user is following using the by_user index
    let query = ctx.db
      .query("following")
      .withIndex("by_user", q => q.eq("userId", targetUser._id));
    
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
    
    // Filter out null values with proper typing
    const results = followingWithDetails.filter((item): item is NonNullable<typeof item> => item !== null);
    
    // Get current user's follow states for these posts in one optimized query
    let followStates: { [key: string]: boolean } = {};
    if (currentUserId && results.length > 0) {
      try {
        const postIds = results.map(item => item.post._id);
        
        // Efficiently get current user's following records for these specific posts
        // Note: We query all user's followings and filter in memory for better performance
        // than multiple individual postId queries
        const currentUserFollowings = await ctx.db
          .query("following")
          .withIndex("by_user", q => q.eq("userId", currentUserId))
          .collect()
          .then(followings => 
            followings.filter(following => 
              postIds.includes(following.postId)
            ).map(following => following.postId.toString())
          );
        
        // Create follow state map - explicitly set all posts to false first
        postIds.forEach(postId => {
          followStates[postId.toString()] = false;
        });
        
        // Then set followed posts to true
        currentUserFollowings.forEach(postId => {
          followStates[postId] = true;
        });
      } catch (error) {
        // If follow state query fails, initialize all as false to prevent UI issues
        console.error("Failed to fetch follow states:", error);
        const postIds = results.map(item => item.post._id);
        postIds.forEach(postId => {
          followStates[postId.toString()] = false;
        });
      }
    }
    
    return {
      following: results,
      hasMore,
      cursor: hasMore ? followings[followings.length - 1]._id : null,
      followStates, // Map of postId -> boolean for current user's follow status
    };
  },
});

/**
 * Lean SSR query that only fetches the following count for initial page render.
 * 
 * This is optimized for SSR where we only need to display the count in the UI.
 * The actual following data and follow states are fetched later when the drawer opens
 * using the optimized getFollowingByUsernameWithFollowStates query.
 * 
 * @param username - Username to get following count for
 * @returns Just the count number, no post data or follow states
 */
export const getFollowingCountForSSR = query({
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
    // This is much faster than fetching all records and getting length
    const count = await ctx.db
      .query("following")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect()
      .then(records => records.length);
      
    return count;
  },
});

/**
 * Optimized query that retrieves followers for a post with current user's friendship states.
 * 
 * This combines two operations in a single query to prevent UI flashing:
 * 1. Get users following the specified post (with pagination)
 * 2. Get current authenticated user's friendship status with those users
 * 
 * @param postId - ID of the post to get followers for
 * @param limit - Maximum number of items to return (default: 30)
 * @param cursor - Pagination cursor for loading more items
 * 
 * @returns Object containing:
 * - followers: Array of follower user data
 * - hasMore: Whether there are more items to load
 * - cursor: Pagination cursor for next page
 * - friendshipStates: Map of userId -> friendship status for current user
 */
export const getFollowersWithFriendshipStates = query({
  args: { 
    postId: v.id("posts"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { postId, limit = 30, cursor } = args;
    
    // Get current authenticated user
    const currentUserId = await getAuthUserId(ctx);
    
    // Build query for followers
    let followersQuery = ctx.db
      .query("following")
      .withIndex("by_post", q => q.eq("postId", postId))
      .order("desc");
    
    // Apply cursor if provided
    if (cursor) {
      followersQuery = followersQuery.filter(q => 
        q.lt(q.field("_id"), cursor)
      );
    }
    
    // Get followers with limit + 1 to check for more
    const followings = await followersQuery
      .take(limit + 1);
    
    const hasMore = followings.length > limit;
    const followingsToProcess = hasMore ? followings.slice(0, limit) : followings;
    
    // Get user details for each follower
    const followersWithDetails = await Promise.all(
      followingsToProcess.map(async (following) => {
        const user = await ctx.db
          .query("users")
          .filter(q => q.eq(q.field("_id"), following.userId))
          .first();
        
        if (!user) {
          return null;
        }
        
        return {
          userId: user._id,
          username: user.username,
          displayName: user.name || user.username,
          profilePicture: user.profileImage,
          verified: false, // Note: verified field doesn't exist in users table, posts have verified field
          followerSince: following._creationTime
        };
      })
    );
    
    // Filter out null values
    const followers = followersWithDetails.filter((item): item is NonNullable<typeof item> => item !== null);
    
    // Get current user's friendship states for these users in one optimized query
    let friendshipStates: { [key: string]: any } = {};
    if (currentUserId && followers.length > 0) {
      try {
        const followerUserIds = followers.map(follower => follower.userId);
        
        // Efficiently get current user's friendships with these specific users
        const friendships = await ctx.db
          .query("friends")
          .withIndex("by_users")
          .filter(q =>
            q.or(
              ...followerUserIds.flatMap(userId => [
                q.and(
                  q.eq(q.field("requesterId"), currentUserId),
                  q.eq(q.field("requesteeId"), userId)
                ),
                q.and(
                  q.eq(q.field("requesterId"), userId),
                  q.eq(q.field("requesteeId"), currentUserId)
                )
              ])
            )
          )
          .collect();
        
        // Create friendship state map - explicitly set all users to null first
        followerUserIds.forEach(userId => {
          const userIdStr = userId.toString();
          
          // Check if viewing own profile
          if (currentUserId.toString() === userIdStr) {
            friendshipStates[userIdStr] = { status: "self" };
            return;
          }
          
          // Find friendship record
          const friendship = friendships.find(f => 
            (f.requesterId.toString() === currentUserId.toString() && f.requesteeId.toString() === userIdStr) ||
            (f.requesterId.toString() === userIdStr && f.requesteeId.toString() === currentUserId.toString())
          );
          
          if (friendship) {
            const isSender = friendship.requesterId.toString() === currentUserId.toString();
            friendshipStates[userIdStr] = {
              exists: true,
              status: friendship.status,
              direction: isSender ? "sent" : "received",
              friendshipId: friendship._id
            };
          } else {
            friendshipStates[userIdStr] = {
              exists: false,
              status: null,
              direction: null,
              friendshipId: null
            };
          }
        });
      } catch (error) {
        // If friendship state query fails, initialize all as null to prevent UI issues
        console.error("Failed to fetch friendship states:", error);
        const followerUserIds = followers.map(follower => follower.userId);
        followerUserIds.forEach(userId => {
          friendshipStates[userId.toString()] = null;
        });
      }
    }
    
    return {
      followers,
      hasMore,
      cursor: hasMore ? followingsToProcess[followingsToProcess.length - 1]._id : null,
      friendshipStates, // Map of userId -> friendship status for current user
    };
  },
});

/**
 * Lean SSR query that only fetches the followers count for initial page render.
 * 
 * This is optimized for SSR where we only need to display the count in the UI.
 * The actual follower data and friendship states are fetched later when the drawer opens
 * using the optimized getFollowersWithFriendshipStates query.
 * 
 * @param postId - Post ID to get followers count for
 * @returns Just the count number, no user data or friendship states
 */
export const getFollowersCountForSSR = query({
  args: { 
    postId: v.id("posts")
  },
  handler: async (ctx, args) => {
    // Count users following this post using the by_post index
    // This is much faster than fetching all records and getting length
    const count = await ctx.db
      .query("following")
      .withIndex("by_post", q => q.eq("postId", args.postId))
      .collect()
      .then(records => records.length);
      
    return count;
  },
});

// Get real-time friendship status updates for a list of user IDs (for followers)
export const getFollowersFriendshipStates = query({
  args: {
    postId: v.id("posts"),
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { postId, userIds } = args;
    
    if (userIds.length === 0) {
      return {};
    }
    
    // Get current authenticated user
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      return {};
    }
    
    // Get current user's friendship states for these users
    const friendships = await ctx.db
      .query("friends")
      .withIndex("by_users")
      .filter(q =>
        q.or(
          ...userIds.flatMap(userId => [
            q.and(
              q.eq(q.field("requesterId"), currentUserId),
              q.eq(q.field("requesteeId"), userId)
            ),
            q.and(
              q.eq(q.field("requesterId"), userId),
              q.eq(q.field("requesteeId"), currentUserId)
            )
          ])
        )
      )
      .collect();
    
    // Create friendship state map
    const friendshipStates: { [key: string]: any } = {};
    userIds.forEach(userId => {
      const userIdStr = userId.toString();
      
      // Check if viewing own profile
      if (currentUserId.toString() === userIdStr) {
        friendshipStates[userIdStr] = { status: "self" };
        return;
      }
      
      // Find friendship record
      const friendship = friendships.find(f => 
        (f.requesterId.toString() === currentUserId.toString() && f.requesteeId.toString() === userIdStr) ||
        (f.requesterId.toString() === userIdStr && f.requesteeId.toString() === currentUserId.toString())
      );
      
      if (friendship) {
        const isSender = friendship.requesterId.toString() === currentUserId.toString();
        friendshipStates[userIdStr] = {
          exists: true,
          status: friendship.status,
          direction: isSender ? "sent" : "received",
          friendshipId: friendship._id
        };
      } else {
        friendshipStates[userIdStr] = {
          exists: false,
          status: null,
          direction: null,
          friendshipId: null
        };
      }
    });
    
    return friendshipStates;
  },
});

