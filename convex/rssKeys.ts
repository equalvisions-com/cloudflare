// convex/rssKeys.ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

// Query to get user's RSS keys
export const getUserRSSKeys = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    return profile?.rssKeys || [];
  },
});

// Combined query to get user's RSS keys and associated post data in one query
export const getUserRSSKeysWithPosts = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the user's profile with RSS keys
    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    
    if (!profile || !profile.rssKeys || profile.rssKeys.length === 0) {
      return { rssKeys: [], posts: [] };
    }
    
    // Extract post titles from RSS keys (remove 'rss.' prefix)
    const postTitles = profile.rssKeys.map(key => key.replace(/^rss\./, '').replace(/_/g, ' '));
    
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
    
    return {
      rssKeys: profile.rssKeys,
      posts: posts.map(post => ({
        title: post.title,
        featuredImg: post.featuredImg,
        mediaType: post.mediaType,
        postSlug: post.postSlug,
        categorySlug: post.categorySlug,
        feedUrl: post.feedUrl
      }))
    };
  },
});