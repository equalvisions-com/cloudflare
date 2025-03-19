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
      throw new Error("Not signed in");
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

    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (!profile) {
      const user = await ctx.db.get(userId);
      return { username: user?.name ?? "Guest" };
    }

    return profile;
  },
});

export const getProfileByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("username"), args.username))
      .first();
    return profile || null;
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
    
    // Find the user's profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .first();
    
    if (!profile) {
      throw new Error("Profile not found");
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
    const oldProfileImageKey = profile.profileImageKey;
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
    
    // Update the profile
    await ctx.db.patch(profile._id, updates);
    
    return profile._id;
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

        // Get friend's profile
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_userId")
          .filter((q: any) => q.eq(q.field("userId"), friendId))
          .first();

        if (!profile) return null;

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

  // Filter out null values
  return {
    items: friendItems.filter(Boolean),
    hasMore,
    cursor: cursor ? cursor.toString() : null,
  };
}

async function getFollowingWithPosts(
  ctx: any,
  userId: Id<"users">,
  limit: number
) {
  // Get following relationships
  const followingItems = await ctx.db
    .query("following")
    .withIndex("by_user")
    .filter((q: any) => q.eq(q.field("userId"), userId))
    .order("desc")
    .take(limit + 1); // Take one extra to check if there are more

  // Determine if there are more results
  const hasMore = followingItems.length > limit;
  const cursor = hasMore ? followingItems[limit - 1]._id : null;
  const items = hasMore ? followingItems.slice(0, limit) : followingItems;

  // Get post data for each following item
  const followingWithPosts = await Promise.all(
    items.map(async (following: any) => {
      // Get the post details
      const post = await ctx.db.get(following.postId);
      if (!post) return null;

      return {
        following,
        post,
      };
    })
  );

  // Filter out null values
  return {
    items: followingWithPosts.filter(Boolean),
    hasMore,
    cursor: cursor ? cursor.toString() : null,
  };
}

async function getEntryDetailsWithPostMetadata(
  ctx: any,
  guids: string[],
  feedUrls: string[]
) {
  if (guids.length === 0) {
    return { posts: [], entryDetails: {} };
  }
  
  // Get posts related to the feedUrls
  const posts = await ctx.db
    .query("posts")
    .withIndex("by_feedUrl")
    .filter((q: any) => 
      q.or(
        ...feedUrls.filter(Boolean).map((feedUrl: string) => 
          q.eq(q.field("feedUrl"), feedUrl)
        )
      )
    )
    .collect();
    
  // Create a map of posts by feedUrl for faster lookup
  const postsByFeedUrl: Record<string, any> = {};
  
  for (const post of posts) {
    if (!post.feedUrl) continue;
    
    // Some feed URLs might have multiple posts, we want the latest one
    if (!postsByFeedUrl[post.feedUrl] || post._creationTime > postsByFeedUrl[post.feedUrl]._creationTime) {
      postsByFeedUrl[post.feedUrl] = post;
    }
  }

  // For entry details, we'll create MINIMAL placeholders - ONLY for post metadata enrichment
  // We won't try to replace the PlanetScale RSS entry data
  const entryDetails: Record<string, any> = {};
  
  // Process each guid to add ONLY post metadata
  for (const guid of guids) {
    // Initialize with bare minimum structure - NOT replacing PlanetScale entry data
    entryDetails[guid] = {
      guid: guid,
    };
    
    // Get activities from all tables for this guid to find associated feedUrl
    const [like, comment, retweet] = await Promise.all([
      ctx.db
        .query("likes")
        .withIndex("by_entry") 
        .filter((q: any) => q.eq(q.field("entryGuid"), guid))
        .first(),
      ctx.db
        .query("comments")
        .withIndex("by_entry")
        .filter((q: any) => q.eq(q.field("entryGuid"), guid))
        .first(),
      ctx.db
        .query("retweets")
        .withIndex("by_entry") 
        .filter((q: any) => q.eq(q.field("entryGuid"), guid))
        .first()
    ]);
    
    // Find the first valid feedUrl
    let feedUrl = like?.feedUrl || comment?.feedUrl || retweet?.feedUrl;
    
    // Store the feedUrl for reference
    entryDetails[guid].feed_url = feedUrl;
    
    // If we found a valid feedUrl and have a post for it
    if (feedUrl && postsByFeedUrl[feedUrl]) {
      const post = postsByFeedUrl[feedUrl];
      
      // Get featured image from the correct field (handle different field names)
      const featuredImage = post.featuredImage || post.featuredImg;
      
      // Get slug from the correct field (handle different field names)
      const slug = post.slug || post.postSlug;
      
      // ONLY add Convex post metadata fields - don't replace PlanetScale data
      entryDetails[guid].post_title = post.title || "";
      entryDetails[guid].post_featured_img = featuredImage || "";
      entryDetails[guid].post_media_type = post.mediaType || "";
      entryDetails[guid].category_slug = post.categorySlug || "";
      entryDetails[guid].post_slug = slug || "";
    }
  }

  return {
    posts,
    entryDetails
  };
}

