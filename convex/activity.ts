import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createActivity = mutation({
    args: {
        activityName: v.optional(v.string()),
        longitude: v.float64(),
        latitude: v.float64(),
        description: v.string(),
        address: v.string(),

        price: v.float64(),
        duration: v.optional(v.int64()),
        difficulty: v.optional(v.string()),
        maxParticipants: v.optional(v.int64()),
        minAge: v.optional(v.int64()),
        tags: v.array(v.string()),
        rating: v.optional(v.float64()),
        reviewCount: v.optional(v.int64()),
        equipment: v.array(v.string()),
        images: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => { 
        const activityId = await ctx.db.insert("activities", {
            activityName: args.activityName!,
            longitude: args.longitude,
            latitude: args.latitude,
            description: args.description,
            address: args.address,
            price : args.price,
            duration: args.duration!,
            difficulty: args.difficulty!,
            maxParticipants: args.maxParticipants!,
            minAge: args.minAge!,
            tags: args.tags!,
            rating: args.rating!,
            reviewCount: args.reviewCount!,
            equipment: args.equipment,
            images: args.images!,
        });
        return { success: true, activityId };
    }}  );
