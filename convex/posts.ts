import { query } from "./_generated/server";
import { v } from "convex/values";

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