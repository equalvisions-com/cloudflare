import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { r2 } from "./r2";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { actionLimiter } from "./rateLimiters";

/** How many profile updates a user may make per day. */
const DAILY_PROFILE_LIMIT = 3;

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    
    const userData = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first();
      
    if (!userData) {
      throw new Error("User was deleted");
    }
    
    // Return only essential fields needed for authentication
    return {
      _id: userData._id,
      _creationTime: userData._creationTime,
      username: userData.username,
      name: userData.name,
      email: userData.email,
      isAnonymous: userData.isAnonymous,
      isBoarded: userData.isBoarded ?? false,
      profileImage: userData.profileImage
    };
  },
});

// New optimized version that only selects needed fields
export const viewerOptimized = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    
    // Use query with field filtering instead of get()
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(user => user ? {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        isAnonymous: user.isAnonymous,
        isBoarded: user.isBoarded
      } : null);
    
    if (!user) {
      throw new Error("User was deleted");
    }
    
    // Return only the fields we need
    return user;
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(user => user ? {
        userId: user._id,
        username: user.username || "Guest",
        name: user.name,
        bio: user.bio,
        profileImage: user.profileImage,
        profileImageKey: user.profileImageKey,
        rssKeys: user.rssKeys || [],
        isBoarded: user.isBoarded ?? false
      } : null);

    return user;
  },
});

export const getUserProfile = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), args.id))
      .first()
      .then(user => user ? {
        userId: user._id,
        username: user.username || "Guest",
        name: user.name,
        bio: user.bio,
        profileImage: user.profileImage,
        rssKeys: user.rssKeys || []
      } : null);

    return user;
  },
});

export const getProfileByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", args.username.toLowerCase()))
      .first();
    
    if (!user) return null;

    // Return only the specific fields needed for profile display
    return {
      userId: user._id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      profileImage: user.profileImage,
      rssKeys: user.rssKeys || []
    };
  },
});

