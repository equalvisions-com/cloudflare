import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { r2 } from "./r2";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      throw new Error("User was deleted");
    }
    return user;
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      userId: user._id,
      username: user.username || "Guest",
      name: user.name,
      bio: user.bio,
      profileImage: user.profileImage || user.image,
      rssKeys: user.rssKeys || [],
      isBoarded: user.isBoarded ?? false
    };
  },
});

export const getUserProfile = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) return null;

    return {
      userId: user._id,
      username: user.username || "Guest",
      name: user.name,
      bio: user.bio,
      profileImage: user.profileImage || user.image,
      rssKeys: user.rssKeys || []
    };
  },
});

export const getProfileByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", args.username))
      .first();
    
    if (!user) return null;

    return {
      userId: user._id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      profileImage: user.profileImage || user.image,
      rssKeys: user.rssKeys || []
    };
  },
});

// Generate a signed URL for uploading a profile image
export const getProfileImageUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated");
    }
    
    // Generate a unique key for the profile image based on the user ID
    const key = `profile-images/${userId}_${Date.now()}`;
    
    try {
      // Generate a signed URL
      const urlResponse = await r2.generateUploadUrl(key);
      
      // Depending on the structure of the response, extract the URL correctly
      let url;
      if (typeof urlResponse === 'string') {
        url = urlResponse;
      } else if (urlResponse && typeof urlResponse === 'object') {
        // Looks like R2 is returning an object, try to get the url from it
        if ('url' in urlResponse) {
          url = (urlResponse as any).url;
        } else {
          // Try stringifying as a last resort
          url = String(urlResponse);
        }
      } else {
        throw new Error("Invalid URL format returned from R2");
      }
      
      return { url, key };
    } catch (error) {
      console.error("Failed to generate upload URL:", error);
      throw new Error("Failed to generate upload URL");
    }
  },
});

export const updateProfile = mutation({
  args: {
    name: v.union(v.string(), v.null()),
    bio: v.union(v.string(), v.null()),
    profileImage: v.union(v.string(), v.null()),
    // New parameter for R2 object key
    profileImageKey: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { name, bio, profileImage, profileImageKey } = args;
    
    // Get the authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated");
    }
    
    // Find the user
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Prepare updates - convert null to undefined for the DB
    const updates: {
      name?: string;
      bio?: string;
      profileImage?: string;
      profileImageKey?: string;
    } = {};
    
    if (name !== null) updates.name = name;
    if (bio !== null) updates.bio = bio;
    
    // Store old key for tracking if we need to clean up
    const oldProfileImageKey = user.profileImageKey;
    const isChangingImage = profileImageKey && oldProfileImageKey && profileImageKey !== oldProfileImageKey;
    
    // Handle both regular profileImage URLs and R2 keys
    if (profileImageKey) {
      // If an R2 key is provided, generate a public URL for it
      try {
        const publicUrl = await r2.getUrl(profileImageKey);
        updates.profileImage = publicUrl;
        updates.profileImageKey = profileImageKey;
      } catch (error) {
        console.error("Failed to get image URL:", error);
        // Still save the key even if we can't get the URL right now
        updates.profileImageKey = profileImageKey;
      }
      
      // If we're changing the R2 image, delete the old one
      if (isChangingImage) {
        // We can't call an action directly from a mutation, so schedule with 0 delay for immediate execution
        ctx.scheduler.runAfter(0, api.r2Cleanup.deleteR2Object, { key: oldProfileImageKey });
        console.log(`🗑️ Scheduled immediate deletion of old profile image: ${oldProfileImageKey}`);
      }
    } else if (profileImage !== null) {
      // If just a regular URL is provided (legacy or external)
      updates.profileImage = profileImage;
      
      // If we're changing from R2 to external URL, remove the key and delete the old image
      if (oldProfileImageKey) {
        updates.profileImageKey = undefined;
        // We can't call an action directly from a mutation, so schedule with 0 delay for immediate execution
        ctx.scheduler.runAfter(0, api.r2Cleanup.deleteR2Object, { key: oldProfileImageKey });
        console.log(`🗑️ Scheduled immediate deletion of old profile image: ${oldProfileImageKey}`);
      }
    }
    
    // Update the user
    await ctx.db.patch(userId, updates);
    
    return userId;
  },
});

