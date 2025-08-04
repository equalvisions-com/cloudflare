import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { actionLimiter } from "./rateLimiters";

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

    const isReply = !!args.parentId;

    // Get the user to get their username
    const user = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("_id"), userId))
      .first()
      .then((user: any) => user ? {
        username: user.username || user.name || "Guest"
      } : null);
      
    if (!user) throw new Error("User not found");
    const username = user.username;

    // Validate content
    const content = args.content.trim();
    if (!content) throw new Error("Comment cannot be empty");
    if (content.length > 500) throw new Error("Comment too long (max 500 characters)");

    // Basic content sanitization
    const sanitizedContent = content.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

    // Check rate limits before any database operations
    // 1. Burst limit (5 comments in 30 seconds)
    const burstResult = await actionLimiter.limit(ctx, "commentsBurst", { key: userId });
    if (!burstResult.ok) {
      throw new Error("Too many comments too quickly. Please slow down.");
    }

    // 2. Hourly limit (20 comments per hour)
    const hourlyResult = await actionLimiter.limit(ctx, "commentsHourly", { key: userId });
    if (!hourlyResult.ok) {
      throw new Error("Hourly comment limit reached. Try again later.");
    }

    // 3. Daily limit (100 comments per day)
    const dailyResult = await actionLimiter.limit(ctx, "commentsDaily", { key: userId });
    if (!dailyResult.ok) {
      throw new Error("Daily comment limit reached. Try again tomorrow.");
    }

    // 4. If this is a reply, verify parent exists and belongs to same entry
    if (args.parentId) {
      const parent = await ctx.db
        .query("comments")
        .filter((q: any) => q.eq(q.field("_id"), args.parentId))
        .first()
        .then((comment: any) => comment ? {
          _id: comment._id,
          entryGuid: comment.entryGuid
        } : null);
        
      if (!parent) throw new Error("Parent comment not found");
      if (parent.entryGuid !== args.entryGuid) {
        throw new Error("Parent comment belongs to different entry");
      }
    }

    // All rate limit checks passed - create the comment
    const commentId = await ctx.db.insert("comments", {
      userId,
      username,
      entryGuid: args.entryGuid,
      feedUrl: args.feedUrl,
      content: sanitizedContent,
      createdAt: Date.now(),
      parentId: args.parentId,
    });

    return { action: "created", commentId };
  },
});

export const deleteComment = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const comment = await ctx.db
      .query("comments")
      .filter((q: any) => q.eq(q.field("_id"), args.commentId))
      .first()
      .then((comment: any) => comment ? {
        _id: comment._id,
        userId: comment.userId
      } : null);
      
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
        .filter((q: any) => q.eq(q.field("parentId"), commentId))
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
    // Get only the necessary comment fields
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_entry_time")
      .filter(q => q.eq(q.field("entryGuid"), args.entryGuid))
      .order("desc")
      .collect()
      .then(comments => comments.map(comment => ({
        _id: comment._id,
        _creationTime: comment._creationTime,
        userId: comment.userId,
        feedUrl: comment.feedUrl,
        parentId: comment.parentId,
        content: comment.content,
        createdAt: comment.createdAt,
        username: comment.username,
        entryGuid: comment.entryGuid
      })));
    
    if (comments.length === 0) return [];
    
    // Get all unique user IDs
    const userIds = [...new Set(comments.map(c => c.userId))];
    
    // Get only the necessary user fields
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
    
    // Create a map of userId to formatted user data
    const userMap = new Map();
    users.filter(Boolean).forEach(user => {
      if (user) userMap.set(user._id.toString(), {
        userId: user._id,
        username: user.username,
        name: user.name,
        profileImage: user.profileImage
      });
    });
    
    // Add user data to each comment with only required fields
    return comments.map(comment => ({
      _id: comment._id,
      _creationTime: comment._creationTime,
      userId: comment.userId,
      feedUrl: comment.feedUrl,
      parentId: comment.parentId,
      content: comment.content,
      createdAt: comment.createdAt,
      username: comment.username,
      entryGuid: comment.entryGuid,
      user: userMap.get(comment.userId.toString())
    }));
  },
});

