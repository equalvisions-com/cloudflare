import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { r2 } from "./r2";
import { api } from "./_generated/api";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      throw new Error("User was deleted");
    }
    return user;
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (!profile) {
      const user = await ctx.db.get(userId);
      return { username: user?.name ?? "Guest" };
    }

    return profile;
  },
});

export const getProfileByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("username"), args.username))
      .first();
    return profile || null;
  },
});

// Generate a signed URL for uploading a profile image
export const getProfileImageUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated");
    }
    
    // Generate a unique key for the profile image based on the user ID
    const key = `profile-images/${userId}_${Date.now()}`;
    
    try {
      // Generate a signed URL
      const urlResponse = await r2.generateUploadUrl(key);
      
      // Depending on the structure of the response, extract the URL correctly
      let url;
      if (typeof urlResponse === 'string') {
        url = urlResponse;
      } else if (urlResponse && typeof urlResponse === 'object') {
        // Looks like R2 is returning an object, try to get the url from it
        if ('url' in urlResponse) {
          url = (urlResponse as any).url;
        } else {
          // Try stringifying as a last resort
          url = String(urlResponse);
        }
      } else {
        throw new Error("Invalid URL format returned from R2");
      }
      
      return { url, key };
    } catch (error) {
      console.error("Failed to generate upload URL:", error);
      throw new Error("Failed to generate upload URL");
    }
  },
});

export const updateProfile = mutation({
  args: {
    name: v.union(v.string(), v.null()),
    bio: v.union(v.string(), v.null()),
    profileImage: v.union(v.string(), v.null()),
    // New parameter for R2 object key
    profileImageKey: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { name, bio, profileImage, profileImageKey } = args;
    
    // Get the authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated");
    }
    
    // Find the user's profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .first();
    
    if (!profile) {
      throw new Error("Profile not found");
    }
    
    // Prepare updates - convert null to undefined for the DB
    const updates: {
      name?: string;
      bio?: string;
      profileImage?: string;
      profileImageKey?: string;
    } = {};
    
    if (name !== null) updates.name = name;
    if (bio !== null) updates.bio = bio;
    
    // Store old key for tracking if we need to clean up
    const oldProfileImageKey = profile.profileImageKey;
    const isChangingImage = profileImageKey && oldProfileImageKey && profileImageKey !== oldProfileImageKey;
    
    // Handle both regular profileImage URLs and R2 keys
    if (profileImageKey) {
      // If an R2 key is provided, generate a public URL for it
      try {
        const publicUrl = await r2.getUrl(profileImageKey);
        updates.profileImage = publicUrl;
        updates.profileImageKey = profileImageKey;
      } catch (error) {
        console.error("Failed to get image URL:", error);
        // Still save the key even if we can't get the URL right now
        updates.profileImageKey = profileImageKey;
      }
      
      // If we're changing the R2 image, delete the old one
      if (isChangingImage) {
        // We can't call an action directly from a mutation, so schedule with 0 delay for immediate execution
        ctx.scheduler.runAfter(0, api.r2Cleanup.deleteR2Object, { key: oldProfileImageKey });
        console.log(`Scheduled immediate deletion of old profile image: ${oldProfileImageKey}`);
      }
    } else if (profileImage !== null) {
      // If just a regular URL is provided (legacy or external)
      updates.profileImage = profileImage;
      
      // If we're changing from R2 to external URL, remove the key and delete the old image
      if (oldProfileImageKey) {
        updates.profileImageKey = undefined;
        // We can't call an action directly from a mutation, so schedule with 0 delay for immediate execution
        ctx.scheduler.runAfter(0, api.r2Cleanup.deleteR2Object, { key: oldProfileImageKey });
        console.log(`Scheduled immediate deletion of old profile image: ${oldProfileImageKey}`);
      }
    }
    
    // Update the profile
    await ctx.db.patch(profile._id, updates);
    
    return profile._id;
  },
});

// Helper action to get a direct URL for an R2 stored profile image
export const getProfileImageUrl = action({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    return r2.getUrl(args.key);
  },
});