// Helper action to get a direct URL for an R2 stored profile image
export const getProfileImageUrl = action({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    return r2.getUrl(args.key);
  },
});

// Helper functions for the batch queries
async function getFriendsWithProfiles(
  ctx: any, 
  userId: Id<"users">, 
  limit: number
) {
  // Get friends relationships
  const friendships = await ctx.db
    .query("friends")
    .withIndex("by_users")
    .filter((q: any) => 
      q.or(
        q.and(
          q.eq(q.field("requesterId"), userId),
          q.eq(q.field("status"), "accepted")
        ),
        q.and(
          q.eq(q.field("requesteeId"), userId),
          q.eq(q.field("status"), "accepted")
        )
      )
    )
    .order("desc")
    .take(limit + 1); // Take one extra to check if there are more

  // Determine if there are more results
  const hasMore = friendships.length > limit;
  const cursor = hasMore ? friendships[limit - 1]._id : null;
  const items = hasMore ? friendships.slice(0, limit) : friendships;

  // Get profile data for each friend
  const friendItems = await Promise.all(
    items.map(async (friendship: any) => {
      try {
        // Safely determine the friend's userId (the one that's not the current user)
        // Use string comparison instead of equals() method which might not exist
        const isSender = friendship.requesterId && friendship.requesterId.toString() === userId.toString();
        const friendId = isSender ? friendship.requesteeId : friendship.requesterId;

        if (!friendId) {
          console.error("Invalid friendship record missing IDs:", friendship);
          return null;
        }

        // Get friend's user data
        const user = await ctx.db.get(friendId);
        if (!user) return null;

        // Format as profile data
        const profile = {
          userId: user._id,
          username: user.username || "Guest",
          name: user.name,
          profileImage: user.profileImage || user.image,
        };

        return {
          friendship: {
            ...friendship,
            direction: isSender ? "sent" : "received",
            friendId,
          },
          profile,
        };
      } catch (error) {
        console.error("Error processing friendship:", error, friendship);
        return null;
      }
    })
  );

  // Filter out null values and return
  return {
    items: friendItems.filter(Boolean),
    hasMore,
    cursor
  };
}

export const getProfilePageData = query({
  args: { 
    username: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { username, limit = 10 } = args;

    // Get current authenticated user (optional)
    let currentUserId = null;
    try {
      currentUserId = await getAuthUserId(ctx);
    } catch (e) {
      // Not authenticated, continue as guest
    }

    // Get the user's profile by username
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", username))
      .first();

    if (!user) {
      return null;
    }

    // Format as profile
    const profile = {
      userId: user._id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      profileImage: user.profileImage || user.image
    };

    // Get friendship status if authenticated
    let friendshipStatus = null;
    if (currentUserId) {
      // Skip checking if viewing own profile
      if (currentUserId.toString() !== user._id.toString()) {
        const friendship = await ctx.db
          .query("friends")
          .withIndex("by_users")
          .filter(q =>
            q.or(
              q.and(
                q.eq(q.field("requesterId"), currentUserId),
                q.eq(q.field("requesteeId"), user._id)
              ),
              q.and(
                q.eq(q.field("requesterId"), user._id),
                q.eq(q.field("requesteeId"), currentUserId)
              )
            )
          )
          .first();

        if (friendship) {
          const isSender = friendship.requesterId.toString() === currentUserId.toString();
          friendshipStatus = {
            status: friendship.status,
            direction: isSender ? "sent" : "received",
            id: friendship._id
          };
        }
      } else {
        // Viewing own profile
        friendshipStatus = { status: "self" };
      }
    }

    // Get friends with profiles
    const friendsWithProfiles = await getFriendsWithProfiles(ctx, user._id, limit);

    // Get following count
    const followingRecords = await ctx.db
      .query("following")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect();
    
    const followingCount = followingRecords.length;

    // Get following data (limited)
    const following = await ctx.db
      .query("following")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    // Get post data for followed feeds
    const postIds = following.map(f => f.postId);
    const posts = postIds.length > 0 
      ? await Promise.all(postIds.map(id => ctx.db.get(id)))
      : [];

    // Filter out any null posts and format following data
    const followingData = following
      .map((follow, i) => {
        const post = posts[i];
        return post ? {
          _id: follow._id,
          feedUrl: follow.feedUrl,
          post: {
            title: post.title,
            featuredImg: post.featuredImg,
            categorySlug: post.categorySlug,
            postSlug: post.postSlug,
            mediaType: post.mediaType
          }
        } : null;
      })
      .filter(Boolean);

    // Return complete profile page data
    return {
      profile,
      friendshipStatus,
      social: {
        friendCount: friendsWithProfiles.items.length,
        followingCount,
        friends: friendsWithProfiles.items,
        following: followingData
      }
    };
  }
});