// Optimized version that implements field selection pattern
export const getUserByUsernameOptimized = query({
  args: { 
    username: v.string(),
    // Allow callers to specify exactly which fields they need
    fields: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const { username, fields = ["_id", "username", "name", "bio", "profileImage"] } = args;
    
    // First get the base user document - but only retrieve it once
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", username.toLowerCase()))
      .first();
    
    if (!user) return null;
    
    // Create a result object with only the requested fields
    const result: Record<string, any> = {
      userId: user._id, // Always include the ID for reference
    };
    
    // Only include fields that were requested
    fields.forEach(field => {
      if (field in user) {
        // Handle standard fields
        result[field] = user[field as keyof typeof user];
      } else if (field === "rssKeys" && !user.rssKeys) {
        // Handle optional arrays with defaults
        result.rssKeys = [];
      }
    });
    
    return result;
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
    profileImage: v.union(v.string(), v.null()), // This arg is effectively ignored now for setting image, but kept for schema compatibility if other parts of system use it.
    profileImageKey: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated");
    }

    // Check rate limit - consume one token from the user's daily bucket for profile updates
    const limitResult = await actionLimiter.limit(ctx, "profileUpdate", { 
      key: userId,
    });
    if (!limitResult.ok) {
      throw new Error(`Profile update limit exceeded. You can only update your profile ${DAILY_PROFILE_LIMIT} times per day. Try again in ${Math.ceil(limitResult.retryAfter / (1000 * 60))} minutes.`);
    }

    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(u => u ? {
        _id: u._id,
        profileImageKey: u.profileImageKey
      } : null);
      
    if (!user) {
      throw new Error("User not found");
    }
    
    const updates: {
      name?: string;
      bio?: string;
      profileImage?: string;
      profileImageKey?: string;
    } = {};
    
    // --- Name and Bio Validation and Processing (as before) ---
    const MAX_NAME_LENGTH = 60;
    const MAX_BIO_LENGTH = 250;

    let processedName = args.name === null ? undefined : args.name?.trim();
    if (processedName === "") { 
      processedName = undefined;
    } else if (processedName && processedName.length > MAX_NAME_LENGTH) {
      throw new Error(`Display name cannot exceed ${MAX_NAME_LENGTH} characters.`);
    }
    updates.name = processedName;

    let processedBio = args.bio === null ? undefined : args.bio?.trim();
    if (processedBio === "") { 
      processedBio = undefined;
    } else if (processedBio && processedBio.length > MAX_BIO_LENGTH) {
      throw new Error(`Bio cannot exceed ${MAX_BIO_LENGTH} characters.`);
    }
    updates.bio = processedBio;
    // --- End Name and Bio Validation ---
    
    const oldProfileImageKey = user.profileImageKey;

    // --- Refined Image Handling ---
    if (typeof args.profileImageKey === 'string' && args.profileImageKey.length > 0) {
      // A new or existing key is provided
      updates.profileImageKey = args.profileImageKey;
      try {
        const publicUrl = await r2.getUrl(args.profileImageKey);
        updates.profileImage = publicUrl;
      } catch (error) {
        console.error(`Failed to get R2 URL for key ${args.profileImageKey}:`, error);
        updates.profileImage = undefined; // Or a fallback/default image URL if you have one
      }

      // If the key has changed and there was an old key, schedule deletion of the old one.
      if (oldProfileImageKey && oldProfileImageKey !== args.profileImageKey) {
        ctx.scheduler.runAfter(0, api.r2Cleanup.deleteR2Object, { key: oldProfileImageKey });
        console.log(`🗑️ Scheduled immediate deletion of old profile image: ${oldProfileImageKey}`);
      }
    } else if (args.profileImageKey === null) {
      // Explicitly removing the image (client sent profileImageKey: null)
      updates.profileImageKey = undefined; // This will remove the key from the database document
      updates.profileImage = undefined;    // This will remove the image URL from the database document
      if (oldProfileImageKey) {
        ctx.scheduler.runAfter(0, api.r2Cleanup.deleteR2Object, { key: oldProfileImageKey });
        console.log(`🗑️ Scheduled immediate deletion of current profile image: ${oldProfileImageKey}`);
      }
    }
    // If args.profileImageKey is undefined (not provided in the arguments at all),
    // then neither of the above blocks are entered for image fields.
    // The existing profileImage and profileImageKey in the database will remain unchanged.
    // This is the correct behavior for an optional field that isn't being explicitly updated or nulled.
    // --- End Refined Image Handling ---
    
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(userId, updates);
    }
    
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
// Note: getFriendsWithProfiles helper removed as it's no longer used in optimized SSR

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

    // Format as profile - only extract the specific fields we need
    const profile = {
      _id: user._id,
      userId: user._id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      profileImage: user.profileImage
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
          // Only extract needed fields for friendship status
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

    // Get friends count only - no need for profile data in SSR
    // The drawer will fetch actual friends data when opened using the optimized query
    const friendsCount = await ctx.db
      .query("friends")
      .withIndex("by_users")
      .filter(q =>
        q.and(
          q.or(
            q.eq(q.field("requesterId"), user._id),
            q.eq(q.field("requesteeId"), user._id)
          ),
          q.eq(q.field("status"), "accepted")
        )
      )
      .collect()
      .then(records => records.length);

    // Get following count only - no need for post data in SSR
    // The drawer will fetch actual following data when opened using the optimized query
    const followingCount = await ctx.db
      .query("following")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect()
      .then(records => records.length);

    // Return complete profile page data
    return {
      profile,
      friendshipStatus,
      social: {
        friendCount: friendsCount,
        followingCount,
        friends: [], // Empty array - actual friends data fetched by drawer when opened
        following: [] // Empty array - actual following data fetched by drawer when opened
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
    
    // Get user to verify existence - just check existence without fetching full document
    const userExists = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(Boolean);
    
    if (!userExists) throw new Error("User not found");
    
    // Get the last 30 activities (comments, retweets only)
    // We've removed likes completely from the activity feed
    // Only select the specific fields we need for comments
    const [comments, retweets] = await Promise.all([
      ctx.db
        .query("comments")
        .withIndex("by_user", q => q.eq("userId", userId))
        .filter(q => q.eq(q.field("parentId"), undefined)) // Only fetch top-level comments
        .order("desc")
        .take(limit)
        .then(results => results.map(comment => ({
          _id: comment._id,
          createdAt: comment.createdAt,
          entryGuid: comment.entryGuid,
          feedUrl: comment.feedUrl,
          content: comment.content
        }))),
      ctx.db
        .query("retweets")
        .withIndex("by_user", q => q.eq("userId", userId))
        .order("desc")
        .take(limit)
        .then(results => results.map(retweet => ({
          _id: retweet._id,
          retweetedAt: retweet.retweetedAt,
          entryGuid: retweet.entryGuid,
          feedUrl: retweet.feedUrl,
          title: retweet.title,
          link: retweet.link,
          pubDate: retweet.pubDate
        })))
    ]);

    // Fetch comment replies for all top-level comments to eliminate individual queries
    const commentReplies = comments.length > 0 ? await Promise.all(
      comments.map(async comment => {
        const replies = await ctx.db
          .query("comments")
          .withIndex("by_parent")
          .filter(q => q.eq(q.field("parentId"), comment._id))
          .order("asc") // Oldest first for replies
          .collect()
          .then(replies => replies.map(reply => ({
            _id: reply._id,
            _creationTime: reply._creationTime,
            userId: reply.userId,
            feedUrl: reply.feedUrl,
            parentId: reply.parentId,
            content: reply.content,
            createdAt: reply.createdAt,
            username: reply.username,
            entryGuid: reply.entryGuid
          })));

        // Get user data for replies if any exist
        if (replies.length === 0) {
          return { commentId: comment._id, replies: [] };
        }

        const userIds = [...new Set(replies.map(r => r.userId))];
        const users = await Promise.all(
          userIds.map(id => 
            ctx.db
              .query("users")
              .filter(q => q.eq(q.field("_id"), id))
              .first()
              .then(user => user ? {
                _id: user._id,
                username: user.username || user.name || "Guest",
                name: user.name,
                profileImage: user.profileImage
              } : null)
          )
        );

        // Create user map and attach user data to replies
        const userMap = new Map();
        users.filter(Boolean).forEach(user => {
          if (user) {
            userMap.set(user._id.toString(), {
              userId: user._id,
              username: user.username,
              name: user.name,
              profileImage: user.profileImage
            });
          }
        });

        const repliesWithUserData = replies.map(reply => ({
          ...reply,
          user: userMap.get(reply.userId.toString()) || null
        }));

        return { commentId: comment._id, replies: repliesWithUserData };
      })
    ) : [];

    // Create a map of comment ID to replies for easy lookup
    const commentRepliesMap = Object.fromEntries(
      commentReplies.map(cr => [cr.commentId.toString(), cr.replies])
    );
    
    // Convert to unified activity items - already optimized from previous step
    const commentActivities = comments.map(comment => ({
      type: "comment" as const,
      timestamp: comment.createdAt,
      entryGuid: comment.entryGuid,
      feedUrl: comment.feedUrl,
      content: comment.content,
      _id: comment._id.toString(),
      replies: commentRepliesMap[comment._id.toString()] || [] // Include replies in activity data
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
    const entryGuids = [...new Set(activities.map(activity => activity.entryGuid))];
    
    // Get only the unique feedUrls we need
    const feedUrls = [...new Set(activities.map(activity => activity.feedUrl))];
    
    // REMOVED: Duplicate metrics fetching - let server components handle this via batchGetEntriesMetrics
    // This eliminates duplicate queries for likes, comments, and retweets data
    
    // Get post data with only the fields we need
    const postsPromises = feedUrls.map(feedUrl => 
      ctx.db.query("posts")
        .withIndex("by_feedUrl", q => q.eq("feedUrl", feedUrl))
        .first()
        .then(post => post ? {
          feedUrl: post.feedUrl,
          title: post.title,
          featuredImg: post.featuredImg,
          mediaType: post.mediaType, 
          categorySlug: post.categorySlug,
          postSlug: post.postSlug,
          verified: post.verified ?? false
        } : null)
    );
    
    // Get posts data only (metrics handled by server components)
    const postsArray = await Promise.all(postsPromises);
    
    // Filter null posts and create a map for fast lookup
    const postsMap = new Map();
    postsArray.filter(Boolean).forEach(post => {
      if (post && post.feedUrl) {
        postsMap.set(post.feedUrl, post);
      }
    });
    
    // Create a mapping of entry guids to post details
    const entryDetails: Record<string, {
      post_title: string;
      post_featured_img: string;
      post_media_type: string;
      category_slug: string;
      post_slug: string;
      verified?: boolean;
    }> = {};
    
    // Use the map for faster lookups instead of find() operation
    for (const activity of activities) {
      const post = postsMap.get(activity.feedUrl);
      if (post) {
        entryDetails[activity.entryGuid] = {
          post_title: post.title,
          post_featured_img: post.featuredImg,
          post_media_type: post.mediaType,
          category_slug: post.categorySlug,
          post_slug: post.postSlug,
          verified: post.verified
        };
      }
    }
    
    // Get comment like statuses for all comments and replies
    const allCommentIds = [
      // Top-level comments
      ...comments.map(comment => comment._id),
      // All replies
      ...Object.values(commentRepliesMap).flat().map((reply: any) => reply._id)
    ].filter(Boolean);
    


    return {
      activities: {
        activities,
        totalCount: allActivities.length,
        hasMore: allActivities.length > limit
      },
      entryDetails,
      commentReplies: commentRepliesMap // Include comment replies in the response
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
    
    // Get user to verify existence - just check existence without fetching full document
    const userExists = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(Boolean);
    
    if (!userExists) throw new Error("User not found");
    
    // Get the user's likes - only select fields we need
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .take(limit)
      .then(results => results.map(like => ({
        _id: like._id,
        _creationTime: like._creationTime,
        entryGuid: like.entryGuid,
        feedUrl: like.feedUrl,
        title: like.title,
        link: like.link,
        pubDate: like.pubDate
      })));
    
    // Convert to activity items - already optimized from previous step
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
    
    // Get all unique entryGuids and feedUrls
    const entryGuids = [...new Set(activities.map(activity => activity.entryGuid))];
    const feedUrls = [...new Set(activities.map(activity => activity.feedUrl))];
    
    // REMOVED: Duplicate metrics fetching - let server components handle this via batchGetEntriesMetrics
    // This eliminates duplicate queries for likes, comments, and retweets data
    
    // Get post data with only the fields we need
    const postsPromises = feedUrls.map(feedUrl => 
      ctx.db.query("posts")
        .withIndex("by_feedUrl", q => q.eq("feedUrl", feedUrl))
        .first()
        .then(post => post ? {
          feedUrl: post.feedUrl,
          title: post.title,
          featuredImg: post.featuredImg,
          mediaType: post.mediaType, 
          categorySlug: post.categorySlug,
          postSlug: post.postSlug,
          verified: post.verified ?? false
        } : null)
    );
    
    // Get posts data only (metrics handled by server components)
    const postsArray = await Promise.all(postsPromises);
    
    // Filter null posts and create a map for fast lookup
    const postsMap = new Map();
    postsArray.filter(Boolean).forEach((post: any) => {
      if (post && post.feedUrl) {
        postsMap.set(post.feedUrl, post);
      }
    });
    
    // Create a mapping of entry guids to post details
    const entryDetails: Record<string, {
      post_title: string;
      post_featured_img: string;
      post_media_type: string;
      category_slug: string;
      post_slug: string;
      verified?: boolean;
    }> = {};
    
    // Use the map for faster lookups instead of find() operation
    for (const activity of activities) {
      const post = postsMap.get(activity.feedUrl);
      if (post) {
        entryDetails[activity.entryGuid] = {
          post_title: post.title,
          post_featured_img: post.featuredImg,
          post_media_type: post.mediaType,
          category_slug: post.categorySlug,
          post_slug: post.postSlug,
          verified: post.verified
        };
      }
    }
    
    return {
      activities: {
        activities,
        totalCount: likes.length,
        hasMore: likes.length >= limit
      },
      entryDetails
    };
  }
});

export const checkUsernameAvailability = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const usernameToCheck = args.username.trim();
    if (!usernameToCheck) {
      return { available: false, message: "Username cannot be empty" };
    }
    if (usernameToCheck.length < 3) {
      return { available: false, message: "Username must be at least 3 characters" };
    }
    if (usernameToCheck.length > 24) { // Max length check
      return { available: false, message: "Username cannot exceed 24 characters" };
    }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(usernameToCheck)) {
      return { available: false, message: "Username can only contain letters, numbers, and underscores" };
    }
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", usernameToCheck.toLowerCase()))
      .first();
    if (existingUser) {
      return { available: false, message: "Username already taken" };
    }
    return { available: true };
  },
});

export const completeOnboarding = mutation({
  args: {
    username: v.string(),
    name: v.optional(v.union(v.string(), v.null())),
    bio: v.optional(v.union(v.string(), v.null())),
    profileImageKey: v.optional(v.union(v.string(), v.null())),
    defaultProfileGradientUri: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { profileImageKey, defaultProfileGradientUri } = args;
    let username = args.username.trim(); 
    let processedName = args.name?.trim() || undefined; // Trim and default to undefined
    let processedBio = args.bio?.trim() || undefined;   // Trim and default to undefined

    // --- SERVER-SIDE VALIDATION ---
    // Username validation
    if (!username) {
      throw new Error("Username cannot be empty");
    }
    if (username.length < 3) {
      throw new Error("Username must be at least 3 characters");
    }
    if (username.length > 24) { // Max length check
      throw new Error("Username cannot exceed 24 characters");
    }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      throw new Error("Username can only contain letters, numbers, and underscores");
    }

    // Name (Display Name) validation
    const MAX_NAME_LENGTH = 60;
    if (processedName && processedName.length > MAX_NAME_LENGTH) {
      throw new Error(`Display name cannot exceed ${MAX_NAME_LENGTH} characters.`);
    }
    // If name was provided but trimmed to empty, it's already undefined from initial assignment.
    if (args.name && !processedName) {
        processedName = undefined;
    }

    // Bio validation
    const MAX_BIO_LENGTH = 250;
    if (processedBio && processedBio.length > MAX_BIO_LENGTH) {
      throw new Error(`Bio cannot exceed ${MAX_BIO_LENGTH} characters.`);
    }
    // If bio was provided but trimmed to empty, it's already undefined.
    if (args.bio && !processedBio) {
        processedBio = undefined;
    }
    // --- END SERVER-SIDE VALIDATION ---

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated");
    }
    
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(user => user ? { _id: user._id, username: user.username, isBoarded: user.isBoarded } : null);
      
    if (!user) {
      throw new Error("User not found");
    }
    
    // Prevent multiple onboarding completions (and duplicate friend requests)
    if (user.isBoarded) {
      throw new Error("User has already completed onboarding");
    }
    
    if (user.username?.toLowerCase() !== username.toLowerCase()) {
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_username", q => q.eq("username", username.toLowerCase()))
        .first();
      
      if (existingUser) {
        throw new Error("Username already taken");
      }
    }
    
    const updates: {
      username: string;
      name?: string; // Schema likely v.optional(v.string()) so it takes string | undefined
      bio?: string;  // Schema likely v.optional(v.string()) so it takes string | undefined
      profileImageKey?: string;
      profileImage?: string;
      isBoarded: boolean;
    } = {
      username: username.toLowerCase(),
      isBoarded: true
    };
    
    // Only add name/bio to updates if they have a value after processing.
    // If they are undefined (e.g. not provided, or trimmed to empty and set to undefined),
    // they won't be included in the patch, effectively leaving them as is or unsetting them if that's patch behavior for undefined.
    if (processedName) {
      updates.name = processedName;
    }
    
    if (processedBio) {
      updates.bio = processedBio;
    }

    if (profileImageKey) {
      updates.profileImageKey = profileImageKey;
      try {
        const publicUrl = await r2.getUrl(profileImageKey);
        updates.profileImage = publicUrl;
      } catch (error) {
        console.error("Failed to get image URL for key:", profileImageKey, error);
        // If getUrl fails for an uploaded image, still save the key, but profileImage might remain undefined
        // or we could fallback to defaultProfileGradientUri if provided, though less likely path.
        if (defaultProfileGradientUri) {
           updates.profileImage = defaultProfileGradientUri;
        }
      }
    } else if (defaultProfileGradientUri) {
      // No user-uploaded image, use the provided default gradient URI
      updates.profileImage = defaultProfileGradientUri;
    }
    
    // Update the user
    await ctx.db.patch(userId, updates);
    
    // Send admin friend request to new user (Tom from MySpace style)
    try {
      await ctx.runMutation(api.friends.sendAdminFriendRequest, { 
        newUserId: userId 
      });
    } catch (error) {
      // Log the error but don't fail onboarding if friend request fails
      console.error("Failed to send admin friend request during onboarding:", error);
    }
    
    return { success: true };
  },
});

