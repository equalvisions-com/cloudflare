import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  posts: defineTable({
    title: v.string(),
    postSlug: v.string(),
    category: v.string(),
    categorySlug: v.string(),
    body: v.string(),
    featuredImg: v.string(),
    feedUrl: v.string(),
    author: v.string(),
    authorUrl: v.string(),
    twitterUrl: v.string(),
    websiteUrl: v.string(),
    platform: v.string(),
    mediaType: v.string(),
    isFeatured: v.optional(v.boolean()),
  })
  .index("by_feedUrl", ["feedUrl"])
  .index("by_category", ["categorySlug"])
  .index("by_slug", ["categorySlug", "postSlug"]),

  users: defineTable({
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.float64()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    name: v.optional(v.string()),
    username: v.optional(v.string()),
  })
    .index("email", ["email"]),

  following: defineTable({
    userId: v.id("users"),
    postId: v.id("posts"),
    feedUrl: v.string(),
  })
  .index("by_user_post", ["userId", "postId"])
  .index("by_post", ["postId"])
  .index("by_feedUrl", ["feedUrl"]),
  
  profiles: defineTable({
    userId: v.id("users"),
    username: v.string(),
    rssKeys: v.optional(v.array(v.string())),
    name: v.optional(v.string()),
    profileImage: v.optional(v.string()),
    bio: v.optional(v.string()),
  })
  .index("by_userId", ["userId"]),

  likes: defineTable({
    userId: v.id("users"),
    entryGuid: v.string(),
    feedUrl: v.string(),
    title: v.string(),
    pubDate: v.string(),
    link: v.string(),
  })
  .index("by_user_entry", ["userId", "entryGuid"])
  .index("by_user", ["userId"])
  .index("by_entry", ["entryGuid"])
  .index("by_feedUrl", ["feedUrl"]),

  retweets: defineTable({
    userId: v.id("users"),
    entryGuid: v.string(),
    feedUrl: v.string(),
    title: v.string(),
    pubDate: v.string(),
    link: v.string(),
    retweetedAt: v.number(), // Timestamp for when the retweet was created
  })
  .index("by_user_entry", ["userId", "entryGuid"])
  .index("by_user", ["userId"])
  .index("by_entry", ["entryGuid"])
  .index("by_feedUrl", ["feedUrl"])
  .index("by_time", ["retweetedAt"]), // For chronological display

  comments: defineTable({
    userId: v.id("users"),
    username: v.string(),      // The username from profiles
    entryGuid: v.string(),    // The RSS entry being commented on
    feedUrl: v.string(),      // The feed URL this entry belongs to
    content: v.string(),      // The comment content
    createdAt: v.number(),    // Timestamp for sorting
    parentId: v.optional(v.id("comments")), // For nested replies
  }).index("by_entry", ["entryGuid"])      // To get all comments for an entry
    .index("by_user", ["userId"])          // To get all comments by a user
    .index("by_parent", ["parentId"])      // To get all replies to a comment
    .index("by_entry_time", ["entryGuid", "createdAt"]), // For sorted comments
});
