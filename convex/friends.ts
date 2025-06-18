import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// Rate limiting constants for friend requests
const FRIEND_RATE_LIMITS = {
  PER_USER_COOLDOWN: 2000,        // 2 seconds between ANY actions to same user (increased to prevent spam)
  BURST_LIMIT: 10,                 // 10 requests max
  BURST_WINDOW: 120000,           // in 2 minutes
  HOURLY_LIMIT: 25,               // 25 requests per hour
  HOURLY_WINDOW: 3600000,         // 1 hour in milliseconds
  DAILY_LIMIT: 75,                // 75 requests per day
  DAILY_WINDOW: 86400000,         // 24 hours in milliseconds
};

// Helper function to get the last interaction time with a specific user
async function getLastUserInteractionTime(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
  targetUserId: Id<"users">
): Promise<number | null> {
  // Check for any friendship record to find last interaction time
  // We need to check both directions since user could have sent or received requests
  
  // Check sent requests/friendships (most recent first)
  const sentInteractions = await ctx.db
    .query("friends")
    .withIndex("by_requester", (q: any) => q.eq("requesterId", userId))
    .filter((q: any) => q.eq(q.field("requesteeId"), targetUserId))
    .order("desc")
    .take(1);
  
  // Check received requests/friendships (most recent first)  
  const receivedInteractions = await ctx.db
    .query("friends")
    .withIndex("by_requestee", (q: any) => q.eq("requesteeId", userId))
    .filter((q: any) => q.eq(q.field("requesterId"), targetUserId))
    .order("desc")
    .take(1);
  
  // Find the most recent interaction from either direction
  let lastInteractionTime: number | null = null;
  
  if (sentInteractions.length > 0) {
    const sentTime = sentInteractions[0].updatedAt || sentInteractions[0].createdAt;
    lastInteractionTime = Math.max(lastInteractionTime || 0, sentTime);
  }
  
  if (receivedInteractions.length > 0) {
    const receivedTime = receivedInteractions[0].updatedAt || receivedInteractions[0].createdAt;
    lastInteractionTime = Math.max(lastInteractionTime || 0, receivedTime);
  }
  
  return lastInteractionTime;
}

// Helper function to check friendship status between two users
export async function checkFriendshipStatus(
  ctx: QueryCtx,
  requesterId: Id<"users">,
  requesteeId: Id<"users">
) {
  // Check if a friendship already exists in either direction (exclude cancelled)
  const sentRequest = await ctx.db
    .query("friends")
    .withIndex("by_users", (q: any) => 
      q.eq("requesterId", requesterId).eq("requesteeId", requesteeId)
    )
    .filter((q: any) => q.neq(q.field("status"), "cancelled"))
    .first()
    .then(doc => doc ? { _id: doc._id, status: doc.status } : null);

  if (sentRequest) {
    return {
      exists: true,
      status: sentRequest.status,
      direction: "sent",
      friendshipId: sentRequest._id,
    };
  }

  // Check if there's a request from the other user (exclude cancelled)
  const receivedRequest = await ctx.db
    .query("friends")
    .withIndex("by_users", (q: any) => 
      q.eq("requesterId", requesteeId).eq("requesteeId", requesterId)
    )
    .filter((q: any) => q.neq(q.field("status"), "cancelled"))
    .first()
    .then(doc => doc ? { _id: doc._id, status: doc.status } : null);

  if (receivedRequest) {
    return {
      exists: true,
      status: receivedRequest.status,
      direction: "received",
      friendshipId: receivedRequest._id,
    };
  }

  // No friendship exists
  return {
    exists: false,
    status: null,
    direction: null,
    friendshipId: null,
  };
}

// Check the friendship status between two users
export const getFriendshipStatus = query({
  args: {
    requesterId: v.id("users"),
    requesteeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { requesterId, requesteeId } = args;
    return checkFriendshipStatus(ctx, requesterId, requesteeId);
  },
});

// Get friendship status by user ID (for UI display)
export const getFriendshipStatusByUserId = query({
  args: {
    userId2: v.id("users"),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { userId2, currentUserId } = args;

    // If no currentUserId is provided, try to get it from auth
    let userId = currentUserId;
    if (!userId) {
      const authUserId = await getAuthUserId(ctx);
      // Early return if not authenticated
      if (authUserId === null) {
        return {
          exists: false,
          status: "not_logged_in",
          direction: null,
          friendshipId: null,
        };
      }
      userId = authUserId;
    }

    // Don't allow self-friending
    if (userId2 === userId) {
      return {
        exists: false,
        status: "self",
        direction: null,
        friendshipId: null,
      };
    }

    return checkFriendshipStatus(ctx, userId, userId2);
  },
});

