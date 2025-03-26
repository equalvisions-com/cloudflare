import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// Define pagination validator inline
const paginationOptsValidator = {
  skip: v.optional(v.number()),
  limit: v.optional(v.number()),
};

// Check the friendship status between two users
export const getFriendshipStatus = query({
  args: {
    requesterId: v.id("users"),
    requesteeId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { requesterId, requesteeId } = args;

    // Check if a friendship already exists in either direction
    const sentRequest = await ctx.db
      .query("friends")
      .withIndex("by_users", (q) => 
        q.eq("requesterId", requesterId).eq("requesteeId", requesteeId)
      )
      .first();

    if (sentRequest) {
      return {
        exists: true,
        status: sentRequest.status,
        direction: "sent",
        friendshipId: sentRequest._id,
      };
    }

    // Check if there's a request from the other user
    const receivedRequest = await ctx.db
      .query("friends")
      .withIndex("by_users", (q) => 
        q.eq("requesterId", requesteeId).eq("requesteeId", requesterId)
      )
      .first();

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

    return getFriendshipStatus(ctx, {
      requesterId: userId,
      requesteeId: userId2,
    });
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

    // First get the user by username using the by_username index
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", username))
      .first();

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

    return getFriendshipStatus(ctx, {
      requesterId: userId,
      requesteeId: profileUserId,
    });
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
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const userId = user._id;
    
    // Count friendships where the user is the requester
    const sentFriendships = await ctx.db
      .query("friends")
      .withIndex("by_requester")
      .filter(q => q.eq(q.field("requesterId"), userId))
      .filter(q => status ? q.eq(q.field("status"), status) : true)
      .collect();
      
    // Count friendships where the user is the requestee
    const receivedFriendships = await ctx.db
      .query("friends")
      .withIndex("by_requestee")
      .filter(q => q.eq(q.field("requesteeId"), userId))
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
      .first();
    
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
    
    // Fetch user and profile information for each friend
    const friendsWithDetails = await Promise.all(
      friendships.map(async (friendship) => {
        const friendUserId = friendship.friendId;
        const friendUser = await ctx.db
          .query("users")
          .filter(q => q.eq(q.field("_id"), friendUserId))
          .first();
          
        if (!friendUser) {
          return null;
        }
        
        return {
          friendship,
          profile: friendUser,
        };
      })
    );
    
    // Filter out nulls
    const results = friendsWithDetails.filter(Boolean);
    
    return {
      friends: results,
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

    // Check if a friendship already exists
    const existingFriendship = await ctx.db
      .query("friends")
      .withIndex("by_users", (q) => 
        q.eq("requesterId", requesterId).eq("requesteeId", requesteeId)
      )
      .first();

    if (existingFriendship) {
      throw new Error("Friend request already sent");
    }

    // Check if there's a request from the other user
    const receivedRequest = await ctx.db
      .query("friends")
      .withIndex("by_users", (q) => 
        q.eq("requesterId", requesteeId).eq("requesteeId", requesterId)
      )
      .first();

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

    // Create a new friend request
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

    const friendship = await ctx.db.get(friendshipId);

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

    const friendship = await ctx.db.get(friendshipId);

    if (!friendship) {
      throw new Error("Friendship not found");
    }

    // Ensure the user is either the requester or requestee
    if (friendship.requesterId !== userId && friendship.requesteeId !== userId) {
      throw new Error("Not authorized to delete this friendship");
    }

    // Delete the friendship
    return ctx.db.delete(friendshipId);
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
    
    // Get user information
    const user = await ctx.db.get(userId);
    
    if (!user) {
      return { user: null, notifications: [] };
    }
    
    // Get all friend requests/acceptances involving this user within the last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    // Get friend requests received
    const receivedRequests = await ctx.db
      .query("friends")
      .withIndex("by_requestee", q => q.eq("requesteeId", userId).eq("status", "pending"))
      .filter(q => {
        // Use createdAt if updatedAt doesn't exist, and default to _creationTime as backup
        const timestamp = q.field("updatedAt");
        return q.or(
          q.gte(timestamp, thirtyDaysAgo),
          q.eq(q.field("updatedAt"), undefined)  // Include items without updatedAt field
        );
      })
      .collect();
      
    // Get friend requests accepted where user is the requester
    const acceptedSentRequests = await ctx.db
      .query("friends")
      .withIndex("by_requester", q => q.eq("requesterId", userId).eq("status", "accepted"))
      .filter(q => {
        // Use createdAt if updatedAt doesn't exist, and default to _creationTime as backup
        const timestamp = q.field("updatedAt");
        return q.or(
          q.gte(timestamp, thirtyDaysAgo),
          q.eq(q.field("updatedAt"), undefined)  // Include items without updatedAt field
        );
      })
      .collect();
      
    // Get friend requests accepted where user is the requestee
    const acceptedReceivedRequests = await ctx.db
      .query("friends")
      .withIndex("by_requestee", q => q.eq("requesteeId", userId).eq("status", "accepted"))
      .filter(q => {
        // Use createdAt if updatedAt doesn't exist, and default to _creationTime as backup
        const timestamp = q.field("updatedAt");
        return q.or(
          q.gte(timestamp, thirtyDaysAgo),
          q.eq(q.field("updatedAt"), undefined)  // Include items without updatedAt field
        );
      })
      .collect();
      
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
    
    // Fetch users individually but in parallel
    const userPromises = friendUserIds.map(friendId => 
      ctx.db
        .query("users")
        .filter(q => q.eq(q.field("_id"), friendId))
        .first()
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

    // Get friendship requests where status is "requested"
    const friendships = await ctx.db
      .query("friends")
      .withIndex("by_requestee", q => q.eq("requesteeId", requesteeId).eq("status", "requested"))
      .order("desc")
      .paginate({ cursor: cursor || null, numItems });

    // Fetch user information for each requesterId
    const friendsWithDetails = await Promise.all(
      friendships.page.map(async (friendship) => {
        const friendUserId = friendship.requesterId;
        const friendUser = await ctx.db
          .query("users")
          .filter(q => q.eq(q.field("_id"), friendUserId))
          .first();
          
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

// Get a user's friends (accepted friendship status)
export const getFriends = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find friendships where this user is the requester and status is "accepted"
    const asRequesterFriends = await ctx.db
      .query("friends")
      .withIndex("by_requester", (q) => 
        q.eq("requesterId", args.userId).eq("status", "accepted")
      )
      .collect();
    
    // Find friendships where this user is the requestee and status is "accepted"
    const asRequesteeFriends = await ctx.db
      .query("friends")
      .withIndex("by_requestee", (q) => 
        q.eq("requesteeId", args.userId).eq("status", "accepted")
      )
      .collect();
    
    // Combine results and fetch friend user details
    const friendships = [...asRequesterFriends, ...asRequesteeFriends];
    const friendIds = friendships.map(friendship => 
      friendship.requesterId.toString() === args.userId.toString() // Use toString() instead of equals
        ? friendship.requesteeId 
        : friendship.requesterId
    );
    
    // Get the details for all friends
    const friends = await Promise.all(
      friendIds.map(async (friendId) => {
        const user = await ctx.db.get(friendId);
        return user ? {
          _id: user._id,
          name: user.name || null,
          username: user.username || null,
          profileImage: user.profileImage || user.image || null,
        } : null;
      })
    );
    
    // Return only valid friends (filter out null values)
    return friends.filter(Boolean);
  },
});

// Get friend requests for a user
export const getFriendRequests = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find friendships where this user is the requestee and status is "pending"
    const requests = await ctx.db
      .query("friends")
      .withIndex("by_requestee", (q) => 
        q.eq("requesteeId", args.userId).eq("status", "pending")
      )
      .order("desc")
      .collect();
    
    // Get the details of the requesters
    const requestsWithUsers = await Promise.all(
      requests.map(async (request) => {
        const user = await ctx.db.get(request.requesterId);
        return user ? {
          _id: request._id,
          createdAt: request.createdAt,
          requester: {
            _id: user._id,
            name: user.name || null,
            username: user.username || null,
            profileImage: user.profileImage || user.image || null,
          }
        } : null;
      })
    );
    
    // Return only valid requests (filter out null values)
    return requestsWithUsers.filter(Boolean);
  },
});

// Get friend activities
export const getFriendActivities = query({
  args: {
    userId: v.id("users"),
    ...paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    console.log("getFriendActivities called with userId:", args.userId);
    
    try {
      // Get the user's friends
      const friends = await getFriends(ctx, { userId: args.userId });
      console.log(`Found ${friends.length} friends for user`);
      
      const friendIds = friends.filter(Boolean).map(friend => friend!._id);
      
      if (friendIds.length === 0) {
        console.log("No friends found, returning empty data");
        return { activityGroups: [], hasMore: false };
      }
      
      // Create an empty array to hold all activities
      const allActivities = [];
      const limit = args.limit || 30; // Default to 30 if undefined
      const skip = args.skip || 0;    // Default to 0 if undefined
      
      // Log friend IDs for debugging
      console.log("Fetching activities for friends:", friendIds.map(id => id.toString()));
      
      // Get likes from friends (with limit + 1 to check if there are more)
      const likes = await ctx.db
        .query("likes")
        .filter(q => friendIds.some(id => q.eq(q.field("userId"), id)))
        .order("desc")
        .take(limit + 1);
      
      console.log(`Found ${likes.length} likes from friends`);
      
      // Add likes to activities array
      for (const like of likes) {
        const user = await ctx.db.get(like.userId);
        if (user) {
          allActivities.push({
            type: "like",
            timestamp: like._creationTime,
            entryGuid: like.entryGuid,
            feedUrl: like.feedUrl,
            title: like.title,
            link: like.link,
            pubDate: like.pubDate,
            _id: like._id,
            userId: like.userId,
            username: user.username || "",
            userImage: user.profileImage || user.image || null,
            userName: user.name || user.username || "",
          });
        }
      }
      
      // Get comments from friends
      const comments = await ctx.db
        .query("comments")
        .filter(q => friendIds.some(id => q.eq(q.field("userId"), id)))
        .order("desc")
        .take(limit + 1);
      
      console.log(`Found ${comments.length} comments from friends`);
      
      // Add comments to activities array
      for (const comment of comments) {
        const user = await ctx.db.get(comment.userId);
        if (user) {
          allActivities.push({
            type: "comment",
            timestamp: comment.createdAt,
            entryGuid: comment.entryGuid,
            feedUrl: comment.feedUrl,
            content: comment.content,
            _id: comment._id,
            userId: comment.userId,
            username: comment.username,
            userImage: user.profileImage || user.image || null,
            userName: user.name || user.username || "",
          });
        }
      }
      
      // Get retweets from friends
      const retweets = await ctx.db
        .query("retweets")
        .filter(q => friendIds.some(id => q.eq(q.field("userId"), id)))
        .order("desc")
        .take(limit + 1);
      
      console.log(`Found ${retweets.length} retweets from friends`);
      
      // Add retweets to activities array
      for (const retweet of retweets) {
        const user = await ctx.db.get(retweet.userId);
        if (user) {
          allActivities.push({
            type: "retweet",
            timestamp: retweet.retweetedAt,
            entryGuid: retweet.entryGuid,
            feedUrl: retweet.feedUrl,
            title: retweet.title,
            link: retweet.link,
            pubDate: retweet.pubDate,
            _id: retweet._id,
            userId: retweet.userId,
            username: user.username || "",
            userImage: user.profileImage || user.image || null,
            userName: user.name || user.username || "",
          });
        }
      }
      
      console.log(`Total activities found: ${allActivities.length}`);
      
      // Sort all activities by timestamp (newest first)
      allActivities.sort((a, b) => b.timestamp - a.timestamp);
      
      // Apply pagination
      const paginatedActivities = allActivities.slice(skip, skip + limit);
      const hasMore = allActivities.length > skip + limit;
      
      // If no activities found, return empty result
      if (paginatedActivities.length === 0) {
        console.log("No activities found after pagination");
        return { activityGroups: [], hasMore: false };
      }
      
      // Group activities by entry
      const activityGroups = [];
      const groupedByEntry = new Map();
      
      for (const activity of paginatedActivities) {
        const entryKey = `${activity.entryGuid}:${activity.feedUrl}`;
        
        if (!groupedByEntry.has(entryKey)) {
          // Create a new group
          const group = {
            entryGuid: activity.entryGuid,
            feedUrl: activity.feedUrl,
            activities: [activity],
            entry: null as any,
            metrics: null as any,
          };
          
          groupedByEntry.set(entryKey, group);
          activityGroups.push(group);
        } else {
          // Add to existing group
          groupedByEntry.get(entryKey).activities.push(activity);
        }
      }
      
      console.log(`Created ${activityGroups.length} activity groups`);
      
      // Fetch entry details and metrics for each group
      await Promise.all(activityGroups.map(async (group) => {
        try {
          // Query MySQL for RSS entry details (using a Convex HTTP action would be needed)
          // For now, we'll use the first activity's data as a fallback
          const firstActivity = group.activities[0];
          group.entry = {
            guid: firstActivity.entryGuid,
            title: firstActivity.title || "",
            link: firstActivity.link || "",
            pub_date: firstActivity.pubDate || "",
            feed_url: firstActivity.feedUrl,
            image: null, // Add a default image field
          };
          
          // Get metrics for this entry
          // Use length instead of count() for likes
          const likes = await ctx.db
            .query("likes")
            .withIndex("by_entry", (q) => q.eq("entryGuid", group.entryGuid))
            .collect();
          const likeCount = likes.length;
          
          // Use length instead of count() for comments
          const comments = await ctx.db
            .query("comments")
            .withIndex("by_entry", (q) => q.eq("entryGuid", group.entryGuid))
            .collect();
          const commentCount = comments.length;
            
          // Use length instead of count() for retweets
          const retweets = await ctx.db
            .query("retweets")
            .withIndex("by_entry", (q) => q.eq("entryGuid", group.entryGuid))
            .collect();
          const retweetCount = retweets.length;
          
          // Check if current user has liked/retweeted
          const isLiked = await ctx.db
            .query("likes")
            .withIndex("by_user_entry", (q) => 
              q.eq("userId", args.userId).eq("entryGuid", group.entryGuid)
            )
            .unique() !== null;
            
          const isRetweeted = await ctx.db
            .query("retweets")
            .withIndex("by_user_entry", (q) => 
              q.eq("userId", args.userId).eq("entryGuid", group.entryGuid)
            )
            .unique() !== null;
          
          group.metrics = {
            likes: { isLiked, count: likeCount },
            comments: { count: commentCount },
            retweets: { isRetweeted, count: retweetCount },
          };
        } catch (err) {
          console.error("Error fetching entry details:", err);
          // Provide default metrics to avoid null values
          group.metrics = {
            likes: { isLiked: false, count: 0 },
            comments: { count: 0 },
            retweets: { isRetweeted: false, count: 0 },
          };
        }
      }));
      
      return { activityGroups, hasMore };
    } catch (error) {
      console.error("Error in getFriendActivities:", error);
      // Return empty result in case of error
      return { activityGroups: [], hasMore: false };
    }
  },
});

// Accept or reject a friend request
export const respondToFriendRequest = mutation({
  args: {
    requestId: v.id("friends"),   // The ID of the friend request
    accept: v.boolean(),          // Whether to accept or reject
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    
    if (!request) {
      return { success: false, message: "Friend request not found" };
    }
    
    const now = Date.now();
    
    if (args.accept) {
      // Accept the request
      await ctx.db.patch(args.requestId, {
        status: "accepted",
        updatedAt: now,
      });
      return { success: true, message: "Friend request accepted" };
    } else {
      // Reject by deleting the request
      await ctx.db.delete(args.requestId);
      return { success: true, message: "Friend request rejected" };
    }
  },
});

// Helper function to create a test friendship for development
export const createTestFriendship = mutation({
  args: {
    userId: v.id("users"),
    friendUsername: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the friend by username
    const potentialFriend = await ctx.db
      .query("users")
      .withIndex("by_username", q => q.eq("username", args.friendUsername))
      .unique();
    
    if (!potentialFriend) {
      throw new Error(`User with username "${args.friendUsername}" not found`);
    }
    
    // Check if there's already a friendship
    const existingFriendship = await ctx.db
      .query("friends")
      .withIndex("by_users", (q) => 
        q.eq("requesterId", args.userId).eq("requesteeId", potentialFriend._id)
      )
      .unique();
    
    // If friendship exists, return it
    if (existingFriendship) {
      return {
        success: true, 
        message: `Already have friendship with status: ${existingFriendship.status}`,
        friendship: existingFriendship
      };
    }
    
    // Create a test friendship (direct to accepted for testing)
    const now = Date.now();
    const friendshipId = await ctx.db.insert("friends", {
      requesterId: args.userId,
      requesteeId: potentialFriend._id,
      status: "accepted",
      createdAt: now,
      updatedAt: now
    });
    
    // Return success message
    return {
      success: true,
      message: `Created test friendship with ${args.friendUsername}`,
      friendship: {
        _id: friendshipId,
        requesterId: args.userId,
        requesteeId: potentialFriend._id,
        status: "accepted"
      }
    };
  }
});

// Helper function to create a test activity for development
export const createTestActivity = mutation({
  args: {
    userId: v.id("users"),
    activityType: v.union(v.literal("like"), v.literal("comment"), v.literal("retweet")),
    entryGuid: v.string(),
    feedUrl: v.string(),
    title: v.optional(v.string()),
    link: v.optional(v.string()),
    pubDate: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if the user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Current timestamp
    const now = Date.now();
    
    if (args.activityType === "like") {
      // Create a test like
      const likeId = await ctx.db.insert("likes", {
        userId: args.userId,
        entryGuid: args.entryGuid,
        feedUrl: args.feedUrl,
        title: args.title || "Test entry title",
        pubDate: args.pubDate || new Date().toISOString(),
        link: args.link || `https://example.com/entry/${args.entryGuid}`,
      });
      
      return { 
        success: true, 
        message: "Created test like activity",
        activityId: likeId
      };
    } 
    else if (args.activityType === "comment") {
      // Create a test comment
      const commentId = await ctx.db.insert("comments", {
        userId: args.userId,
        username: user.username || "testuser",
        entryGuid: args.entryGuid,
        feedUrl: args.feedUrl,
        content: args.content || "This is a test comment",
        createdAt: now,
      });
      
      return { 
        success: true, 
        message: "Created test comment activity",
        activityId: commentId
      };
    }
    else if (args.activityType === "retweet") {
      // Create a test retweet
      const retweetId = await ctx.db.insert("retweets", {
        userId: args.userId,
        entryGuid: args.entryGuid,
        feedUrl: args.feedUrl,
        title: args.title || "Test entry title",
        pubDate: args.pubDate || new Date().toISOString(),
        link: args.link || `https://example.com/entry/${args.entryGuid}`,
        retweetedAt: now,
      });
      
      return { 
        success: true, 
        message: "Created test retweet activity",
        activityId: retweetId
      };
    }
    
    throw new Error("Invalid activity type");
  }
}); 