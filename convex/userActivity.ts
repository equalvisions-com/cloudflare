import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Type definitions for activity items
type ActivityBase = {
  type: "like" | "comment" | "retweet";
  timestamp: number;
  entryGuid: string;
  feedUrl: string;
  title?: string;
  link?: string;
  pubDate?: string;
};

type LikeActivity = ActivityBase & {
  type: "like";
  _id: string;
};

type CommentActivity = ActivityBase & {
  type: "comment";
  _id: string;
  content: string;
};

type RetweetActivity = ActivityBase & {
  type: "retweet";
  _id: string;
  retweetedAt: number;
};

type UserActivity = LikeActivity | CommentActivity | RetweetActivity;

/**
 * Query to get a user's activity feed (likes, comments, retweets)
 * with pagination support similar to RSS feed implementation
 */
export const getUserActivityFeed = query({
  args: {
    userId: v.id("users"),
    currentUserId: v.id("users"), // Required - always pass current user ID instead of calling getAuthUserId
    skip: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const currentUserId = args.currentUserId; // Use passed currentUserId instead of calling getAuthUserId
    const limit = args.limit || 30;
    const skip = args.skip || 0;
    
    // Fetch only user's comments and retweets (excluding likes)
    const [comments, retweets] = await Promise.all([
      ctx.db
        .query("comments")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter(q => q.eq(q.field("parentId"), undefined)) // Only include top-level comments (not replies)
        .collect(),
      
      ctx.db
        .query("retweets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ]);
    
    // Transform comments into activity items
    const commentActivities: CommentActivity[] = comments.map(comment => ({
      type: "comment",
      _id: comment._id.toString(),
      timestamp: comment.createdAt,
      entryGuid: comment.entryGuid,
      feedUrl: comment.feedUrl,
      content: comment.content,
    }));
    
    // Transform retweets into activity items
    const retweetActivities: RetweetActivity[] = retweets.map(retweet => ({
      type: "retweet",
      _id: retweet._id.toString(),
      timestamp: retweet.retweetedAt,
      entryGuid: retweet.entryGuid,
      feedUrl: retweet.feedUrl,
      title: retweet.title,
      link: retweet.link,
      pubDate: retweet.pubDate,
      retweetedAt: retweet.retweetedAt,
    }));
    
    // Combine all activities (excluding likes)
    const allActivities: UserActivity[] = [
      ...commentActivities,
      ...retweetActivities,
    ];
    
    // Sort by timestamp (newest first)
    allActivities.sort((a, b) => b.timestamp - a.timestamp);
    
    // Get total count
    const totalCount = allActivities.length;
    
    // Apply pagination
    const paginatedActivities = allActivities.slice(skip, skip + limit);
    
    // Check if there are more items
    const hasMore = skip + limit < totalCount;
    
    // Get comment replies for paginated comments (similar to getProfileActivityData)
    const paginatedComments = paginatedActivities.filter(activity => activity.type === "comment");
    const commentReplies = paginatedComments.length > 0 ? await Promise.all(
      paginatedComments.map(async comment => {
        const commentId = comment._id as unknown as Id<"comments">;
        
        // Get replies for this comment
        const replies = await ctx.db
          .query("comments")
          .withIndex("by_parent", q => q.eq("parentId", commentId))
          .order("asc")
          .collect();
        
        if (replies.length === 0) {
          return { commentId, replies: [] };
        }
        
        // Get user data for replies
        const userIds = [...new Set(replies.map(reply => reply.userId))];
        const users = await Promise.all(
          userIds.map(id => 
            ctx.db
              .query("users")
              .filter(q => q.eq(q.field("_id"), id))
              .first()
              .then(user => user ? {
                _id: user._id,
                username: user.username,
                name: user.name,
                profileImage: user.profileImage
              } : null)
          )
        );
        
        // Create user map
        const userMap = new Map();
        users.filter(Boolean).forEach(user => {
          if (user) userMap.set(user._id.toString(), user);
        });
        
        // Attach user data to replies
        const repliesWithUserData = replies.map(reply => ({
          ...reply,
          user: userMap.get(reply.userId.toString()) || null
        }));

        return { commentId, replies: repliesWithUserData };
      })
    ) : [];

    // Create a map of comment ID to replies for easy lookup
    const commentRepliesMap = Object.fromEntries(
      commentReplies.map(cr => [cr.commentId.toString(), cr.replies])
    );
    
    // Get comment like statuses for all comments and replies in paginated data
    const allCommentIds = [
      // Top-level comments
      ...paginatedComments.map(comment => comment._id as unknown as Id<"comments">),
      // All replies
      ...Object.values(commentRepliesMap).flat().map((reply: any) => reply._id)
    ].filter(Boolean);
    
    const commentLikesMap = allCommentIds.length > 0 ? await (async () => {
      // Use passed currentUserId instead of calling getAuthUserId
      // currentUserId is already defined in the handler scope
      
      // Get all likes for these comments
      const allLikes = await ctx.db
        .query("commentLikes")
        .withIndex("by_comment")
        .filter((q) => 
          q.or(...allCommentIds.map(id => q.eq(q.field("commentId"), id)))
        )
        .collect();
      
      // Count likes per comment
      const likesCountMap = new Map<string, number>();
      for (const like of allLikes) {
        const commentId = like.commentId.toString();
        likesCountMap.set(commentId, (likesCountMap.get(commentId) || 0) + 1);
      }
      
      // Check which comments the current user has liked
      const userLikedMap = new Map<string, boolean>();
      const userLikes = await ctx.db
        .query("commentLikes")
        .withIndex("by_user")
        .filter((q) => 
          q.and(
            q.eq(q.field("userId"), currentUserId),
            q.or(...allCommentIds.map(id => q.eq(q.field("commentId"), id)))
          )
        )
        .collect();
      
      for (const like of userLikes) {
        userLikedMap.set(like.commentId.toString(), true);
      }
      
      // Create results map
      const resultsMap = new Map();
      for (const commentId of allCommentIds) {
        const commentIdStr = commentId.toString();
        resultsMap.set(commentIdStr, {
          commentId,
          isLiked: !!userLikedMap.get(commentIdStr),
          count: likesCountMap.get(commentIdStr) || 0
        });
      }
      
      return Object.fromEntries(resultsMap);
    })() : {};
    
    // Add replies to comment activities
    const activitiesWithReplies = paginatedActivities.map(activity => {
      if (activity.type === "comment") {
        const replies = commentRepliesMap[activity._id.toString()] || [];
        return {
          ...activity,
          replies: replies
        };
      }
      return activity;
    });

    return {
      activities: activitiesWithReplies,
      totalCount,
      hasMore,
      commentReplies: commentRepliesMap,
      commentLikes: commentLikesMap
    };
  },
});

/**
 * Query to get a user's likes with pagination support
 */
export const getUserLikes = query({
  args: {
    userId: v.id("users"),
    skip: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const limit = args.limit || 30;
    const skip = args.skip || 0;
    
    // Fetch only the user's likes
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    // Transform likes into activity items
    const likeActivities: LikeActivity[] = likes.map(like => ({
      type: "like",
      _id: like._id.toString(),
      timestamp: like._creationTime,
      entryGuid: like.entryGuid,
      feedUrl: like.feedUrl,
      title: like.title,
      link: like.link,
      pubDate: like.pubDate,
    }));
    
    // Sort by timestamp (newest first)
    likeActivities.sort((a, b) => b.timestamp - a.timestamp);
    
    // Get total count
    const totalCount = likeActivities.length;
    
    // Apply pagination
    const paginatedLikes = likeActivities.slice(skip, skip + limit);
    
    // Check if there are more items
    const hasMore = skip + limit < totalCount;
    
    return {
      activities: paginatedLikes,
      totalCount,
      hasMore
    };
  },
});

/**
 * Query to get a user's bookmarks with pagination support
 */
export const getUserBookmarks = query({
  args: {
    userId: v.id("users"),
    skip: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const limit = args.limit || 30;
    const skip = args.skip || 0;
    
    // Fetch the user's bookmarks
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    
    // Transform bookmarks into items - only include the fields we need
    // This avoids returning entire documents
    const bookmarkItems = bookmarks.map((bookmark) => ({
      _id: bookmark._id.toString(),
      entryGuid: bookmark.entryGuid,
      feedUrl: bookmark.feedUrl,
      title: bookmark.title,
      link: bookmark.link,
      pubDate: bookmark.pubDate,
      bookmarkedAt: bookmark.bookmarkedAt,
      // Only include fields actually used by the bookmarks page components
    }));
    
    // Sort by timestamp (newest first)
    bookmarkItems.sort((a, b) => b.bookmarkedAt - a.bookmarkedAt);
    
    // Get total count
    const totalCount = bookmarkItems.length;
    
    // Apply pagination
    const paginatedBookmarks = bookmarkItems.slice(skip, skip + limit);
    
    // Check if there are more items
    const hasMore = skip + limit < totalCount;
    
    return {
      bookmarks: paginatedBookmarks,
      totalCount,
      hasMore
    };
  },
}); 