// Define the type for a comment with user data
type CommentWithUser = {
  _id: Id<"comments">;
  _creationTime?: number;
  parentId?: Id<"comments">;
  userId: Id<"users">;
  feedUrl?: string;
  username: string;
  entryGuid: string;
  content: string;
  createdAt: number;
  user?: {
    userId: Id<"users">;
    username: string;
    name?: string;
    profileImage?: string;
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
      .collect()
      .then(comments => comments.map(comment => ({
        _id: comment._id,
        _creationTime: comment._creationTime,
        userId: comment.userId,
        feedUrl: comment.feedUrl,
        parentId: comment.parentId,
        content: comment.content,
        createdAt: comment.createdAt,
        username: comment.username,
        entryGuid: comment.entryGuid
      })));

    if (comments.length === 0) {
      return args.entryGuids.map(() => []);
    }

    // Get all unique user IDs
    const userIds = [...new Set(comments.map(c => c.userId))];
    
    // Fetch only the necessary user fields
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
    
    // Create a map for quick user lookup with properly formatted user data
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

    // Group comments by entryGuid
    const commentsByEntry = new Map<string, CommentWithUser[]>();
    for (const comment of comments) {
      const entryComments = commentsByEntry.get(comment.entryGuid) || [];
      const commentWithUser: CommentWithUser = {
        _id: comment._id,
        _creationTime: comment._creationTime,
        userId: comment.userId,
        feedUrl: comment.feedUrl,
        parentId: comment.parentId,
        content: comment.content,
        createdAt: comment.createdAt,
        username: comment.username,
        entryGuid: comment.entryGuid,
        user: userMap.get(comment.userId.toString())
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
    // Get only the necessary reply fields
    const replies = await ctx.db
      .query("comments")
      .withIndex("by_parent")
      .filter(q => q.eq(q.field("parentId"), args.commentId))
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
    
    if (replies.length === 0) return [];
    
    // Get all unique user IDs
    const userIds = [...new Set(replies.map(c => c.userId))];
    
    // Get only the necessary user fields
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
    
    // Create a map of userId to formatted user data
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
    
    // Add user data to each reply with only required fields
    return replies.map(reply => ({
      _id: reply._id,
      _creationTime: reply._creationTime,
      userId: reply.userId,
      feedUrl: reply.feedUrl,
      parentId: reply.parentId,
      content: reply.content,
      createdAt: reply.createdAt,
      username: reply.username,
      entryGuid: reply.entryGuid,
      user: userMap.get(reply.userId.toString())
    }));
  },
});

// Helper function to get user data for comments
async function getUserDataForComment(ctx: any, commentId: Id<"comments">) {
  // Get comment with field filtering
  const comment = await ctx.db
    .query("comments")
    .filter((q: any) => q.eq(q.field("_id"), commentId))
    .first()
    .then((comment: any) => comment ? {
      _id: comment._id,
      _creationTime: comment._creationTime,
      userId: comment.userId,
      feedUrl: comment.feedUrl,
      parentId: comment.parentId,
      content: comment.content,
      createdAt: comment.createdAt,
      username: comment.username,
      entryGuid: comment.entryGuid
    } : null);
    
  if (!comment) return null;
  
  // Get user with field filtering
  const user = await ctx.db
    .query("users")
    .filter((q: any) => q.eq(q.field("_id"), comment.userId))
    .first()
    .then((user: any) => user ? {
      _id: user._id,
      username: user.username || user.name || "Guest",
      name: user.name,
      profileImage: user.profileImage
    } : null);
  
  return {
    _id: comment._id,
    _creationTime: comment._creationTime,
    userId: comment.userId,
    feedUrl: comment.feedUrl,
    parentId: comment.parentId,
    content: comment.content,
    createdAt: comment.createdAt,
    username: comment.username,
    entryGuid: comment.entryGuid,
    user: user ? {
      userId: user._id,
      username: user.username,
      name: user.name,
      profileImage: user.profileImage
    } : undefined
  };
}
