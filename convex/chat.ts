import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

/** How many messages a user may send per day. */
const DAILY_LIMIT = 50;
/** One day in milliseconds. */
const DAY = 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------------------
// Rate-limiter configuration
// -----------------------------------------------------------------------------
export const chatLimiter = new RateLimiter(components.rateLimiter, {
  daily: {
    kind: "fixed window",
    period: DAY,
    rate: DAILY_LIMIT,
    capacity: DAILY_LIMIT,
  },
});

// -----------------------------------------------------------------------------
// Mutation: sendChatMessage
// -----------------------------------------------------------------------------
export const sendChatMessage = mutation({
  args: {
    message: v.string(),
    activeButton: v.string(),
  },
  handler: async (ctx, { message, activeButton }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Consume one token from the user's daily bucket
    const limitResult = await chatLimiter.limit(ctx, "daily", { key: userId });
    if (!limitResult.ok) {
      return {
        limited: true,
        retryAfterMs: limitResult.retryAfter,
        remaining: 0,
      };
    }

    // …your chat-handling logic would go here…

    return {
      limited: false,
      success: true,
      message: "Message sent successfully",
    };
  },
});

// -----------------------------------------------------------------------------
// Query: getRateLimitStatus  (binary search: ≤ 6 reads)
// -----------------------------------------------------------------------------
export const getRateLimitStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    // Unauthenticated callers appear to have the full quota
    if (!userId) return { remaining: DAILY_LIMIT, used: 0 };

    // Binary-search the largest token count that still passes .check()
    let low = 0;            // highest known PASS
    let high = DAILY_LIMIT; // lowest known FAIL (exclusive)

    while (low < high) {
      const mid = Math.ceil((low + high + 1) / 2);
      const { ok } = await chatLimiter.check(ctx, "daily", {
        key: userId,
        count: mid,
      });
      if (ok) {
        low = mid;          // mid tokens are available
      } else {
        high = mid - 1;     // too many; lower ceiling
      }
    }

    const remaining = low;  // 0 – DAILY_LIMIT
    return { remaining, used: DAILY_LIMIT - remaining };
  },
});
