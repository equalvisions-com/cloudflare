import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Function to get all posts for a specific media type
export const getPostsByMediaType = query({
  args: {
    mediaType: v.string(),
  },
  handler: async (ctx, { mediaType }) => {
    // Get posts of specific media type
    const posts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("mediaType"), mediaType))
      .collect();
    
    // Return only the fields needed for display, avoiding returning entire documents
    return posts.map(post => ({
      _id: post._id,
      _creationTime: post._creationTime,
      title: post.title,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug,
      category: post.category,
      featuredImg: post.featuredImg,
      mediaType: post.mediaType,
      feedUrl: post.feedUrl,
      verified: post.verified ?? false
    }));
  },
});

// Function for media type-based routing
export const getByMediaTypeAndSlug = query({
  args: {
    mediaType: v.string(),
    postSlug: v.string(),
  },
  handler: async (ctx, { mediaType, postSlug }) => {
    const post = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("mediaType"), mediaType))
      .filter((q) => q.eq(q.field("postSlug"), postSlug))
      .first();
    
    if (!post) return null;


    
    // Get follower count efficiently using the optimized SSR query
    const followerCount = await ctx.db
      .query("following")
      .withIndex("by_post", q => q.eq("postId", post._id))
      .collect()
      .then(records => records.length);

    // Return explicitly listed fields instead of spreading the whole post object
    return {
      _id: post._id,
      _creationTime: post._creationTime,
      title: post.title,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug,
      category: post.category,
      featuredImg: post.featuredImg,
      mediaType: post.mediaType,
      feedUrl: post.feedUrl,
      verified: post.verified ?? false, // Ensure consistency with other queries
      body: post.body, // Assuming body is needed here
      isFeatured: post.isFeatured, // Assuming this field might exist and be needed
      followerCount
    };
  },
});

export const getAllCategories = query({
  args: {},
  handler: async (ctx) => {
    // Query posts but only select the category fields we need
    const categoryData = await ctx.db
      .query("posts")
      .collect()
      .then(posts => posts.map(post => ({
        category: post.category,
        categorySlug: post.categorySlug
      })));
    
    // Create a unique set of categories
    const uniqueCategories = [];
    const seen = new Set();
    
    for (const item of categoryData) {
      const key = `${item.categorySlug}|${item.category}`;
      if (!seen.has(key) && item.category && item.categorySlug) {
        seen.add(key);
        uniqueCategories.push(item);
      }
    }
    
    return uniqueCategories;
  },
});

export const getPostsByFeedUrls = query({
  args: { feedUrls: v.array(v.string()) },
  handler: async (ctx, { feedUrls }) => {
    // Use a single query with OR conditions instead of multiple parallel queries
    const posts = await ctx.db
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
      
    // Return only the fields needed for display
    return posts.map(post => ({
      _id: post._id,
      title: post.title,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug,
      featuredImg: post.featuredImg,
      mediaType: post.mediaType,
      feedUrl: post.feedUrl,
      verified: post.verified ?? false
    }));
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
    
    // Optimize the results - only keep fields we need
    const optimizedPosts = matchingPosts.map(post => ({
      _id: post._id,
      _creationTime: post._creationTime,
      title: post.title,
      postSlug: post.postSlug,
      category: post.category,
      categorySlug: post.categorySlug,
      mediaType: post.mediaType,
      featuredImg: post.featuredImg,
      body: post.body.substring(0, 150), // Truncate body to 150 chars for preview
      feedUrl: post.feedUrl,
      verified: post.verified
    }));

    // Get follow states if authenticated
    let followStates: { [key: string]: boolean } = {};
    if (isAuthenticated) {
      const followings = await ctx.db
        .query("following")
        .withIndex("by_user_post")
        .filter(q => q.eq(q.field("userId"), userId))
        .collect();

      followStates = followings.reduce((acc: { [key: string]: boolean }, following) => {
        acc[following.postId] = true;
        return acc;
      }, {} as { [key: string]: boolean });
    }
    
    // Handle pagination
    const startIndex = cursor ? optimizedPosts.findIndex(p => p._id === cursor) + 1 : 0;
    const paginatedPosts = optimizedPosts.slice(startIndex, startIndex + limit + 1);
    
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

    // Return only the fields needed by consumers
    return posts.map(post => ({
      _id: post._id,
      title: post.title,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug,
      featuredImg: post.featuredImg,
      mediaType: post.mediaType,
      feedUrl: post.feedUrl,
      verified: post.verified ?? false
    }));
  },
});

/**
 * Fetch posts by feed URLs
 * Only return the fields needed by the bookmarks page components
 */
// Get all posts for SSE enrichment (when we don't know which feeds the entries are from)
export const getAllPostsForSSE = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .collect();
      
    // Return only the fields needed for SSE enrichment
    return posts.map(post => ({
      title: post.title,
      featuredImg: post.featuredImg,
      mediaType: post.mediaType,
      feedUrl: post.feedUrl,
      verified: post.verified ?? false,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug
    }));
  },
});

// Enterprise-grade: Get posts by specific domains (for SSE enrichment performance)
export const getPostsByDomains = query({
  args: { domains: v.array(v.string()) },
  handler: async (ctx, { domains }) => {
    if (!domains.length) return [];
    
    const posts = await ctx.db
      .query("posts")
      .collect();
      
    // Filter posts where feedUrl domain matches any of the requested domains
    const matchingPosts = posts.filter(post => {
      if (!post.feedUrl) return false;
      try {
        const postDomain = new URL(post.feedUrl).hostname;
        return domains.includes(postDomain);
      } catch {
        return false;
      }
    });
    
    // Return only the fields needed for SSE enrichment
    return matchingPosts.map(post => ({
      title: post.title,
      featuredImg: post.featuredImg,
      mediaType: post.mediaType,
      feedUrl: post.feedUrl,
      verified: post.verified ?? false,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug
    }));
  },
});

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
        
        // Filter results to only include fields needed by the BookmarksContent component
        // instead of returning entire post documents
        const filteredResults = results.map(post => ({
          feedUrl: post.feedUrl,
          title: post.title,
          featuredImg: post.featuredImg,
          mediaType: post.mediaType,
          categorySlug: post.categorySlug,
          postSlug: post.postSlug,
          verified: post.verified
        }));
        
        posts.push(...filteredResults);
      }
    }
    
    return posts;
  },
}); 