// Get friendship status by username
export const getFriendshipStatusByUsername = query({
  args: {
    username: v.string(),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { username, currentUserId } = args;

    // If no currentUserId is provided, try to get it from auth
    let userId = currentUserId;
    if (!userId) {
      const authUserId = await getAuthUserId(ctx);
      // Early return if not authenticated
      if (authUserId === null) {
        return {
          exists: false,
          status: null,
          direction: null,
          friendshipId: null,
        };
      }
      userId = authUserId;
    }

    // Get the user by username using the by_username index
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", username))
      .first()
      .then(user => user ? { _id: user._id } : null);
    
    if (!user) {
      throw new Error("User not found");
    }

    const profileUserId = user._id;

    // Don't allow self-friending
    if (profileUserId === userId) {
      return {
        exists: false,
        status: "self",
        direction: null,
        friendshipId: null,
      };
    }

    return checkFriendshipStatus(ctx, userId, profileUserId);
  },
});

// Get friendship count by username
export const getFriendCountByUsername = query({
  args: { 
    username: v.string(),
    status: v.optional(v.string()) 
  },
  handler: async (ctx, args) => {
    const { username, status } = args;
    
    // Get the user by username using the by_username index
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", username))
      .first()
      .then(user => user ? { _id: user._id } : null);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const userId = user._id;
    
    // Count friendships where the user is the requester (exclude cancelled)
    const sentFriendships = await ctx.db
      .query("friends")
      .withIndex("by_requester")
      .filter(q => q.eq(q.field("requesterId"), userId))
      .filter(q => q.neq(q.field("status"), "cancelled"))
      .filter(q => status ? q.eq(q.field("status"), status) : true)
      .collect();
      
    // Count friendships where the user is the requestee (exclude cancelled)
    const receivedFriendships = await ctx.db
      .query("friends")
      .withIndex("by_requestee")
      .filter(q => q.eq(q.field("requesteeId"), userId))
      .filter(q => q.neq(q.field("status"), "cancelled"))
      .filter(q => status ? q.eq(q.field("status"), status) : true)
      .collect();
      
    return sentFriendships.length + receivedFriendships.length;
  },
});