// --- ADD NEW CONVEX ACTION --- 
export const finalizeOnboardingAction = action({
  args: {
    // These args must match the completeOnboarding mutation
    username: v.string(),
    name: v.optional(v.union(v.string(), v.null())),
    bio: v.optional(v.union(v.string(), v.null())),
    profileImageKey: v.optional(v.union(v.string(), v.null())),
    defaultProfileGradientUri: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    // This action runs server-side with auth context
    // Get userId for checking current onboarding status
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }
    
    // Check if user is already onboarded (handles race condition)
    const user = await ctx.runQuery(api.users.getProfile, {});
    if (user?.isBoarded) {
      // User is already onboarded, return special status to handle race condition
      return { 
        success: true, 
        status: "ALREADY_ONBOARDED"
      };
    }
    
    // Not already onboarded, proceed with normal flow
    try {
      await ctx.runMutation(api.users.completeOnboarding, args);
      return { success: true };
    } catch (error) {
      console.error("Error in Convex finalizeOnboardingAction:", error);
      // Propagate the error message
      const errorMessage = error instanceof Error ? error.message : "Failed to complete onboarding in Convex action";
      // Throwing here will make useAction hook catch it
      throw new Error(errorMessage);
    }
  },
});

// Optimized version of searchUsers that uses field filtering
export const searchUsersOptimized = query({
  args: { 
    query: v.string(),
    cursor: v.optional(v.id("users")),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { query, cursor, limit = 10 } = args;
    
    // Get current authenticated user (optional)
    let currentUserId = null;
    try {
      currentUserId = await getAuthUserId(ctx);
    } catch (e) {
      // Not authenticated, continue as guest
    }
    
    // Create a case-insensitive regex pattern
    const searchPattern = new RegExp(query.trim() || '.', 'i');
    
    // Get only the fields we need for filtering and displaying users
    // This prevents exposing sensitive fields like email, verification status, etc.
    const users = await ctx.db
      .query("users")
      .collect()
      .then(users => users.map(user => ({
        _id: user._id,
        username: user.username,
        name: user.name,
        bio: user.bio,
        profileImage: user.profileImage,
        isAnonymous: user.isAnonymous,
        isBoarded: user.isBoarded
      })));

    // Skip if we don't have users
    if (users.length === 0) {
      return { users: [], hasMore: false, nextCursor: null };
    }
    
    // Filter users by username, name, and bio using regex
    // Sort by priority: username match, then name match, then bio match
    const matchingUsers = users
      .filter(user => {
        // Skip users without usernames
        if (!user.username) return false;
        
        // Skip anonymous users
        if (user.isAnonymous) return false;
        
        // Match against username, name, or bio
        return (
          searchPattern.test(user.username) || 
          (user.name && searchPattern.test(user.name)) || 
          (user.bio && searchPattern.test(user.bio))
        );
      })
      .sort((a, b) => {
        // Sort by match priority (username > name > bio)
        const aUsernameMatch = a.username && searchPattern.test(a.username) ? 3 : 0;
        const aNameMatch = a.name && searchPattern.test(a.name) ? 2 : 0;
        const aBioMatch = a.bio && searchPattern.test(a.bio) ? 1 : 0;
        const aScore = aUsernameMatch + aNameMatch + aBioMatch;
        
        const bUsernameMatch = b.username && searchPattern.test(b.username) ? 3 : 0;
        const bNameMatch = b.name && searchPattern.test(b.name) ? 2 : 0;
        const bBioMatch = b.bio && searchPattern.test(b.bio) ? 1 : 0;
        const bScore = bUsernameMatch + bNameMatch + bBioMatch;
        
        return bScore - aScore;
      });
    
    // Handle pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = matchingUsers.findIndex(user => user._id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }
    
    // Get the paginated users
    const paginatedUsers = matchingUsers.slice(startIndex, startIndex + limit + 1);
    
    // Check if there are more users
    const hasMore = paginatedUsers.length > limit;
    const resultUsers = paginatedUsers.slice(0, limit);
    const nextCursor = hasMore && resultUsers.length > 0 ? resultUsers[resultUsers.length - 1]._id : null;
    
    // 🔥 SIMPLIFIED: No friendship data in main query - let component handle it reactively
    // This makes the query lightweight and only reactive to user data changes
    const formattedUsers = resultUsers.map(user => ({
      userId: user._id,
      username: user.username || "Guest",
      name: user.name,
      bio: user.bio || "",
      profileImage: user.profileImage,
      isAuthenticated: !!currentUserId,
      friendshipStatus: null // Always null - component will populate this
    }));
    
    return {
      users: formattedUsers,
      hasMore,
      nextCursor
    };
  },
});

