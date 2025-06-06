// convex/rssKeys.ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

// Query to get user's RSS keys
export const getUserRSSKeys = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(user => user ? {
        rssKeys: user.rssKeys || []
      } : null);
      
    return user ? user.rssKeys : [];
  },
});

// Combined query to get user's RSS keys and associated post data in one query
export const getUserRSSKeysWithPosts = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the user with RSS keys only
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("_id"), userId))
      .first()
      .then(user => user ? {
        rssKeys: user.rssKeys || []
      } : null);
    
    if (!user || !user.rssKeys || user.rssKeys.length === 0) {
      return { rssKeys: [], posts: [] };
    }
    
    // Extract post titles from RSS keys (remove 'rss.' prefix)
    const postTitles = user.rssKeys.map(key => key.replace(/^rss\./, '').replace(/_/g, ' '));
    
    // Get all posts that match these titles
    const posts = await ctx.db
      .query("posts")
      .filter((q) => 
        q.or(
          ...postTitles.map(title => 
            q.eq(q.field("title"), title)
          )
        )
      )
      .collect();
    
    // Map the posts to only include the fields we need
    const filteredPosts = posts.map(post => ({
      title: post.title,
      featuredImg: post.featuredImg,
      mediaType: post.mediaType,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug,
      feedUrl: post.feedUrl,
      verified: post.verified
    }));
    
    return {
      rssKeys: user.rssKeys,
      posts: filteredPosts
    };
  },
});