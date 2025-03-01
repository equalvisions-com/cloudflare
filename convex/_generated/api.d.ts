/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as comments from "../comments.js";
import type * as entries from "../entries.js";
import type * as featured from "../featured.js";
import type * as following from "../following.js";
import type * as http from "../http.js";
import type * as likes from "../likes.js";
import type * as posts from "../posts.js";
import type * as profiles from "../profiles.js";
import type * as retweets from "../retweets.js";
import type * as rssKeys from "../rssKeys.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  comments: typeof comments;
  entries: typeof entries;
  featured: typeof featured;
  following: typeof following;
  http: typeof http;
  likes: typeof likes;
  posts: typeof posts;
  profiles: typeof profiles;
  retweets: typeof retweets;
  rssKeys: typeof rssKeys;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
