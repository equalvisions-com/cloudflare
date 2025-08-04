import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Fetches a list of posts marked as featured, intended for public widgets.
 * This query does *not* include user-specific data like follow status
 * to prevent unnecessary re-renders of widgets when follow state changes.
 */
export const getPublicWidgetPosts = query({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Fetch posts marked as featured, ordered perhaps by creation time or a specific field
    // For now, just taking the first 'limit' featured posts found.
    // Add specific ordering if needed (e.g., .order("desc"))
    const featuredPosts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("isFeatured"), true))
      .take(args.limit);

    // Return only the necessary public fields
    return featuredPosts.map(post => ({
      _id: post._id,
      title: post.title,
      postSlug: post.postSlug,
      categorySlug: post.categorySlug,
      featuredImg: post.featuredImg,
      feedUrl: post.feedUrl,
      mediaType: post.mediaType,
      verified: post.verified ?? false, // Ensure verified has a default value
    }));
  },
}); 