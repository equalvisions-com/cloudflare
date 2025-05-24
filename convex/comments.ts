import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Rate limiting constants for comments
const COMMENT_RATE_LIMITS = {
  PER_ENTRY_COOLDOWN: 5000,      // 5 seconds between comments on same entry
  REPLY_COOLDOWN: 2000,          // 2 seconds between replies
  BURST_LIMIT: 3,                // 3 comments max
  BURST_WINDOW: 30000,           // in 30 seconds
  REPLY_BURST_LIMIT: 5,          // 5 replies max in burst window
  HOURLY_LIMIT: 20,              // 20 comments per hour
  HOURLY_WINDOW: 3600000,        // 1 hour in milliseconds
};

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

    // 1. Per-entry cooldown check
    const cooldownTime = isReply ? 
      COMMENT_RATE_LIMITS.REPLY_COOLDOWN : 
      COMMENT_RATE_LIMITS.PER_ENTRY_COOLDOWN;

    const lastCommentOnEntry = await ctx.db
      .query("comments")
      .withIndex("by_entry_time", q => 
        q.eq("entryGuid", args.entryGuid)
      )
      .filter(q => q.eq(q.field("userId"), userId))
      .order("desc")
      .first();

    if (lastCommentOnEntry) {
      const timeSinceLastAction = Date.now() - lastCommentOnEntry._creationTime;
      if (timeSinceLastAction < cooldownTime) {
        const waitTime = Math.ceil((cooldownTime - timeSinceLastAction) / 1000);
        throw new Error(`Please wait ${waitTime} seconds before commenting again`);
      }
    }

    // 2. Burst protection
    const burstLimit = isReply ? 
      COMMENT_RATE_LIMITS.REPLY_BURST_LIMIT : 
      COMMENT_RATE_LIMITS.BURST_LIMIT;

    const burstCheck = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - COMMENT_RATE_LIMITS.BURST_WINDOW))
      .take(burstLimit + 1);

    if (burstCheck.length >= burstLimit) {
      const actionType = isReply ? "replies" : "comments";
      throw new Error(`Too many ${actionType} too quickly. Please slow down.`);
    }

    // 3. Hourly limit
    const hourlyCheck = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("_creationTime"), Date.now() - COMMENT_RATE_LIMITS.HOURLY_WINDOW))
      .take(COMMENT_RATE_LIMITS.HOURLY_LIMIT + 1);

    if (hourlyCheck.length >= COMMENT_RATE_LIMITS.HOURLY_LIMIT) {
      throw new Error("Hourly comment limit reached. Try again later.");
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
            profileImage: user.profileImage || user.image
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
            profileImage: user.profileImage || user.image
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
            profileImage: user.profileImage || user.image
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
      profileImage: user.profileImage || user.image
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
