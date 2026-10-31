import {mutation} from "./_generated/server";
import {v} from "convex/values";
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_LABEL } from "../lib/uploadLimits";

export const generateUploadUrl = mutation({
  args: {
    kind: v.union(
      v.literal("avatar"),
      v.literal("activity"),
      v.literal("quest")
    ),
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
    kind: v.union(
      v.literal("avatar"),
      v.literal("activity"),
      v.literal("quest")
    ),
  },
  handler: async (ctx, {storageId}) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to upload images");
    }

    // The browser checks these too, but only here can they be trusted
    const file = await ctx.db.system.get("_storage", storageId);
    if (!file || file.size > MAX_IMAGE_UPLOAD_BYTES || !file.contentType?.startsWith("image/")) {
      await ctx.storage.delete(storageId);
      throw new Error(`Please upload an image up to ${MAX_IMAGE_UPLOAD_LABEL}`);
    }

    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Could not resolve uploaded image URL");
    }

    return {url, storageId};
  },
});
