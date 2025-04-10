import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getFeaturedPosts = query({
  args: {},
  handler: async (ctx) => {
    // Query posts with isFeatured set to true
    const featuredPosts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("isFeatured"), true))
      .collect();
    
    return featuredPosts;
  },
});

// Optimized query that includes follow state for each post with randomized results
export const getFeaturedPostsWithFollowState = query({
  args: {
    limit: v.optional(v.number()),
    timestamp: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // Timestamp is just used to bust the cache, not used in the function
    const { limit = 5 } = args;
    
    // Get user authentication state
    const userId = await getAuthUserId(ctx);
    const isAuthenticated = !!userId;

    // Query all featured posts 
    const allFeaturedPosts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("isFeatured"), true))
      .collect();
    
    // Shuffle the posts (Fisher-Yates algorithm)
    for (let i = allFeaturedPosts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allFeaturedPosts[i], allFeaturedPosts[j]] = [allFeaturedPosts[j], allFeaturedPosts[i]];
    }
    
    // Take the requested number of posts
    const featuredPosts = allFeaturedPosts.slice(0, limit);
    
    // If not authenticated, return posts with auth state but no follow info
    if (!isAuthenticated) {
      return featuredPosts.map(post => ({
        ...post,
        isAuthenticated: false,
        isFollowing: false
      }));
    }
    
    // Get all follow states for these posts if user is authenticated
    const postIds = featuredPosts.map(post => post._id);
    
    // Query followings for the current user
    const followings = await ctx.db
      .query("following")
      .withIndex("by_user_post")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    
    // Filter locally for matching postIds
    const userFollowings = followings.filter(following => 
      postIds.includes(following.postId)
    );

    // Create a map of postId to follow state
    const followStates = userFollowings.reduce((acc, following) => {
      acc[following.postId] = true;
      return acc;
    }, {} as { [key: string]: boolean });
    
    // Add auth and follow state to each post
    return featuredPosts.map(post => ({
      ...post,
      isAuthenticated,
      isFollowing: followStates[post._id] || false
    }));
  }
});

// Combined query that fetches both featured posts for widget and trending data
export const getBatchedWidgetData = query({
  args: {
    featuredLimit: v.optional(v.number()),
    trendingLimit: v.optional(v.number()),
    timestamp: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // Timestamp is just used to bust the cache
    const { featuredLimit = 6, trendingLimit = 6 } = args;
    
    // Get user authentication state
    const userId = await getAuthUserId(ctx);
    const isAuthenticated = !!userId;

    // 1. Query all featured posts 
    const allFeaturedPosts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("isFeatured"), true))
      .collect();
    
    // Shuffle the posts (Fisher-Yates algorithm)
    for (let i = allFeaturedPosts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allFeaturedPosts[i], allFeaturedPosts[j]] = [allFeaturedPosts[j], allFeaturedPosts[i]];
    }
    
    // Split posts into two sets: one for the FeaturedPostsWidget (with follow state)
    // and another for the TrendingWidget (with RSS feed data)
    const featuredWidgetPosts = allFeaturedPosts.slice(0, featuredLimit);
    // Get different posts for the trending widget (ensuring no overlap)
    const remainingPosts = allFeaturedPosts.slice(featuredLimit);
    
    // If we don't have enough remaining posts, we'll need to reuse some
    let trendingWidgetPosts;
    if (remainingPosts.length >= trendingLimit) {
      trendingWidgetPosts = remainingPosts.slice(0, trendingLimit);
    } else {
      // Randomly select more posts from the first set to reach trendingLimit
      // This ensures different ordering even if we reuse posts
      const neededMore = trendingLimit - remainingPosts.length;
      const shuffledFirstSet = [...featuredWidgetPosts].sort(() => Math.random() - 0.5);
      trendingWidgetPosts = [...remainingPosts, ...shuffledFirstSet.slice(0, neededMore)];
    }
    
    // Get follow states if user is authenticated
    let followStates: { [key: string]: boolean } = {};
    if (isAuthenticated && userId) {
      const allPostIds = [...featuredWidgetPosts, ...trendingWidgetPosts].map(post => post._id);
      
      // Query followings for the current user
      const followings = await ctx.db
        .query("following")
        .withIndex("by_user_post")
        .filter(q => q.eq(q.field("userId"), userId))
        .collect();
      
      // Filter locally for matching postIds
      const userFollowings = followings.filter(following => 
        allPostIds.includes(following.postId)
      );
  
      // Create a map of postId to follow state
      followStates = userFollowings.reduce((acc, following) => {
        acc[following.postId] = true;
        return acc;
      }, {} as { [key: string]: boolean });
    }
    
    // Add auth and follow state to featured widget posts
    const featuredPostsWithFollowState = featuredWidgetPosts.map(post => ({
      ...post,
      isAuthenticated: !!isAuthenticated,
      isFollowing: followStates[post._id] || false
    }));
    
    // Add minimal data for trending widget posts (just need id, title, featuredImg, feedUrl for RSS query)
    const trendingPostsData = trendingWidgetPosts.map(post => ({
      _id: post._id,
      title: post.title,
      featuredImg: post.featuredImg,
      feedUrl: post.feedUrl,
      categorySlug: post.categorySlug,
      postSlug: post.postSlug,
      mediaType: post.mediaType
    }));
    
    // Return both datasets
    return {
      featuredPosts: featuredPostsWithFollowState,
      trendingPosts: trendingPostsData 
    };
  }
}); 