import { v } from "convex/values";

// Standard pagination options validator for use in Convex functions
export const paginationOptsValidator = {
  skip: v.optional(v.number()),
  limit: v.optional(v.number()),
};

// Helper function to validate and normalize pagination options
export function normalizePaginationOpts(opts: { skip?: number; limit?: number }) {
  return {
    skip: Math.max(0, opts.skip || 0),
    limit: Math.min(Math.max(1, opts.limit || 10), 100), // Between 1 and 100, default 10
  };
} 