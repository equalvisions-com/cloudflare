// convex/rssKeys.ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

// Query to get user's RSS keys
export const getUserRSSKeys = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    return profile?.rssKeys || [];
  },
});