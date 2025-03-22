import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

export const addComment = mutation({
  args: {
    entryGuid: v.string(),
    feedUrl: v.string(),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the user to get their username
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Use username or name or default to "Guest"
    const username = user.username || user.name || "Guest";

    // Validate content - updated to match client-side limits
    const content = args.content.trim();
    if (!content) throw new Error("Comment cannot be empty");
    if (content.length > 500) throw new Error("Comment too long (max 500 characters)");

    // Basic content sanitization - remove control characters
    const sanitizedContent = content.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Check for rate limiting (max 5 comments per minute)
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const recentComments = await ctx.db
      .query("comments")
      .filter(q => q.eq(q.field("userId"), userId))
      .filter(q => q.gt(q.field("createdAt"), oneMinuteAgo))
      .collect();
    
    if (recentComments.length >= 5) {
      throw new Error("Rate limit exceeded. Please try again in a minute.");
    }

    // If this is a reply, verify parent exists
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) throw new Error("Parent comment not found");
      if (parent.entryGuid !== args.entryGuid) {
        throw new Error("Parent comment belongs to different entry");
      }
    }

    // Create the comment
    const commentId = await ctx.db.insert("comments", {
      userId,
      username, // Use the username from the user table
      entryGuid: args.entryGuid,
      feedUrl: args.feedUrl,
      content: sanitizedContent,
      createdAt: Date.now(),
      parentId: args.parentId,
    });

    return commentId;
  },
});

export const deleteComment = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    
    // Only the comment author can delete it
    if (comment.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: You can only delete your own comments");
    }
    
    // Define a recursive function to delete all replies
    const deleteReplies = async (commentId: Id<"comments">) => {
      const replies = await ctx.db
        .query("comments")
        .withIndex("by_parent")
        .filter(q => q.eq(q.field("parentId"), commentId))
        .collect();
      
      // Recursively delete all replies
      for (const reply of replies) {
        await deleteReplies(reply._id);
        await ctx.db.delete(reply._id);
      }
    };
    
    // Delete all replies first
    await deleteReplies(args.commentId);
    
    // Finally delete the comment itself
    await ctx.db.delete(args.commentId);
    
    return { success: true };
  },
});

export const getComments = query({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_entry_time")
      .filter(q => q.eq(q.field("entryGuid"), args.entryGuid))
      .order("desc")
      .collect();
    
    if (comments.length === 0) return [];
    
    // Get all unique user IDs
    const userIds = [...new Set(comments.map(c => c.userId))];
    
    // Get user data for all comments
    const users = await Promise.all(userIds.map(id => ctx.db.get(id)));
    
    // Create a map of userId to formatted user data
    const userMap = new Map();
    users.forEach(user => {
      if (user) {
        userMap.set(user._id.toString(), {
          userId: user._id,
          username: user.username || user.name || "Guest",
          name: user.name,
          profileImage: user.profileImage || user.image
        });
      }
    });
    
    // Add user data to each comment
    return comments.map(comment => ({
      ...comment,
      user: userMap.get(comment.userId.toString()),
    }));
  },
});

// Define the type for a comment with user data
type CommentWithUser = {
  _id: Id<"comments">;
  _creationTime: number;
  parentId?: Id<"comments">;
  feedUrl: string;
  userId: Id<"users">;
  username: string;
  entryGuid: string;
  content: string;
  createdAt: number;
  user?: {
    userId: Id<"users">;
    username: string;
    name?: string;
    profileImage?: string;
    [key: string]: unknown;
  };
};

export const batchGetComments = query({
  args: {
    entryGuids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all comments for the requested entries in a single query
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_entry_time")
      .filter((q) => 
        q.or(
          ...args.entryGuids.map(guid => 
            q.eq(q.field("entryGuid"), guid)
          )
        )
      )
      .order("desc")
      .collect();

    if (comments.length === 0) {
      return args.entryGuids.map(() => []);
    }

    // Get all unique user IDs
    const userIds = [...new Set(comments.map(c => c.userId))];
    
    // Fetch all users data directly
    const users = await Promise.all(userIds.map(id => ctx.db.get(id)));
    
    // Create a map for quick user lookup with properly formatted user data
    const userMap = new Map();
    users.forEach(user => {
      if (user) {
        userMap.set(user._id.toString(), {
          userId: user._id,
          username: user.username || user.name || "Guest",
          name: user.name,
          profileImage: user.profileImage || user.image
        });
      }
    });

    // Group comments by entryGuid
    const commentsByEntry = new Map<string, CommentWithUser[]>();
    for (const comment of comments) {
      const entryComments = commentsByEntry.get(comment.entryGuid) || [];
      const commentWithUser: CommentWithUser = {
        ...comment,
        user: userMap.get(comment.userId.toString()),
      };
      entryComments.push(commentWithUser);
      commentsByEntry.set(comment.entryGuid, entryComments);
    }

    // Return comments for each requested entryGuid in order
    return args.entryGuids.map(guid => 
      commentsByEntry.get(guid) || []
    );
  },
});

export const getCommentReplies = query({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const replies = await ctx.db
      .query("comments")
      .withIndex("by_parent")
      .filter(q => q.eq(q.field("parentId"), args.commentId))
      .order("asc") // Oldest first for replies
      .collect();
    
    if (replies.length === 0) return [];
    
    // Get all unique user IDs
    const userIds = [...new Set(replies.map(c => c.userId))];
    
    // Get user data for all replies
    const users = await Promise.all(userIds.map(id => ctx.db.get(id)));
    
    // Create a map of userId to formatted user data
    const userMap = new Map();
    users.forEach(user => {
      if (user) {
        userMap.set(user._id.toString(), {
          userId: user._id,
          username: user.username || user.name || "Guest",
          name: user.name,
          profileImage: user.profileImage || user.image
        });
      }
    });
    
    // Add user data to each reply
    return replies.map(reply => ({
      ...reply,
      user: userMap.get(reply.userId.toString()),
    }));
  },
});

// Helper function to get user data for comments
async function getUserDataForComment(ctx: any, commentId: Id<"comments">) {
  const comment = await ctx.db.get(commentId);
  if (!comment) return null;
  
  const user = await ctx.db.get(comment.userId);
  
  return {
    ...comment,
    user: user ? {
      userId: user._id,
      username: user.username || user.name || "Guest",
      name: user.name,
      profileImage: user.profileImage || user.image
    } : undefined
  };
} 