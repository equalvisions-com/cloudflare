import { query } from "./_generated/server";
import { v } from "convex/values";

// Get all posts for sitemap generation (minimal data)
export const getAllPostsForSitemap = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .collect();
    
    // Return only the minimal fields needed for sitemap
    return posts.map(post => ({
      postSlug: post.postSlug,
      mediaType: post.mediaType,
      _creationTime: post._creationTime,
      verified: post.verified ?? false
    }));
  },
});

// Get all categories for sitemap generation (minimal data)
export const getAllCategoriesForSitemap = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .collect();
    
    // Extract unique categories with their most recent post date
    const categoriesMap = new Map();
    posts.forEach(post => {
      const key = `${post.mediaType}-${post.categorySlug}`;
      const existing = categoriesMap.get(key);
      
      if (!existing || post._creationTime > existing.lastModified) {
        categoriesMap.set(key, {
          slug: post.categorySlug,
          mediaType: post.mediaType,
          lastModified: post._creationTime
        });
      }
    });
    
    return Array.from(categoriesMap.values());
  },
});

// Get all users for sitemap generation (minimal data)
export const getAllUsersForSitemap = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .collect();
    
    // Return only users with valid usernames, not anonymous, and boarded
    return users
      .filter(user => 
        user.username && 
        !user.isAnonymous && 
        user.isBoarded === true &&
        user.username !== "Guest"
      )
      .map(user => ({
        username: user.username,
        _creationTime: user._creationTime
      }));
  },
});

// Get the most recent activity date for dynamic lastModified
export const getLastActivityDate = query({
  args: {},
  handler: async (ctx) => {
    // Get the most recent post and user creation times
    const [latestPost, latestUser] = await Promise.all([
      ctx.db.query("posts").order("desc").first(),
      ctx.db.query("users").order("desc").first()
    ]);
    
    const postTime = latestPost?._creationTime || 0;
    const userTime = latestUser?._creationTime || 0;
    
    return Math.max(postTime, userTime);
  },
});

// Get counts for sitemap pagination
export const getSitemapCounts = query({
  args: {},
  handler: async (ctx) => {
    const [posts, users] = await Promise.all([
      ctx.db.query("posts").collect(),
      ctx.db.query("users").collect()
    ]);
    
    const validUsers = users.filter(user => 
      user.username && 
      !user.isAnonymous && 
      user.isBoarded === true &&
      user.username !== "Guest"
    );
    
    // Extract unique categories
    const categoriesSet = new Set();
    posts.forEach(post => {
      categoriesSet.add(`${post.mediaType}-${post.categorySlug}`);
    });
    
    // Count all the pages we'll include
    const staticPagesCount = 10; // Updated count for all static pages
    
    return {
      postsCount: posts.length,
      usersCount: validUsers.length,
      categoriesCount: categoriesSet.size,
      staticPagesCount,
      totalCount: posts.length + validUsers.length + categoriesSet.size + staticPagesCount
    };
  },
}); 