interface EntryMetric {
  likes: {
    count: number;
    isLiked: boolean;
  };
  comments: {
    count: number;
  };
  retweets: {
    count: number;
    isRetweeted: boolean;
  };
}

async function getEntriesMetrics(
  ctx: any,
  guids: string[],
  userId: Id<"users"> | null
) {
  if (guids.length === 0) return {};

  // Get all likes, comments, and retweets in parallel
  const [likes, comments, retweets] = await Promise.all([
    // Get all likes for the requested entries
    ctx.db
      .query("likes")
      .withIndex("by_entry")
      .filter((q: any) => 
        q.or(
          ...guids.map((guid: string) => 
            q.eq(q.field("entryGuid"), guid)
          )
        )
      )
      .collect(),

    // Get all comments for the requested entries
    ctx.db
      .query("comments")
      .withIndex("by_entry")
      .filter((q: any) => 
        q.or(
          ...guids.map((guid: string) => 
            q.eq(q.field("entryGuid"), guid)
          )
        )
      )
      .collect(),
      
    // Get all retweets for the requested entries
    ctx.db
      .query("retweets")
      .withIndex("by_entry")
      .filter((q: any) => 
        q.or(
          ...guids.map((guid: string) => 
            q.eq(q.field("entryGuid"), guid)
          )
        )
      )
      .collect()
  ]);

  // Process metrics data
  const metricsMap: Record<string, EntryMetric> = {};
  const userIdString = userId ? userId.toString() : '';

  for (const guid of guids) {
    const entryLikes = likes.filter((like: any) => like.entryGuid === guid);
    const entryComments = comments.filter((comment: any) => comment.entryGuid === guid);
    const entryRetweets = retweets.filter((retweet: any) => retweet.entryGuid === guid);

    metricsMap[guid] = {
      likes: {
        count: entryLikes.length,
        isLiked: userId ? entryLikes.some((like: any) => like.userId && like.userId.toString() === userIdString) : false
      },
      comments: {
        count: entryComments.length
      },
      retweets: {
        count: entryRetweets.length,
        isRetweeted: userId ? entryRetweets.some((retweet: any) => retweet.userId && retweet.userId.toString() === userIdString) : false
      }
    };
  }

  return metricsMap;
}