export const getProfileActivityData = query({
  args: { 
    userId: v.id("users"),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { userId, limit = 30 } = args;
    
    // Get user to verify existence
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    
    // Get the last 30 activities (comments, retweets)
    // Note: We're not including likes in the general activity feed
    const [comments, retweets] = await Promise.all([
      ctx.db
        .query("comments")
        .withIndex("by_user", q => q.eq("userId", userId))
        .order("desc")
        .take(limit),
      ctx.db
        .query("retweets")
        .withIndex("by_user", q => q.eq("userId", userId))
        .order("desc")
        .take(limit)
    ]);
    
    // Convert to unified activity items
    // We're not including likes in the activity feed
    const commentActivities = comments.map(comment => ({
      type: "comment" as const,
      timestamp: comment.createdAt,
      entryGuid: comment.entryGuid,
      feedUrl: comment.feedUrl,
      content: comment.content,
      _id: comment._id.toString()
    }));
    
    const retweetActivities = retweets.map(retweet => ({
      type: "retweet" as const,
      timestamp: retweet.retweetedAt,
      entryGuid: retweet.entryGuid,
      feedUrl: retweet.feedUrl,
      title: retweet.title,
      link: retweet.link,
      pubDate: retweet.pubDate,
      _id: retweet._id.toString()
    }));
    
    // Combine and sort by timestamp (newest first)
    const allActivities = [
      ...commentActivities,
      ...retweetActivities
    ].sort((a, b) => b.timestamp - a.timestamp);
    
    // Take only limit items
    const activities = allActivities.slice(0, limit);
    
    // Get all unique entryGuids from the activities
    const entryGuids = [
      ...new Set(activities.map(activity => activity.entryGuid))
    ];
    
    // Get entry metrics for all guids
    const entryMetricsPromises = entryGuids.map(guid => 
      Promise.all([
        ctx.db.query("likes")
          .withIndex("by_entry", q => q.eq("entryGuid", guid))
          .collect()
          .then(likes => likes.length),
        ctx.db.query("comments")
          .withIndex("by_entry", q => q.eq("entryGuid", guid))
          .collect()
          .then(comments => comments.length),
        ctx.db.query("retweets")
          .withIndex("by_entry", q => q.eq("entryGuid", guid))
          .collect()
          .then(retweets => retweets.length)
      ]).then(([likeCount, commentCount, retweetCount]) => ({
        guid,
        likeCount,
        commentCount,
        retweetCount
      }))
    );
    
    // Collect all entry metrics into an object keyed by guid
    const entryMetricsArray = await Promise.all(entryMetricsPromises);
    const entryMetrics = Object.fromEntries(
      entryMetricsArray.map(metrics => [metrics.guid, metrics])
    );
    
    // Get detailed post information for all feedUrls
    const feedUrls = [
      ...new Set(activities.map(activity => activity.feedUrl))
    ];
    
    const postsPromises = feedUrls.map(feedUrl => 
      ctx.db.query("posts")
        .withIndex("by_feedUrl", q => q.eq("feedUrl", feedUrl))
        .first()
    );
    
    const posts = (await Promise.all(postsPromises)).filter(Boolean);
    
    // Create a mapping of entry guids to post details
    const entryDetails: Record<string, {
      post_title: string;
      post_featured_img: string;
      post_media_type: string;
      category_slug: string;
      post_slug: string;
    }> = {};
    for (const activity of activities) {
      const post = posts.find(p => p?.feedUrl === activity.feedUrl);
      if (post) {
        entryDetails[activity.entryGuid] = {
          post_title: post.title,
          post_featured_img: post.featuredImg,
          post_media_type: post.mediaType,
          category_slug: post.categorySlug,
          post_slug: post.postSlug
        };
      }
    }
    
    return {
      activities: {
        activities,
        totalCount: allActivities.length,
        hasMore: allActivities.length > limit
      },
      entryMetrics,
      entryDetails
    };
  }
});

