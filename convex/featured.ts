import { query } from "./_generated/server";
import { v } from "convex/values";

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