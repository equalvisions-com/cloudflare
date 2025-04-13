import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// New combined query function that fetches both entry metrics and post metadata
export const getFeedDataWithMetrics = query({
  args: {
    entryGuids: v.array(v.string()),
    feedUrls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Make userId optional - it can be null for unauthenticated requests
    const userId = await getAuthUserId(ctx).catch(() => null);

    // Run all queries in parallel for maximum efficiency
    const [likes, comments, retweets, bookmarks, posts] = await Promise.all([
      // Get all likes for the requested entries
      ctx.db
        .query("likes")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect(),

      // Get all comments for the requested entries
      ctx.db
        .query("comments")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect(),
        
      // Get all retweets for the requested entries
      ctx.db
        .query("retweets")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect(),
        
      // Get all bookmarks for the requested entries
      ctx.db
        .query("bookmarks")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect(),
        
      // Get all posts for the requested feed URLs
      ctx.db
        .query("posts")
        .withIndex("by_feedUrl")
        .filter((q) => 
          q.or(
            ...args.feedUrls.map(feedUrl => 
              q.eq(q.field("feedUrl"), feedUrl)
            )
          )
        )
        .collect()
    ]);

    // Process likes data
    const likeCountMap = new Map<string, number>();
    const userLikedSet = new Set<string>();
    
    for (const like of likes) {
      const count = likeCountMap.get(like.entryGuid) || 0;
      likeCountMap.set(like.entryGuid, count + 1);
      
      if (userId && like.userId === userId) {
        userLikedSet.add(like.entryGuid);
      }
    }

    // Process comments data
    const commentCountMap = new Map<string, number>();
    for (const comment of comments) {
      const count = commentCountMap.get(comment.entryGuid) || 0;
      commentCountMap.set(comment.entryGuid, count + 1);
    }
    
    // Process retweets data
    const retweetCountMap = new Map<string, number>();
    const userRetweetedSet = new Set<string>();
    
    for (const retweet of retweets) {
      const count = retweetCountMap.get(retweet.entryGuid) || 0;
      retweetCountMap.set(retweet.entryGuid, count + 1);
      
      if (userId && retweet.userId === userId) {
        userRetweetedSet.add(retweet.entryGuid);
      }
    }
    
    // Process bookmarks data
    const userBookmarkedSet = new Set<string>();
    
    for (const bookmark of bookmarks) {
      if (userId && bookmark.userId === userId) {
        userBookmarkedSet.add(bookmark.entryGuid);
      }
    }

    // Create a map of feed URLs to post metadata
    const postMetadataMap = new Map(
      posts.map(post => [
        post.feedUrl, 
        {
          title: post.title,
          featuredImg: post.featuredImg,
          mediaType: post.mediaType,
          postSlug: post.postSlug,
          categorySlug: post.categorySlug,
          verified: post.verified
        }
      ])
    );

    return {
      // Entry metrics for each entry guid
      entryMetrics: args.entryGuids.map(guid => ({
        guid,
        metrics: {
          likes: {
            isLiked: userId ? userLikedSet.has(guid) : false,
            count: likeCountMap.get(guid) || 0
          },
          comments: {
            count: commentCountMap.get(guid) || 0
          },
          retweets: {
            isRetweeted: userId ? userRetweetedSet.has(guid) : false,
            count: retweetCountMap.get(guid) || 0
          },
          bookmarks: {
            isBookmarked: userId ? userBookmarkedSet.has(guid) : false
          }
        }
      })),
      
      // Post metadata for each feed URL
      postMetadata: Array.from(postMetadataMap.entries()).map(([feedUrl, metadata]) => ({
        feedUrl,
        metadata
      }))
    };
  },
});

export const batchGetEntryData = query({
  args: {
    entryGuids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Make userId optional - it can be null for unauthenticated requests
    const userId = await getAuthUserId(ctx).catch(() => null);

    // Get all likes, comments, and retweets in parallel but within the same query
    const [likes, comments, retweets] = await Promise.all([
      // Get all likes for the requested entries
      ctx.db
        .query("likes")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect(),

      // Get all comments for the requested entries
      ctx.db
        .query("comments")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect(),
        
      // Get all retweets for the requested entries
      ctx.db
        .query("retweets")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect()
    ]);

    // Process likes data
    const likeCountMap = new Map<string, number>();
    const userLikedSet = new Set<string>();
    
    for (const like of likes) {
      const count = likeCountMap.get(like.entryGuid) || 0;
      likeCountMap.set(like.entryGuid, count + 1);
      
      if (userId && like.userId === userId) {
        userLikedSet.add(like.entryGuid);
      }
    }

    // Process comments data
    const commentCountMap = new Map<string, number>();
    for (const comment of comments) {
      const count = commentCountMap.get(comment.entryGuid) || 0;
      commentCountMap.set(comment.entryGuid, count + 1);
    }
    
    // Process retweets data
    const retweetCountMap = new Map<string, number>();
    const userRetweetedSet = new Set<string>();
    
    for (const retweet of retweets) {
      const count = retweetCountMap.get(retweet.entryGuid) || 0;
      retweetCountMap.set(retweet.entryGuid, count + 1);
      
      if (userId && retweet.userId === userId) {
        userRetweetedSet.add(retweet.entryGuid);
      }
    }

    // Return data for each entry in the same order as input guids
    return args.entryGuids.map(guid => ({
      likes: {
        isLiked: userId ? userLikedSet.has(guid) : false,
        count: likeCountMap.get(guid) || 0
      },
      comments: {
        count: commentCountMap.get(guid) || 0
      },
      retweets: {
        isRetweeted: userId ? userRetweetedSet.has(guid) : false,
        count: retweetCountMap.get(guid) || 0
      }
    }));
  },
});