export const getProfileLikesData = query({
  args: { 
    userId: v.id("users"),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { userId, limit = 30 } = args;
    
    // Get user to verify existence
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    
    // Get the user's likes
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    
    // Convert to activity items
    const activities = likes.map(like => ({
      type: "like" as const,
      timestamp: like._creationTime,
      entryGuid: like.entryGuid,
      feedUrl: like.feedUrl,
      title: like.title,
      link: like.link,
      pubDate: like.pubDate,
      _id: like._id.toString()
    }));
    
    // Get all unique entryGuids from the activities
    const entryGuids = [
      ...new Set(activities.map(activity => activity.entryGuid))
    ];
    
    // Get entry metrics for all guids
    const entryMetricsPromises = entryGuids.map(guid => 
      Promise.all([
        ctx.db.query("likes")
          .withIndex("by_entry", q => q.eq("entryGuid", guid))
          .collect()
          .then(likes => likes.length),
        ctx.db.query("comments")
          .withIndex("by_entry", q => q.eq("entryGuid", guid))
          .collect()
          .then(comments => comments.length),
        ctx.db.query("retweets")
          .withIndex("by_entry", q => q.eq("entryGuid", guid))
          .collect()
          .then(retweets => retweets.length)
      ]).then(([likeCount, commentCount, retweetCount]) => ({
        guid,
        likeCount,
        commentCount,
        retweetCount
      }))
    );
    
    // Collect all entry metrics into an object keyed by guid
    const entryMetricsArray = await Promise.all(entryMetricsPromises);
    const entryMetrics = Object.fromEntries(
      entryMetricsArray.map(metrics => [metrics.guid, metrics])
    );
    
    // Get detailed post information for all feedUrls
    const feedUrls = [
      ...new Set(activities.map(activity => activity.feedUrl))
    ];
    
    const postsPromises = feedUrls.map(feedUrl => 
      ctx.db.query("posts")
        .withIndex("by_feedUrl", q => q.eq("feedUrl", feedUrl))
        .first()
    );
    
    const posts = (await Promise.all(postsPromises)).filter(Boolean);
    
    // Create a mapping of entry guids to post details
    const entryDetails: Record<string, {
      post_title: string;
      post_featured_img: string;
      post_media_type: string;
      category_slug: string;
      post_slug: string;
    }> = {};
    for (const activity of activities) {
      const post = posts.find(p => p?.feedUrl === activity.feedUrl);
      if (post) {
        entryDetails[activity.entryGuid] = {
          post_title: post.title,
          post_featured_img: post.featuredImg,
          post_media_type: post.mediaType,
          category_slug: post.categorySlug,
          post_slug: post.postSlug
        };
      }
    }
    
    return {
      activities: {
        activities,
        totalCount: likes.length,
        hasMore: likes.length >= limit
      },
      entryMetrics,
      entryDetails
    };
  }
});

export const completeOnboarding = mutation({
  args: {
    username: v.string(),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { username, bio } = args;
    
    // Get the authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated");
    }
    
    // Find the user
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Check if the username is already taken (if it's different from current user's)
    if (user.username !== username) {
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_username", q => q.eq("username", username))
        .first();
      
      if (existingUser) {
        throw new Error("Username already taken");
      }
    }
    
    // Prepare updates
    const updates: {
      username: string;
      bio?: string;
      isBoarded: boolean;
    } = {
      username,
      isBoarded: true
    };
    
    if (bio) {
      updates.bio = bio;
    }
    
    // Update the user
    await ctx.db.patch(userId, updates);
    
    return { success: true };
  },
});