export const getRandomUsers = query({
  args: { 
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { limit = 10 } = args;
    
    // Get current authenticated user (optional)
    let currentUserId = null;
    try {
      currentUserId = await getAuthUserId(ctx);
    } catch (e) {
      // Not authenticated, continue as guest
    }
    
    // 🔥 OPTIMIZED APPROACH: Use a single efficient query with reasonable sampling
    // For true randomness at scale, we'd need a pre-computed random order or sampling service
    // This approach balances performance with reasonable randomness
    
    // Get a larger sample than needed, but not the entire table
    const sampleMultiplier = 3; // Get 3x more than needed for filtering
    const sampleSize = Math.min(limit * sampleMultiplier, 100); // Cap at 100 for performance
    
    const users = await ctx.db
      .query("users")
      .order("desc") // Consistent ordering
      .take(sampleSize);
    
    // Filter for valid users
    const validUsers = users.filter(user => {
      return user.username && !user.isAnonymous && user.isBoarded === true;
    });
    
    // If we don't have enough valid users, get more
    let allValidUsers = validUsers;
    if (validUsers.length < limit && sampleSize < 200) {
      // Get a larger sample if needed
      const additionalUsers = await ctx.db
        .query("users")
        .order("asc") // Different order for variety
        .take(100);
      
      const additionalValid = additionalUsers.filter(user => {
        return user.username && 
               !user.isAnonymous && 
               user.isBoarded === true &&
               !validUsers.some(existing => existing._id === user._id); // Avoid duplicates
      });
      
      allValidUsers = [...validUsers, ...additionalValid];
    }
    
    // Shuffle for randomness
    for (let i = allValidUsers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allValidUsers[i], allValidUsers[j]] = [allValidUsers[j], allValidUsers[i]];
    }
    
    // Get the final limited set
    const randomUsers = allValidUsers.slice(0, limit);
    
    // Skip if we don't have users
    if (randomUsers.length === 0) {
      return { users: [], hasMore: false, nextCursor: null };
    }
    
    // 🔥 SIMPLIFIED: No friendship data in main query - let component handle it reactively
    // This makes the query lightweight and only reactive to user data changes
    const formattedUsers = randomUsers.map(user => ({
      userId: user._id,
      username: user.username || "Guest",
      name: user.name,
      bio: user.bio || "",
      profileImage: user.profileImage,
      isAuthenticated: !!currentUserId,
      friendshipStatus: null // Always null - component will populate this
    }));
    
    return {
      users: formattedUsers,
      hasMore: false,
      nextCursor: null
    };
  },
});

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    // Get the authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated");
    }
    
    // Get only the profile image key if it exists
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(user => user ? {
        _id: user._id,
        profileImageKey: user.profileImageKey
      } : null);
      
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get the profile image key if it exists
    const profileImageKey = user.profileImageKey;
    
    // 1. Delete user's likes
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    
    for (const like of likes) {
      await ctx.db.delete(like._id);
    }
    
    // 2. Delete user's bookmarks
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    
    for (const bookmark of bookmarks) {
      await ctx.db.delete(bookmark._id);
    }
    
    // 3. Delete user's retweets
    const retweets = await ctx.db
      .query("retweets")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    
    for (const retweet of retweets) {
      await ctx.db.delete(retweet._id);
    }
    
    // 4. Delete user's comments and comment likes
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    
    for (const comment of comments) {
      // Delete likes for this comment
      const commentLikes = await ctx.db
        .query("commentLikes")
        .withIndex("by_comment", q => q.eq("commentId", comment._id))
        .collect();
      
      for (const like of commentLikes) {
        await ctx.db.delete(like._id);
      }
      
      // Delete the comment itself
      await ctx.db.delete(comment._id);
    }
    
    // 5. Delete likes the user made on other comments
    const userCommentLikes = await ctx.db
      .query("commentLikes")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    
    for (const like of userCommentLikes) {
      await ctx.db.delete(like._id);
    }
    
    // 6. Delete user's following data
    const following = await ctx.db
      .query("following")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    
    for (const follow of following) {
      await ctx.db.delete(follow._id);
    }
    
    // 7. Delete user's friendship data (both as requester and requestee)
    // Get friendships where user is the requester
    const friendshipsAsRequester = await ctx.db
      .query("friends")
      .withIndex("by_requester", q => q.eq("requesterId", userId))
      .collect();
    
    for (const friendship of friendshipsAsRequester) {
      await ctx.db.delete(friendship._id);
    }
    
    // Get friendships where user is the requestee
    const friendshipsAsRequestee = await ctx.db
      .query("friends")
      .withIndex("by_requestee", q => q.eq("requesteeId", userId))
      .collect();
    
    for (const friendship of friendshipsAsRequestee) {
      await ctx.db.delete(friendship._id);
    }
    
    // 8. Delete auth-related data
    
    // 8.1 Delete auth accounts
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", q => q.eq("userId", userId))
      .collect();
    
    for (const account of authAccounts) {
      // Delete any verification codes associated with this account first
      const verificationCodes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", q => q.eq("accountId", account._id))
        .collect();
      
      for (const code of verificationCodes) {
        await ctx.db.delete(code._id);
      }
      
      // Delete the account
      await ctx.db.delete(account._id);
    }
    
    // 8.2 Delete auth sessions and related refresh tokens
    const authSessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", q => q.eq("userId", userId))
      .collect();
    
    for (const session of authSessions) {
      // Delete refresh tokens for this session
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", q => q.eq("sessionId", session._id))
        .collect();
      
      for (const token of refreshTokens) {
        await ctx.db.delete(token._id);
      }
      
      // Delete session verifiers
      const verifiers = await ctx.db
        .query("authVerifiers")
        .filter(q => q.eq(q.field("sessionId"), session._id))
        .collect();
      
      for (const verifier of verifiers) {
        await ctx.db.delete(verifier._id);
      }
      
      // Delete the session
      await ctx.db.delete(session._id);
    }
    
    // 9. Delete the profile image from R2 if it exists
    if (profileImageKey) {
      // Schedule the deletion of the profile image
      ctx.scheduler.runAfter(0, api.r2Cleanup.deleteR2Object, { key: profileImageKey });
    }
    
    // 10. Finally, delete the user record itself
    await ctx.db.delete(userId);
    
    return { success: true };
  },
});

