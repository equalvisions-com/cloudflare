import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getBySlug = query({
  args: {
    categorySlug: v.string(),
    postSlug: v.string(),
  },
  handler: async (ctx, { categorySlug, postSlug }) => {
    const post = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("categorySlug"), categorySlug))
      .filter((q) => q.eq(q.field("postSlug"), postSlug))
      .first();
    
    if (!post) return null;

    // Get related posts from same category (excluding current post)
    const relatedPosts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("categorySlug"), categorySlug))
      .filter((q) => q.neq(q.field("postSlug"), postSlug))
      .order("desc")
      .take(5);
    
    // Get follower count in same query
    const followerCount = (await ctx.db
      .query("following")
      .withIndex("by_post", q => q.eq("postId", post._id))
      .collect()).length;

    return {
      ...post,
      relatedPosts: relatedPosts.map((p: typeof post) => ({
        _id: p._id,
        title: p.title,
        featuredImg: p.featuredImg,
        postSlug: p.postSlug,
        categorySlug: p.categorySlug,
        feedUrl: p.feedUrl
      })),
      followerCount
    };
  },
});

export const getPostsByCategory = query({
  args: {
    categorySlug: v.string(),
  },
  handler: async (ctx, { categorySlug }) => {
    const posts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("categorySlug"), categorySlug))
      .collect();
    
    return posts;
  },
});

export const getAllCategories = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("posts").collect();
    const uniqueCategories = [...new Set(posts.map(post => ({
      category: post.category,
      categorySlug: post.categorySlug
    })))];
    
    return uniqueCategories;
  },
});

export const getPostsByFeedUrls = query({
  args: { feedUrls: v.array(v.string()) },
  handler: async (ctx, { feedUrls }) => {
    // Use a single query with OR conditions instead of multiple parallel queries
    return ctx.db
      .query("posts")
      .withIndex("by_feedUrl")
      .filter((q) => 
        q.or(
          ...feedUrls.map(feedUrl => 
            q.eq(q.field("feedUrl"), feedUrl)
          )
        )
      )
      .collect();
  },
});

export const searchPosts = query({
  args: { 
    query: v.string(),
    mediaType: v.string(),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { query, mediaType, cursor, limit = 10 } = args;
    
    // Get user authentication state (but don't require it)
    const userId = await getAuthUserId(ctx).catch(() => null);
    const isAuthenticated = !!userId;

    // Create a case-insensitive regex pattern
    const searchPattern = new RegExp(query, 'i');

    // Get all posts for the media type first
    const allPosts = await ctx.db
      .query("posts")
      .filter(q => q.eq(q.field("mediaType"), mediaType))
      .collect();

    // Filter posts by title and body using regex
    const matchingPosts = allPosts.filter(post => 
      searchPattern.test(post.title) || searchPattern.test(post.body)
    );

    // Get follow states if authenticated
    let followStates: { [key: string]: boolean } = {};
    if (isAuthenticated) {
      const followings = await ctx.db
        .query("following")
        .withIndex("by_user_post")
        .filter(q => q.eq(q.field("userId"), userId))
        .collect();

      followStates = followings.reduce((acc, following) => {
        acc[following.postId] = true;
        return acc;
      }, {} as { [key: string]: boolean });
    }
    
    // Handle pagination
    const startIndex = cursor ? matchingPosts.findIndex(p => p._id === cursor) + 1 : 0;
    const paginatedPosts = matchingPosts.slice(startIndex, startIndex + limit + 1);
    
    // Check if there are more posts
    const hasMore = paginatedPosts.length > limit;
    
    // Add auth states to posts
    const postsWithState = paginatedPosts.slice(0, limit).map(post => ({
      ...post,
      isAuthenticated,
      isFollowing: followStates[post._id] || false
    }));
    
    // Return only the requested number of posts
    return {
      posts: postsWithState,
      hasMore,
      nextCursor: hasMore && paginatedPosts.length > 0 ? paginatedPosts[limit - 1]._id : null
    };
  },
});

export const getByTitles = query({
  args: { titles: v.array(v.string()) },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .filter(q => 
        q.or(...args.titles.map(title => q.eq(q.field("title"), title)))
      )
      .collect();

    return posts;
  },
});

/**
 * Fetch posts by feed URLs
 */
export const getByFeedUrls = query({
  args: {
    feedUrls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { feedUrls } = args;
    
    if (!feedUrls.length) {
      return [];
    }
    
    const posts = [];
    
    // Process in batches to avoid query limits
    const batchSize = 30;
    for (let i = 0; i < feedUrls.length; i += batchSize) {
      const batch = feedUrls.slice(i, i + batchSize);
      
      // Process each feed URL individually
      for (const feedUrl of batch) {
        const results = await ctx.db
          .query("posts")
          .withIndex("by_feedUrl", (q) => q.eq("feedUrl", feedUrl))
          .collect();
        
        posts.push(...results);
      }
    }
    
    return posts;
  },
}); 