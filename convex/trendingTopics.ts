import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Query to get all active trending topics in display order
export const getActiveTrendingTopics = query({
  args: {},
  handler: async (ctx) => {
    // Get all active trending topics sorted by sortOrder
    const topics = await ctx.db
      .query("trendingTopics")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .order("asc")
      .collect();

    return topics.map((topic) => ({
      _id: topic._id,
      title: topic.title,
      subtopic: topic.subtopic,
      imageUrl: topic.imageUrl,
      sortOrder: topic.sortOrder || 0,
    }));
  },
});

// Query to get all trending topics (for admin purposes)
export const getAllTrendingTopics = query({
  args: {},
  handler: async (ctx) => {
    // Check if user is authenticated (you might want to add admin role check here)
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const topics = await ctx.db
      .query("trendingTopics")
      .withIndex("by_sort_order")
      .order("asc")
      .collect();

    return topics;
  },
});

// Mutation to create a new trending topic
export const createTrendingTopic = mutation({
  args: {
    title: v.string(),
    subtopic: v.string(),
    imageUrl: v.string(),
    isActive: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if user is authenticated (you might want to add admin role check here)
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const topicId = await ctx.db.insert("trendingTopics", {
      title: args.title,
      subtopic: args.subtopic,
      imageUrl: args.imageUrl,
      isActive: args.isActive,
      sortOrder: args.sortOrder,
    });

    return topicId;
  },
});

// Mutation to update an existing trending topic
export const updateTrendingTopic = mutation({
  args: {
    id: v.id("trendingTopics"),
    title: v.optional(v.string()),
    subtopic: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if user is authenticated (you might want to add admin role check here)
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const { id, ...updates } = args;

    // Build the update object with only provided fields
    const updateData: any = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.subtopic !== undefined) updateData.subtopic = updates.subtopic;
    if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;

    await ctx.db.patch(id, updateData);
    return id;
  },
});

// Mutation to delete a trending topic
export const deleteTrendingTopic = mutation({
  args: {
    id: v.id("trendingTopics"),
  },
  handler: async (ctx, args) => {
    // Check if user is authenticated (you might want to add admin role check here)
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Mutation to reorder trending topics
export const reorderTrendingTopics = mutation({
  args: {
    topicIds: v.array(v.id("trendingTopics")),
  },
  handler: async (ctx, args) => {
    // Check if user is authenticated (you might want to add admin role check here)
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Update each topic with its new sort order
    for (let i = 0; i < args.topicIds.length; i++) {
      await ctx.db.patch(args.topicIds[i], {
        sortOrder: i,
      });
    }

    return true;
  },
});

// Mutation to seed initial trending topics (for setup)
export const seedTrendingTopics = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if user is authenticated (you might want to add admin role check here)
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Check if topics already exist
    const existingTopics = await ctx.db.query("trendingTopics").collect();
    if (existingTopics.length > 0) {
      throw new Error("Trending topics already exist");
    }

    // Create initial trending topics
    const initialTopics = [
      {
        title: "Sports",
        subtopic: "NFL Free Agency",
        imageUrl: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=32&h=32&fit=crop&crop=center",
        isActive: true,
        sortOrder: 0,
      },
      {
        title: "Investing",
        subtopic: "Stock Market",
        imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=32&h=32&fit=crop&crop=center",
        isActive: true,
        sortOrder: 1,
      },
      {
        title: "Pop Culture",
        subtopic: "Kendrick Lamar",
        imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=32&h=32&fit=crop&crop=center",
        isActive: true,
        sortOrder: 2,
      },
      {
        title: "Technology",
        subtopic: "Artificial Intelligence",
        imageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=32&h=32&fit=crop&crop=center",
        isActive: true,
        sortOrder: 3,
      },
    ];

    const topicIds = [];
    for (const topic of initialTopics) {
      const id = await ctx.db.insert("trendingTopics", topic);
      topicIds.push(id);
    }

    return topicIds;
  },
}); 