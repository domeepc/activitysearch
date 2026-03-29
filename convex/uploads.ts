import {mutation} from "./_generated/server";
import {v} from "convex/values";

export const generateUploadUrl = mutation({
  args: {
    kind: v.union(v.literal("avatar"), v.literal("activity")),
  },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to upload images");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const resolveUploadedImageUrl = mutation({
  args: {
    storageId: v.id("_storage"),
    kind: v.union(v.literal("avatar"), v.literal("activity")),
  },
  handler: async (ctx, {storageId}) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to upload images");
    }

    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Could not resolve uploaded image URL");
    }

    return {url, storageId};
  },
});
