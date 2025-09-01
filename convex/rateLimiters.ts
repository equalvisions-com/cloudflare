import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

// Time constants
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Centralized rate limiter instance
export const actionLimiter = new RateLimiter(components.rateLimiter, {
  // Chat limits - special case, daily only
  chat: {
    kind: "fixed window",
    period: DAY,
    rate: 50,
    capacity: 50,
  },
  
  // Profile update limits - special case, daily only
  profileUpdate: {
    kind: "fixed window",
    period: DAY,
    rate: 3,
    capacity: 3,
  },
  
  // Likes limits - standardized burst/hourly/daily structure
  likesBurst: {
    kind: "fixed window",
    period: 30 * SECOND,
    rate: 5,
    capacity: 5,
  },
  likesHourly: {
    kind: "fixed window",
    period: HOUR,
    rate: 50,
    capacity: 50,
  },
  likesDaily: {
    kind: "fixed window",
    period: DAY,
    rate: 200,
    capacity: 200,
  },
  
  // Bookmarks limits - standardized burst/hourly/daily structure
  bookmarksBurst: {
    kind: "fixed window",
    period: 30 * SECOND,
    rate: 5,
    capacity: 5,
  },
  bookmarksHourly: {
    kind: "fixed window",
    period: HOUR,
    rate: 50,
    capacity: 50,
  },
  bookmarksDaily: {
    kind: "fixed window",
    period: DAY,
    rate: 200,
    capacity: 200,
  },
  
  // Retweets limits - standardized burst/hourly/daily structure
  retweetsBurst: {
    kind: "fixed window",
    period: 30 * SECOND,
    rate: 3,
    capacity: 3,
  },
  retweetsHourly: {
    kind: "fixed window",
    period: HOUR,
    rate: 25,
    capacity: 25,
  },
  retweetsDaily: {
    kind: "fixed window",
    period: DAY,
    rate: 100,
    capacity: 100,
  },
  
  // Following limits - standardized burst/hourly/daily structure
  followingBurst: {
    kind: "fixed window",
    period: MINUTE,
    rate: 10,
    capacity: 10,
  },
  followingHourly: {
    kind: "fixed window",
    period: HOUR,
    rate: 50,
    capacity: 50,
  },
  followingDaily: {
    kind: "fixed window",
    period: DAY,
    rate: 200,
    capacity: 200,
  },
  
  // Friend requests limits - standardized burst/hourly/daily structure (removed per-user targeting)
  friendsBurst: {
    kind: "fixed window",
    period: 2 * MINUTE,
    rate: 10,
    capacity: 10,
  },
  friendsHourly: {
    kind: "fixed window",
    period: HOUR,
    rate: 25,
    capacity: 25,
  },
  friendsDaily: {
    kind: "fixed window",
    period: DAY,
    rate: 75,
    capacity: 75,
  },
  
  // Comments limits - standardized burst/hourly/daily structure (removed per-entry targeting)
  commentsBurst: {
    kind: "fixed window",
    period: 30 * SECOND,
    rate: 5,
    capacity: 5,
  },
  commentsHourly: {
    kind: "fixed window",
    period: HOUR,
    rate: 20,
    capacity: 20,
  },
  commentsDaily: {
    kind: "fixed window",
    period: DAY,
    rate: 100,
    capacity: 100,
  },
  
  // Comment likes limits - standardized burst/hourly/daily structure
  commentLikesBurst: {
    kind: "fixed window",
    period: 30 * SECOND,
    rate: 5,
    capacity: 5,
  },
  commentLikesHourly: {
    kind: "fixed window",
    period: HOUR,
    rate: 50,
    capacity: 50,
  },
  commentLikesDaily: {
    kind: "fixed window",
    period: DAY,
    rate: 200,
    capacity: 200,
  },
  
  // Reports limits - daily only per user
  reportsDaily: {
    kind: "fixed window",
    period: DAY,
    rate: 5,
    capacity: 5,
  },
  
  // Submissions limits - daily only per user
  submissionsDaily: {
    kind: "fixed window",
    period: DAY,
    rate: 3,
    capacity: 3,
  },
});

 