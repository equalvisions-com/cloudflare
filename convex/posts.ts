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
    
    return post;
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