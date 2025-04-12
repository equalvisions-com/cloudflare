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
    verified: v.optional(v.boolean()),
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
    bio: v.optional(v.string()),
    profileImage: v.optional(v.string()),
    profileImageKey: v.optional(v.string()),
    rssKeys: v.optional(v.array(v.string())),
    isBoarded: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("by_username", ["username"]),

  friends: defineTable({
    requesterId: v.id("users"),    // User who sent the friend request
    requesteeId: v.id("users"),    // User who received the friend request
    status: v.string(),            // "pending" or "accepted"
    createdAt: v.number(),         // Timestamp when the request was created
    updatedAt: v.optional(v.number()), // Timestamp when the status was last updated
  })
  .index("by_requester", ["requesterId", "status"])  // Find all friends/requests by requester
  .index("by_requester_time", ["requesterId", "createdAt"])  // For pagination by requester
  .index("by_requestee", ["requesteeId", "status"])  // Find all friends/requests received
  .index("by_requestee_time", ["requesteeId", "createdAt"])  // For pagination by requestee
  .index("by_users", ["requesterId", "requesteeId"]), // Check if specific friendship exists

  following: defineTable({
    userId: v.id("users"),
    postId: v.id("posts"),
    feedUrl: v.string(),
  })
  .index("by_user_post", ["userId", "postId"])
  .index("by_user", ["userId"])  // Dedicated index for user lookups
  .index("by_post", ["postId"])
  .index("by_feedUrl", ["feedUrl"]),
  
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

  bookmarks: defineTable({
    userId: v.id("users"),
    entryGuid: v.string(),
    feedUrl: v.string(),
    title: v.string(),
    pubDate: v.string(),
    link: v.string(),
    bookmarkedAt: v.number(), // Timestamp for when the bookmark was created
  })
  .index("by_user_entry", ["userId", "entryGuid"])
  .index("by_user", ["userId"])
  .index("by_entry", ["entryGuid"])
  .index("by_feedUrl", ["feedUrl"])
  .index("by_time", ["bookmarkedAt"]), // For chronological display

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
    
  commentLikes: defineTable({
    userId: v.id("users"),
    commentId: v.id("comments"),
    likedAt: v.number(),      // Timestamp for when the like was created
  })
  .index("by_user_comment", ["userId", "commentId"])  // To check if a user liked a comment
  .index("by_comment", ["commentId"])                 // To count likes for a comment
  .index("by_user", ["userId"]),                      // To get all comments liked by a user
});