// Lightweight query for entry metrics (likes, comment count) without full comment data
export const getEntryMetrics = query({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    // Make userId optional - it can be null for unauthenticated requests
    const userId = await getAuthUserId(ctx).catch(() => null);

    // Get likes, comments, and retweets counts in parallel
    const [likes, comments, retweets, bookmarks] = await Promise.all([
      ctx.db
        .query("likes")
        .withIndex("by_entry")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .collect(),
      ctx.db
        .query("comments")
        .withIndex("by_entry")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .collect(),
      ctx.db
        .query("retweets")
        .withIndex("by_entry")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .collect(),
      ctx.db
        .query("bookmarks")
        .withIndex("by_entry")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .collect()
    ]);

    // Check if user has liked
    const isLiked = userId ? likes.some(like => like.userId === userId) : false;
    
    // Check if user has retweeted
    const isRetweeted = userId ? retweets.some(retweet => retweet.userId === userId) : false;
    
    // Check if user has bookmarked
    const isBookmarked = userId ? bookmarks.some(bookmark => bookmark.userId === userId) : false;

    return {
      likes: {
        count: likes.length,
        isLiked
      },
      comments: {
        count: comments.length
      },
      retweets: {
        count: retweets.length,
        isRetweeted
      },
      bookmarks: {
        isBookmarked
      }
    };
  },
});

// Full entry data query including comments with user data
export const getEntryWithComments = query({
  args: {
    entryGuid: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Get all data in parallel
    const [likes, comments, retweets] = await Promise.all([
      ctx.db
        .query("likes")
        .withIndex("by_entry")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .collect(),
      ctx.db
        .query("comments")
        .withIndex("by_entry_time")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .order("desc")
        .collect(),
      ctx.db
        .query("retweets")
        .withIndex("by_entry")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .collect()
    ]);

    if (comments.length === 0) {
      return {
        likes: {
          count: likes.length,
          isLiked: userId ? likes.some(like => like.userId === userId) : false
        },
        comments: {
          count: 0,
          items: []
        },
        retweets: {
          count: retweets.length,
          isRetweeted: userId ? retweets.some(retweet => retweet.userId === userId) : false
        }
      };
    }

    // Get all unique user IDs from comments
    const userIds = new Set(comments.map(c => c.userId));
    
    // Fetch all user data in one query
    const users = await ctx.db
      .query("users")
      .filter((q) => 
        q.or(
          ...Array.from(userIds).map(id => 
            q.eq(q.field("_id"), id)
          )
        )
      )
      .collect();

    // Create a map for quick user lookup
    const userMap = new Map(users.map(u => [u._id, u]));

    return {
      likes: {
        count: likes.length,
        isLiked: userId ? likes.some(like => like.userId === userId) : false
      },
      comments: {
        count: comments.length,
        items: comments.map(comment => ({
          ...comment,
          user: userMap.get(comment.userId)
        }))
      },
      retweets: {
        count: retweets.length,
        isRetweeted: userId ? retweets.some(retweet => retweet.userId === userId) : false
      }
    };
  },
});

// Dedicated batch query for EntriesDisplay component
export const batchGetEntriesMetrics = query({
  args: {
    entryGuids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Make userId optional - it can be null for unauthenticated requests
    const userId = await getAuthUserId(ctx).catch(() => null);

    // Get all likes, comments, and retweets in parallel but within the same query
    const [likes, comments, retweets] = await Promise.all([
      // Get all likes for the requested entries
      ctx.db
        .query("likes")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect(),

      // Get all comments for the requested entries
      ctx.db
        .query("comments")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect(),
        
      // Get all retweets for the requested entries
      ctx.db
        .query("retweets")
        .withIndex("by_entry")
        .filter((q) => 
          q.or(
            ...args.entryGuids.map(guid => 
              q.eq(q.field("entryGuid"), guid)
            )
          )
        )
        .collect()
    ]);

    // Create maps for each interaction type
    const metricsMap = new Map();

    // Process all entries
    for (const entryGuid of args.entryGuids) {
      const entryLikes = likes.filter(like => like.entryGuid === entryGuid);
      const entryComments = comments.filter(comment => comment.entryGuid === entryGuid);
      const entryRetweets = retweets.filter(retweet => retweet.entryGuid === entryGuid);

      metricsMap.set(entryGuid, {
        likes: {
          count: entryLikes.length,
          isLiked: userId ? entryLikes.some(like => like.userId === userId) : false
        },
        comments: {
          count: entryComments.length
        },
        retweets: {
          count: entryRetweets.length,
          isRetweeted: userId ? entryRetweets.some(retweet => retweet.userId === userId) : false
        }
      });
    }

    return Array.from(metricsMap.entries()).map(([guid, metrics]) => metrics);
  },
}); 