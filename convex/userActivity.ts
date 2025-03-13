import { query } from "./_generated/server";
import { v } from "convex/values";

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
    skip: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const limit = args.limit || 30;
    const skip = args.skip || 0;
    
    // Fetch all user's likes, comments, and retweets in a single batch
    const [likes, comments, retweets] = await Promise.all([
      ctx.db
        .query("likes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      
      ctx.db
        .query("comments")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      
      ctx.db
        .query("retweets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ]);
    
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
    
    // Combine all activities
    const allActivities: UserActivity[] = [
      ...likeActivities,
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
    
    return {
      activities: paginatedActivities,
      totalCount,
      hasMore
    };
  },
}); 