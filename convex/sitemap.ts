import { query } from "./_generated/server";
import { v } from "convex/values";

// Get posts by page for sitemap generation (paginated, with optional media type filter)
export const getPostsByPage = query({
  args: { 
    page: v.number(),
    pageSize: v.number(),
    mediaType: v.optional(v.union(v.literal("newsletter"), v.literal("podcast")))
  },
  handler: async (ctx, { page, pageSize, mediaType }) => {
    const offset = page * pageSize;
    
    // Use the working take().slice() pattern for pagination
    let query = ctx.db.query("posts").order("desc");
    
    // Apply media type filter if specified
    if (mediaType) {
      query = query.filter(q => q.eq(q.field("mediaType"), mediaType));
    }
    
    const posts = await query
      .take(pageSize + offset)
      .then(results => results.slice(offset));
    
    // Return only the minimal fields needed for sitemap
    return posts.map(post => ({
      postSlug: post.postSlug,
      mediaType: post.mediaType,
      _creationTime: post._creationTime,
      lastModified: post._creationTime, // Use creation time as lastModified for now
      verified: post.verified ?? false
    }));
  },
});

// Get users by page for sitemap generation (paginated)
export const getUsersByPage = query({
  args: { 
    page: v.number(),
    pageSize: v.number()
  },
  handler: async (ctx, { page, pageSize }) => {
    const offset = page * pageSize;
    
    // Use the working take().slice() pattern for pagination
    const users = await ctx.db
      .query("users")
      .order("desc")
      .take(pageSize + offset)
      .then(results => results.slice(offset));
    
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
        _creationTime: user._creationTime,
        lastModified: user._creationTime // Use creation time as lastModified for now
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

// Get counts for sitemap pagination (optimized with counting instead of loading data)
export const getSitemapCounts = query({
  args: {},
  handler: async (ctx) => {
    // Get all posts and count by media type
    const posts = await ctx.db.query("posts").collect();
    const newslettersCount = posts.filter(p => p.mediaType === "newsletter").length;
    const podcastsCount = posts.filter(p => p.mediaType === "podcast").length;
    const postsCount = posts.length;
    
    // Count valid users efficiently
    const users = await ctx.db.query("users").collect();
    const validUsers = users.filter(user => 
      user.username && 
      !user.isAnonymous && 
      user.isBoarded === true &&
      user.username !== "Guest"
    );
    const usersCount = validUsers.length;
    
    // Count only public pages (removed user-specific and auth pages)
    const staticPagesCount = 4; // /, /podcasts, /newsletters, /users
    
    return {
      postsCount,
      newslettersCount,
      podcastsCount,
      usersCount,
      staticPagesCount,
      totalCount: postsCount + usersCount + staticPagesCount
    };
  },
}); 