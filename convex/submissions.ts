import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { actionLimiter } from "./rateLimiters";

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    type: v.string(),
    publicationName: v.string(),
    rssFeed: v.string(),
    ip: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const daily = await actionLimiter.limit(ctx, "submissionsDaily", { key: userId });
    if (!daily.ok) {
      throw new Error("Daily submission limit reached. Try again tomorrow.");
    }

    const submissionId = await ctx.db.insert("submissions", {
      userId,
      name: args.name,
      email: args.email.toLowerCase(),
      type: args.type,
      publicationName: args.publicationName,
      rssFeed: args.rssFeed,
      ip: args.ip,
      createdAt: Date.now(),
    });

    return { success: true, submissionId };
  },
});
