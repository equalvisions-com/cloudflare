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
        .collect()
        .then(results => results.map(like => ({
          entryGuid: like.entryGuid,
          userId: like.userId
        }))),

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
        .collect()
        .then(results => results.map(comment => ({
          entryGuid: comment.entryGuid
        }))),
        
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
        .then(results => results.map(retweet => ({
          entryGuid: retweet.entryGuid,
          userId: retweet.userId
        }))),
        
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
        .collect()
        .then(results => results.map(bookmark => ({
          entryGuid: bookmark.entryGuid,
          userId: bookmark.userId
        }))),
        
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
        .then(posts => posts.map(post => ({
          feedUrl: post.feedUrl,
          title: post.title,
          featuredImg: post.featuredImg,
          mediaType: post.mediaType,
          postSlug: post.postSlug,
          categorySlug: post.categorySlug,
          verified: post.verified
        })))
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
      // Get all likes for the requested entries, selecting only fields we need
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
        .collect()
        .then(results => results.map(like => ({
          entryGuid: like.entryGuid,
          userId: like.userId
        }))),

      // Get all comments for the requested entries, selecting only count
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
        .collect()
        .then(results => results.map(comment => ({
          entryGuid: comment.entryGuid
        }))),
        
      // Get all retweets for the requested entries, selecting only fields we need
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
        .then(results => results.map(retweet => ({
          entryGuid: retweet.entryGuid,
          userId: retweet.userId
        })))
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
        .collect()
        .then(likes => likes.map(like => ({
          _id: like._id,
          userId: like.userId
        }))),
      ctx.db
        .query("comments")
        .withIndex("by_entry_time")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .order("desc")
        .collect()
        .then(comments => comments.map(comment => ({
          _id: comment._id,
          _creationTime: comment._creationTime,
          userId: comment.userId,
          feedUrl: comment.feedUrl,
          content: comment.content,
          createdAt: comment.createdAt,
          parentId: comment.parentId,
          username: comment.username,
          entryGuid: comment.entryGuid
        }))),
      ctx.db
        .query("retweets")
        .withIndex("by_entry")
        .filter((q) => q.eq(q.field("entryGuid"), args.entryGuid))
        .collect()
        .then(retweets => retweets.map(retweet => ({
          userId: retweet.userId
        })))
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
    
    // Fetch only required user fields in one query
    const users = await Promise.all(
      Array.from(userIds).map(id => 
        ctx.db
          .query("users")
          .filter(q => q.eq(q.field("_id"), id))
          .first()
          .then(user => user ? {
            _id: user._id,
            username: user.username,
            name: user.name,
            profileImage: user.profileImage || user.image
          } : null)
      )
    );

    // Create a map for quick user lookup
    const userMap = new Map();
    users.filter(Boolean).forEach(user => {
      if (user) userMap.set(user._id.toString(), user);
    });

    return {
      likes: {
        count: likes.length,
        isLiked: userId ? likes.some(like => like.userId === userId) : false
      },
      comments: {
        count: comments.length,
        items: comments.map(comment => {
          const user = userMap.get(comment.userId.toString());
          return {
            _id: comment._id,
            _creationTime: comment._creationTime,
            userId: comment.userId,
            feedUrl: comment.feedUrl,
            content: comment.content,
            createdAt: comment.createdAt,
            username: comment.username,
            parentId: comment.parentId,
            user: user ? {
              _id: user._id,
              username: user.username,
              name: user.name,
              profileImage: user.profileImage
            } : null
          };
        })
      },
      retweets: {
        count: retweets.length,
        isRetweeted: userId ? retweets.some(retweet => retweet.userId === userId) : false
      }
    };
  },
});

// Dedicated batch query for EntriesDisplay component
// Optimized to only return the metrics needed for bookmarks display
export const batchGetEntriesMetrics = query({
  args: {
    entryGuids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Make userId optional - it can be null for unauthenticated requests
    const userId = await getAuthUserId(ctx).catch(() => null);

    // Get all likes, comments, and retweets in parallel but within the same query
    // Extract only the specific fields we need instead of entire documents
    const [likeResults, commentResults, retweetResults] = await Promise.all([
      // Get only entryGuid and userId fields from likes for the requested entries
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
        .collect()
        .then(likes => likes.map(like => ({
          entryGuid: like.entryGuid,
          userId: like.userId
        }))),

      // Get only the count of comments for each entry guid
      Promise.all(args.entryGuids.map(guid => 
        ctx.db
          .query("comments")
          .withIndex("by_entry", q => q.eq("entryGuid", guid))
          .collect()
          .then(comments => ({
            entryGuid: guid,
            count: comments.length
          }))
      )),
        
      // Get only entryGuid and userId fields from retweets for the requested entries
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
        .then(retweets => retweets.map(retweet => ({
          entryGuid: retweet.entryGuid,
          userId: retweet.userId
        })))
    ]);

    // Build comment counts map for faster lookup
    const commentCountMap = new Map();
    commentResults.forEach(result => {
      commentCountMap.set(result.entryGuid, result.count);
    });

    // Create a map for storing the metrics for each entry guid
    const metricsMap = new Map();

    // Process all entries and return only the required metrics fields
    // instead of entire documents
    for (const entryGuid of args.entryGuids) {
      const entryLikes = likeResults.filter(like => like.entryGuid === entryGuid);
      const entryRetweets = retweetResults.filter(retweet => retweet.entryGuid === entryGuid);
      const commentCount = commentCountMap.get(entryGuid) || 0;

      metricsMap.set(entryGuid, {
        likes: {
          count: entryLikes.length,
          isLiked: userId ? entryLikes.some(like => like.userId && like.userId.toString() === userId.toString()) : false
        },
        comments: {
          count: commentCount
        },
        retweets: {
          count: entryRetweets.length,
          isRetweeted: userId ? entryRetweets.some(retweet => retweet.userId && retweet.userId.toString() === userId.toString()) : false
        }
      });
    }

    return Array.from(metricsMap.entries()).map(([guid, metrics]) => metrics);
  },
}); 