// Get all friends for a user by username with pagination
export const getFriendsByUsername = query({
  args: {
    username: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { username, status, limit = 30, cursor } = args;
    
    // Get the user by username using the by_username index
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", username))
      .first()
      .then(user => user ? { _id: user._id } : null);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const userId = user._id;
    
    // Parse cursor if provided
    const cursorObj = cursor 
      ? JSON.parse(cursor) 
      : { sent: null, lastTimestamp: null };  // null means get both types initially
    
    let friendships = [];
    let hasMore = false;
    let newCursor;
    
    // Initial load: fetch both sent and received friendships
    if (cursorObj.sent === null) {
      // Get friendships where the user is the requester
      let sentQuery = ctx.db
        .query("friends")
        .withIndex("by_requester_time", q => q.eq("requesterId", userId));
        
      // Apply status filter if provided
      if (status) {
        sentQuery = sentQuery.filter(q => q.eq(q.field("status"), status));
      }
      
      // Take half the limit for sent friendships
      const halfLimit = Math.ceil(limit / 2);
      const sentFriendships = await sentQuery.take(halfLimit);
      
      // Map and add to results
      const sentMapped = sentFriendships.map(friendship => ({
        ...friendship,
        direction: "sent",
        friendId: friendship.requesteeId,
      }));
      
      // Get friendships where the user is the requestee
      let receivedQuery = ctx.db
        .query("friends")
        .withIndex("by_requestee_time", q => q.eq("requesteeId", userId));
        
      // Apply status filter if provided
      if (status) {
        receivedQuery = receivedQuery.filter(q => q.eq(q.field("status"), status));
      }
      
      // Take remaining limit for received friendships
      const receivedLimit = Math.max(limit - sentFriendships.length + 1, 1); // +1 to check for more
      const receivedFriendships = await receivedQuery.take(receivedLimit);
      
      // Check if there are more received friendships
      const moreReceived = receivedFriendships.length > receivedLimit - 1;
      if (moreReceived) {
        hasMore = true;
        receivedFriendships.pop(); // Remove the extra item
      }
      
      // Map and add to results
      const receivedMapped = receivedFriendships.map(friendship => ({
        ...friendship,
        direction: "received",
        friendId: friendship.requesterId,
      }));
      
      // Combine results
      friendships = [...sentMapped, ...receivedMapped];
      
      // Sort friendships by creation time
      friendships.sort((a, b) => b.createdAt - a.createdAt);
      
      // Limit to the requested amount
      if (friendships.length > limit) {
        friendships = friendships.slice(0, limit);
        hasMore = true;
      }
      
      // Set up next cursor to continue from received friendships if there are more
      if (hasMore) {
        // If we have received friendships and there are more, continue from there
        if (receivedFriendships.length > 0) {
          newCursor = JSON.stringify({
            sent: false,
            lastTimestamp: receivedFriendships[receivedFriendships.length - 1].createdAt
          });
        } else {
          // Otherwise continue from sent friendships
          newCursor = JSON.stringify({
            sent: true,
            lastTimestamp: sentFriendships[sentFriendships.length - 1].createdAt
          });
        }
      }
    } else if (cursorObj.sent) {
      // Get friendships where the user is the requester, using timestamp for pagination
      let query = ctx.db
        .query("friends")
        .withIndex("by_requester_time", q => q.eq("requesterId", userId));
        
      // Apply status filter if provided
      if (status) {
        query = query.filter(q => q.eq(q.field("status"), status));
      }
      
      // Apply cursor if provided
      if (cursorObj.lastTimestamp) {
        query = query.filter(q => q.gt(q.field("createdAt"), cursorObj.lastTimestamp));
      }
      
      // Get one more than requested to know if there are more
      const sentFriendships = await query.take(limit + 1);
      
      // Check if there are more results
      if (sentFriendships.length > limit) {
        hasMore = true;
        sentFriendships.pop(); // Remove the extra item
      }
      
      // Map and add to results
      friendships = sentFriendships.map(friendship => ({
        ...friendship,
        direction: "sent",
        friendId: friendship.requesteeId,
      }));
      
      // Set up next cursor
      if (hasMore) {
        newCursor = JSON.stringify({ 
          sent: true, 
          lastTimestamp: friendships[friendships.length - 1].createdAt 
        });
      } else if (sentFriendships.length > 0) {
        // If no more sent friendships, start with received friendships on next page
        newCursor = JSON.stringify({ 
          sent: false, 
          lastTimestamp: null 
        });
      }
    } else {
      // Get friendships where the user is the requestee, using timestamp for pagination
      let query = ctx.db
        .query("friends")
        .withIndex("by_requestee_time", q => q.eq("requesteeId", userId));
        
      // Apply status filter if provided
      if (status) {
        query = query.filter(q => q.eq(q.field("status"), status));
      }
      
      // Apply cursor if provided
      if (cursorObj.lastTimestamp) {
        query = query.filter(q => q.gt(q.field("createdAt"), cursorObj.lastTimestamp));
      }
      
      // Get one more than requested to know if there are more
      const receivedFriendships = await query.take(limit + 1);
      
      // Check if there are more results
      if (receivedFriendships.length > limit) {
        hasMore = true;
        receivedFriendships.pop(); // Remove the extra item
      }
      
      // Map and add to results
      friendships = receivedFriendships.map(friendship => ({
        ...friendship,
        direction: "received",
        friendId: friendship.requesterId,
      }));
      
      // Set up next cursor
      if (hasMore) {
        newCursor = JSON.stringify({ 
          sent: false, 
          lastTimestamp: friendships[friendships.length - 1].createdAt 
        });
      }
    }
    
    // Collect all friend IDs for a single batch query
    const friendUserIds = friendships.map(friendship => friendship.friendId);
    
    // Fetch only required profile fields for each friend in an optimized batch operation
    const friendProfiles = await Promise.all(
      friendUserIds.map(friendId => 
        ctx.db
          .query("users")
          .filter(q => q.eq(q.field("_id"), friendId))
          .first()
          .then(user => user ? {
            _id: user._id,
            userId: user._id, // Include userId for backward compatibility
            username: user.username || "Guest",
            name: user.name,
            profileImage: user.profileImage
          } : null)
      )
    );
    
    // Create a map for quick lookup of friend profiles
    const profileMap = new Map();
    friendProfiles.forEach((profile, index) => {
      if (profile) {
        profileMap.set(friendUserIds[index].toString(), profile);
      }
    });
    
    // Match friendships with their profiles efficiently
    const friendsWithDetails = friendships
      .map(friendship => {
        const profile = profileMap.get(friendship.friendId.toString());
        if (!profile) return null;
        
        // Return necessary friendship data with the profile
        return {
          friendship: {
            _id: friendship._id,
            requesterId: friendship.requesterId,
            requesteeId: friendship.requesteeId,
            status: friendship.status,
            direction: friendship.direction,
            createdAt: friendship.createdAt,
            updatedAt: friendship.updatedAt,
            friendId: friendship.friendId,
          },
          profile
        };
      })
      .filter(Boolean);
    
    return {
      friends: friendsWithDetails,
      hasMore,
      cursor: hasMore ? newCursor : null
    };
  },
});

