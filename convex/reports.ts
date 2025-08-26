import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { actionLimiter } from "./rateLimiters";

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    reason: v.string(),
    description: v.string(),
    postSlug: v.string(),
    ip: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const daily = await actionLimiter.limit(ctx, "reportsDaily", { key: userId });
    if (!daily.ok) {
      throw new Error("Daily report limit reached. Try again tomorrow.");
    }

    const reportId = await ctx.db.insert("reports", {
      userId,
      name: args.name,
      email: args.email.toLowerCase(),
      reason: args.reason,
      description: args.description,
      postSlug: args.postSlug,
      ip: args.ip,
      createdAt: Date.now(),
    });

    return { reportId };
  },
});


