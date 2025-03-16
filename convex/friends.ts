import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

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

// Get friendship status by profile ID (for UI display)
export const getFriendshipStatusByProfileId = query({
  args: {
    profileId: v.id("profiles"),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { profileId, currentUserId } = args;

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

    // Get profile to get the userId
    const profile = await ctx.db.get(profileId);
    
    if (!profile) {
      throw new Error("Profile not found");
    }

    const profileUserId = profile.userId;

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

    // First get the profile by username
    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("username"), username))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    const profileUserId = profile.userId;

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

    // Get friendships where the user is the requester
    let sentFriendships = await ctx.db
      .query("friends")
      .withIndex("by_requester", (q) => q.eq("requesterId", currentUserId))
      .collect();

    // Get friendships where the user is the requestee
    let receivedFriendships = await ctx.db
      .query("friends")
      .withIndex("by_requestee", (q) => q.eq("requesteeId", currentUserId))
      .collect();

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