// Send a friend request
export const sendFriendRequest = mutation({
  args: {
    requesteeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { requesteeId } = args;
    
    // Get the current user ID
    const requesterId = await getAuthUserId(ctx);
    if (requesterId === null) {
      throw new Error("Unauthorized");
    }

    // Don't allow self-friending
    if (requesterId === requesteeId) {
      throw new Error("Cannot send friend request to yourself");
    }

    // 1. Per-user cooldown: Check last interaction time with this user (prevents add/cancel/add spam)
    const lastInteractionTime = await getLastUserInteractionTime(ctx, requesterId, requesteeId);
    if (lastInteractionTime) {
      const timeSinceLastAction = Date.now() - lastInteractionTime;
      if (timeSinceLastAction < FRIEND_RATE_LIMITS.PER_USER_COOLDOWN) {
        throw new Error("Please wait before sending another request to this user");
      }
    }

    // Check if there's already an active friendship with this user
    const existingFriendship = await ctx.db
      .query("friends")
      .withIndex("by_users", (q: any) => 
        q.eq("requesterId", requesterId).eq("requesteeId", requesteeId)
      )
      .first()
      .then(doc => doc ? { _id: doc._id, status: doc.status, _creationTime: doc._creationTime } : null);

    if (existingFriendship) {
      // If it's cancelled, we can reuse the record
      if (existingFriendship.status === "cancelled") {
        return ctx.db.patch(existingFriendship._id, {
          status: "pending",
          updatedAt: Date.now(),
        });
      }
      // Otherwise it's active (pending or accepted)
      throw new Error("Friend request already sent");
    }

    // Check if there's a request from the other user
    const receivedRequest = await ctx.db
      .query("friends")
      .withIndex("by_users", (q: any) => 
        q.eq("requesterId", requesteeId).eq("requesteeId", requesterId)
      )
      .first()
      .then(doc => doc ? { _id: doc._id, status: doc.status } : null);

    if (receivedRequest) {
      // If there's a pending request from the other user, accept it
      if (receivedRequest.status === "pending") {
        return ctx.db.patch(receivedRequest._id, {
          status: "accepted",
          updatedAt: Date.now(),
        });
      } else {
        throw new Error("Friendship already exists");
      }
    }

    // 2. Burst protection: Max 10 friend requests in 2 minutes
    const burstCheck = await ctx.db
      .query("friends")
      .withIndex("by_requester", (q: any) => q.eq("requesterId", requesterId))
      .filter((q: any) => q.gte(q.field("_creationTime"), Date.now() - FRIEND_RATE_LIMITS.BURST_WINDOW))
      .take(FRIEND_RATE_LIMITS.BURST_LIMIT + 1);

    if (burstCheck.length >= FRIEND_RATE_LIMITS.BURST_LIMIT) {
      throw new Error("Too many friend requests too quickly. Please slow down.");
    }

    // 3. Hourly limit: Max 25 friend requests per hour
    const hourlyCheck = await ctx.db
      .query("friends")
      .withIndex("by_requester", (q: any) => q.eq("requesterId", requesterId))
      .filter((q: any) => q.gte(q.field("_creationTime"), Date.now() - FRIEND_RATE_LIMITS.HOURLY_WINDOW))
      .take(FRIEND_RATE_LIMITS.HOURLY_LIMIT + 1);

    if (hourlyCheck.length >= FRIEND_RATE_LIMITS.HOURLY_LIMIT) {
      throw new Error("Hourly friend request limit reached. Try again later.");
    }

    // 4. Daily limit: Max 75 friend requests per day
    const dailyCheck = await ctx.db
      .query("friends")
      .withIndex("by_requester", (q: any) => q.eq("requesterId", requesterId))
      .filter((q: any) => q.gte(q.field("_creationTime"), Date.now() - FRIEND_RATE_LIMITS.DAILY_WINDOW))
      .take(FRIEND_RATE_LIMITS.DAILY_LIMIT + 1);

    if (dailyCheck.length >= FRIEND_RATE_LIMITS.DAILY_LIMIT) {
      throw new Error("Daily friend request limit reached. Try again tomorrow.");
    }

    // All rate limit checks passed - create a new friend request
    return ctx.db.insert("friends", {
      requesterId,
      requesteeId,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Accept a friend request
export const acceptFriendRequest = mutation({
  args: {
    friendshipId: v.id("friends"),
  },
  handler: async (ctx, args) => {
    const { friendshipId } = args;
    
    // Get the current user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Unauthorized");
    }

    // Get the friendship with field filtering
    const friendship = await ctx.db
      .query("friends")
      .filter(q => q.eq(q.field("_id"), friendshipId))
      .first()
      .then(friendship => friendship ? {
        _id: friendship._id,
        requesteeId: friendship.requesteeId,
        status: friendship.status
      } : null);

    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Ensure the user is the requestee
    if (friendship.requesteeId !== userId) {
      throw new Error("Not authorized to accept this friend request");
    }

    // Ensure the request is pending
    if (friendship.status !== "pending") {
      throw new Error("Friend request is not pending");
    }

    // Accept the friend request
    return ctx.db.patch(friendshipId, {
      status: "accepted",
      updatedAt: Date.now(),
    });
  },
});

// Delete a friendship (reject request or unfriend)
export const deleteFriendship = mutation({
  args: {
    friendshipId: v.id("friends"),
  },
  handler: async (ctx, args) => {
    const { friendshipId } = args;
    
    // Get the current user ID
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Unauthorized");
    }

    // Get the friendship with field filtering
    const friendship = await ctx.db
      .query("friends")
      .filter(q => q.eq(q.field("_id"), friendshipId))
      .first()
      .then(friendship => friendship ? {
        _id: friendship._id,
        requesterId: friendship.requesterId,
        requesteeId: friendship.requesteeId
      } : null);

    if (!friendship) {
      throw new Error("Friendship not found");
    }

    // Ensure the user is either the requester or requestee
    if (friendship.requesterId !== userId && friendship.requesteeId !== userId) {
      throw new Error("Not authorized to delete this friendship");
    }

    // Instead of deleting, mark as cancelled to preserve rate limiting history
    return ctx.db.patch(friendshipId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});

// Get all friends for a user
export const getFriends = query({
  args: {
    userId: v.optional(v.id("users")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, status } = args;
    
    // If no userId is provided, try to get the current user
    let currentUserId = userId;
    if (!currentUserId) {
      const authUserId = await getAuthUserId(ctx);
      if (authUserId === null) {
        return [];
      }
      currentUserId = authUserId;
    }

    // Get friendships where the user is the requester (exclude cancelled)
    let sentFriendships = await ctx.db
      .query("friends")
      .withIndex("by_requester", (q: any) => q.eq("requesterId", currentUserId))
      .filter((q: any) => q.neq(q.field("status"), "cancelled"))
      .collect()
      .then(friendships => friendships.map(friendship => ({
        _id: friendship._id,
        requesterId: friendship.requesterId,
        requesteeId: friendship.requesteeId,
        status: friendship.status,
        createdAt: friendship.createdAt,
        updatedAt: friendship.updatedAt
      })));

    // Get friendships where the user is the requestee (exclude cancelled)
    let receivedFriendships = await ctx.db
      .query("friends")
      .withIndex("by_requestee", (q: any) => q.eq("requesteeId", currentUserId))
      .filter((q: any) => q.neq(q.field("status"), "cancelled"))
      .collect()
      .then(friendships => friendships.map(friendship => ({
        _id: friendship._id,
        requesterId: friendship.requesterId,
        requesteeId: friendship.requesteeId,
        status: friendship.status,
        createdAt: friendship.createdAt,
        updatedAt: friendship.updatedAt
      })));

    // If status is provided, filter the results
    if (status) {
      sentFriendships = sentFriendships.filter(f => f.status === status);
      receivedFriendships = receivedFriendships.filter(f => f.status === status);
    }

    // Combine and return with the direction
    return [
      ...sentFriendships.map(friendship => ({
        ...friendship,
        direction: "sent",
      })),
      ...receivedFriendships.map(friendship => ({
        ...friendship,
        direction: "received",
      })),
    ];
  },
});

// Get notifications (incoming friend requests and accepted friends) with user info in one query
export const getNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    
    if (!userId) {
      return { user: null, notifications: [] };
    }
    
    // Get user information - optimized to only get necessary fields
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(user => user ? {
        _id: user._id,
        username: user.username,
        name: user.name,
        profileImage: user.profileImage
      } : null);
    
    if (!user) {
      return { user: null, notifications: [] };
    }
    
    // Get all friend requests/acceptances involving this user within the last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    // Get friend requests received (exclude cancelled)
    const receivedRequests = await ctx.db
      .query("friends")
      .withIndex("by_requestee", (q: any) => q.eq("requesteeId", userId).eq("status", "pending"))
      .filter(q => {
        // Use createdAt if updatedAt doesn't exist, and default to _creationTime as backup
        const timestamp = q.field("updatedAt");
        return q.or(
          q.gte(timestamp, thirtyDaysAgo),
          q.eq(q.field("updatedAt"), undefined)  // Include items without updatedAt field
        );
      })
      .collect()
      .then(requests => requests.map(req => ({
        _id: req._id,
        requesterId: req.requesterId,
        requesteeId: req.requesteeId,
        status: req.status,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        _creationTime: req._creationTime
      })));
      
    // Get friend requests accepted where user is the requester
    const acceptedSentRequests = await ctx.db
      .query("friends")
      .withIndex("by_requester", (q: any) => q.eq("requesterId", userId).eq("status", "accepted"))
      .filter(q => {
        // Use createdAt if updatedAt doesn't exist, and default to _creationTime as backup
        const timestamp = q.field("updatedAt");
        return q.or(
          q.gte(timestamp, thirtyDaysAgo),
          q.eq(q.field("updatedAt"), undefined)  // Include items without updatedAt field
        );
      })
      .collect()
      .then(requests => requests.map(req => ({
        _id: req._id,
        requesterId: req.requesterId,
        requesteeId: req.requesteeId,
        status: req.status,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        _creationTime: req._creationTime
      })));
      
    // Get friend requests accepted where user is the requestee
    const acceptedReceivedRequests = await ctx.db
      .query("friends")
      .withIndex("by_requestee", (q: any) => q.eq("requesteeId", userId).eq("status", "accepted"))
      .filter(q => {
        // Use createdAt if updatedAt doesn't exist, and default to _creationTime as backup
        const timestamp = q.field("updatedAt");
        return q.or(
          q.gte(timestamp, thirtyDaysAgo),
          q.eq(q.field("updatedAt"), undefined)  // Include items without updatedAt field
        );
      })
      .collect()
      .then(requests => requests.map(req => ({
        _id: req._id,
        requesterId: req.requesterId,
        requesteeId: req.requesteeId,
        status: req.status,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        _creationTime: req._creationTime
      })));
      
    // Combine all notifications
    const allNotifications = [
      ...receivedRequests.map(req => ({
        type: "friend_request",
        friendshipId: req._id,
        friendId: req.requesterId,
        status: req.status,
        createdAt: req.updatedAt || req._creationTime,
      })),
      ...acceptedSentRequests.map(req => ({
        type: "friend_accepted",
        friendshipId: req._id,
        friendId: req.requesteeId,
        status: req.status,
        createdAt: req.updatedAt || req._creationTime,
      })),
      ...acceptedReceivedRequests.map(req => ({
        type: "friend_you_accepted",
        friendshipId: req._id,
        friendId: req.requesterId,
        status: req.status,
        createdAt: req.updatedAt || req._creationTime,
      })),
    ];
    
    // Sort by creation time, newest first
    allNotifications.sort((a, b) => b.createdAt - a.createdAt);
    
    // Fetch user information for each friend in one go
    const friendUserIds = allNotifications.map(n => n.friendId);
    
    // Fetch users individually but in parallel, with field filtering
    const userPromises = friendUserIds.map(friendId => 
      ctx.db
        .query("users")
        .filter(q => q.eq(q.field("_id"), friendId))
        .first()
        .then(user => user ? {
          _id: user._id,
          username: user.username,
          name: user.name,
          profileImage: user.profileImage
        } : null)
    );
    
    const users = await Promise.all(userPromises);
    
    // Create a map for quick lookup
    const userMap = new Map();
    users.forEach((user, index) => {
      if (user) {
        userMap.set(friendUserIds[index].toString(), user);
      }
    });
    
    // Add user details to notifications
    const notificationsWithDetails = allNotifications
      .map(friendship => {
        const friendUser = userMap.get(friendship.friendId.toString());
        if (!friendUser) return null;
        
        return {
          friendship: {
            ...friendship,
            direction: friendship.type === "friend_request" ? "received" : "sent",
            _id: friendship.friendshipId,
            requesterId: friendship.type === "friend_request" ? friendship.friendId : userId,
            requesteeId: friendship.type === "friend_request" ? userId : friendship.friendId
          },
          profile: {
            _id: friendUser._id,
            userId: friendUser._id,
            name: friendUser.name,
            username: friendUser.username,
            profileImage: friendUser.profileImage,
          },
        };
      })
      .filter(Boolean);
      
    return {
      user,
      notifications: notificationsWithDetails
    };
  },
});

export const friendRequests = query({
  args: {
    cursor: v.optional(v.string()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { cursor, numItems = 10 } = args;

    // Get logged in user ID
    const requesteeId = await getAuthUserId(ctx);

    if (requesteeId === null) {
      return { friendRequests: [], cursor: null };
    }

    // Get friendship requests where status is "requested", with field filtering
    const friendships = await ctx.db
      .query("friends")
      .withIndex("by_requestee", q => q.eq("requesteeId", requesteeId).eq("status", "requested"))
      .order("desc")
      .paginate({ cursor: cursor || null, numItems })
      .then(result => ({
        page: result.page.map(friendship => ({
          _id: friendship._id,
          requesterId: friendship.requesterId,
          requesteeId: friendship.requesteeId,
          status: friendship.status,
          createdAt: friendship.createdAt
        })),
        continueCursor: result.continueCursor
      }));

    // Fetch user information for each requesterId with field filtering
    const friendsWithDetails = await Promise.all(
      friendships.page.map(async (friendship) => {
        const friendUserId = friendship.requesterId;
        const friendUser = await ctx.db
          .query("users")
          .filter(q => q.eq(q.field("_id"), friendUserId))
          .first()
          .then(user => user ? {
            _id: user._id,
            username: user.username,
            name: user.name,
            profileImage: user.profileImage
          } : null);
          
        if (!friendUser) {
          return null;
        }
        
        return {
          friendship,
          user: friendUser,
        };
      })
    );

    // Filter out null values and return
    return {
      friendRequests: friendsWithDetails.filter(Boolean),
      cursor: friendships.continueCursor,
    };
  },
});

// Query to get the count of pending friend requests for the *authenticated* user
export const getMyPendingFriendRequestCount = query({
  args: {}, // No arguments needed, uses authenticated user context
  handler: async (ctx) => {
    // Use the getAuthUserId helper which handles finding the correct user ID
    const userId = await getAuthUserId(ctx);

    // If no user ID, user is not logged in or not found, so no pending requests
    if (userId === null) {
      return 0;
    }
    
    // First check pending requests where user is the requestee (recipient)
    const pendingRequestsAsRecipient = await ctx.db
      .query("friends")
      .withIndex("by_requestee", (q) =>
        q.eq("requesteeId", userId).eq("status", "pending")
      )
      .collect();
    
    // Check for "requested" status as well (in case a different term is used)
    const requestedRequests = await ctx.db
      .query("friends")
      .withIndex("by_requestee", (q) =>
        q.eq("requesteeId", userId).eq("status", "requested")
      )
      .collect();
    
    // Count both pending and requested status requests
    const totalPendingRequests = pendingRequestsAsRecipient.length + requestedRequests.length;
    
    return totalPendingRequests;
  },
});

/**
 * Lean SSR query that only fetches the friends count for initial page render.
 * 
 * This is optimized for SSR where we only need to display the count in the UI.
 * The actual friends data and profiles are fetched later when the drawer opens
 * using the optimized getFriendsByUsername query.
 * 
 * @param username - Username to get friends count for
 * @returns Just the count number, no profile data or friendship details
 */
export const getFriendsCountForSSR = query({
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
    
    // Count accepted friendships where this user is involved (either direction)
    // Use the by_users index for efficient counting
    const friendships = await ctx.db
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
      .collect();
      
    return friendships.length;
  },
});