// New combined query for profile page data
export const getProfilePageData = query({
  args: {
    username: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const username = args.username;
    const limit = args.limit || 30;
    
    // Get profile data
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", q => q.eq("username", username))
      .first();
    
    if (!profile) return null;
    
    // Run all social queries in parallel
    const [
      friendsWithProfiles,
      followingWithPosts
    ] = await Promise.all([
      // Get friends with profiles
      getFriendsWithProfiles(ctx, profile.userId, limit),
      
      // Get following with posts
      getFollowingWithPosts(ctx, profile.userId, limit)
    ]);
    
    // Get counts
    const friendCount = friendsWithProfiles.items.length;
    const followingCount = followingWithPosts.items.length;
    
    return {
      profile,
      social: {
        friendCount,
        followingCount,
        friends: {
          friends: friendsWithProfiles.items,
          hasMore: friendsWithProfiles.hasMore,
          cursor: friendsWithProfiles.cursor
        },
        following: {
          following: followingWithPosts.items,
          hasMore: followingWithPosts.hasMore,
          cursor: followingWithPosts.cursor
        }
      }
    };
  }
});

// New combined query for profile activity data
export const getProfileActivityData = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const limit = args.limit || 30;
    
    // Get activities (comments and retweets)
    const [comments, retweets] = await Promise.all([
      ctx.db
        .query("comments")
        .withIndex("by_user", q => q.eq("userId", userId))
        .filter(q => q.eq(q.field("parentId"), undefined))
        .collect(),
      
      ctx.db
        .query("retweets")
        .withIndex("by_user", q => q.eq("userId", userId))
        .collect()
    ]);
    
    // Transform to activities and sort
    const activities = [
      ...comments.map(c => ({
        type: "comment",
        _id: c._id.toString(),
        timestamp: c.createdAt,
        entryGuid: c.entryGuid,
        feedUrl: c.feedUrl,
        content: c.content,
      })),
      ...retweets.map(r => ({
        type: "retweet",
        _id: r._id.toString(),
        timestamp: r.retweetedAt,
        entryGuid: r.entryGuid,
        feedUrl: r.feedUrl,
        title: r.title,
        link: r.link,
        pubDate: r.pubDate,
      }))
    ].sort((a, b) => b.timestamp - a.timestamp);
    
    // Get first page with pagination info
    const paginatedActivities = activities.slice(0, limit);
    const totalCount = activities.length;
    const hasMore = limit < totalCount;
    
    // Extract GUIDs for metadata and metrics
    const guids = paginatedActivities.map(a => a.entryGuid);
    const feedUrls = [...new Set(paginatedActivities.map(a => a.feedUrl))];
    
    // Get metrics for all guids
    const metrics = await getEntriesMetrics(ctx, guids, userId);
    
    // Get entry details with post metadata enrichment
    const { entryDetails } = await getEntryDetailsWithPostMetadata(ctx, guids, feedUrls);
    
    return {
      activities: {
        activities: paginatedActivities,
        totalCount,
        hasMore
      },
      entryDetails,
      entryMetrics: metrics
    };
  }
});

// Also add a combined activity and likes query to optimize the likes tab
export const getProfileLikesData = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const limit = args.limit || 30;
    
    // Get user's likes
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .take(limit + 1); // Take one extra to check if there are more
    
    // Determine if there are more results
    const hasMore = likes.length > limit;
    const paginatedLikes = hasMore ? likes.slice(0, limit) : likes;
    
    // Transform to activities
    const activities = paginatedLikes.map(like => ({
      type: "like",
      _id: like._id.toString(),
      timestamp: like._creationTime,
      entryGuid: like.entryGuid,
      feedUrl: like.feedUrl,
      title: like.title,
      link: like.link,
      pubDate: like.pubDate,
    }));
    
    // Extract GUIDs for metadata and metrics
    const guids = activities.map(a => a.entryGuid);
    const feedUrls = [...new Set(activities.map(a => a.feedUrl))];
    
    // Get metrics for all guids
    const metrics = await getEntriesMetrics(ctx, guids, userId);
    
    // Get entry details with post metadata enrichment
    const { entryDetails } = await getEntryDetailsWithPostMetadata(ctx, guids, feedUrls);
    
    return {
      activities: {
        activities,
        totalCount: likes.length,
        hasMore
      },
      entryDetails,
      entryMetrics: metrics
    };
  }
});