// ✅ SUPER OPTIMIZED: Combined auth query that fetches both user data and pending friend requests
// This replaces the need for separate api.users.viewer + api.friends.getMyPendingFriendRequestCount
// Reduces 2 queries to 1 with parallel execution for maximum efficiency
export const getAuthUserWithNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        user: null,
        pendingFriendRequestCount: 0,
        isAuthenticated: false
      };
    }
    
    // ✅ MAXIMUM EFFICIENCY: Run all queries in parallel with optimized counting
    const [userData, friendRequestCounts] = await Promise.all([
      // Get user data with only essential auth fields
      ctx.db
        .query("users")
        .filter(q => q.eq(q.field("_id"), userId))
        .first()
        .then(user => user ? {
          _id: user._id,
          _creationTime: user._creationTime,
          username: user.username,
          name: user.name,
          email: user.email,
          isAnonymous: user.isAnonymous,
          isBoarded: user.isBoarded ?? false,
          profileImage: user.profileImage
        } : null),
      
      // ✅ ULTRA OPTIMIZED: Single query for both pending and requested counts
      // Uses the same index but reduces from 2 queries to 1 for friend requests
      ctx.db
        .query("friends")
        .withIndex("by_requestee", (q) => q.eq("requesteeId", userId))
        .filter(q => q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "requested")
        ))
        .collect()
        .then(results => ({
          pending: results.filter(r => r.status === "pending").length,
          requested: results.filter(r => r.status === "requested").length
        }))
    ]);
    
    if (!userData) {
      throw new Error("User was deleted");
    }
    
    // ✅ Simple addition - no array operations
    const pendingFriendRequestCount = friendRequestCounts.pending + friendRequestCounts.requested;
    
    return {
      user: userData,
      pendingFriendRequestCount,
      isAuthenticated: true
    };
  },
});

