import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getActivities = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("activities").collect();
    }
});

export const getActivityById = query({
    args: { activityId: v.id("activities") },
    handler: async (ctx, { activityId }) => {
        return await ctx.db.get(activityId);
    }
});

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
        equipment: v.optional(v.array(v.string())),
        images: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => { 
        const doc: any = {
            activityName: args.activityName ?? "",
            longitude: args.longitude,
            latitude: args.latitude,
            description: args.description,
            address: args.address,
            price: args.price,
            tags: args.tags ?? [],
            equipment: args.equipment ?? [],
            images: args.images ?? [],
        };

        if (args.duration !== undefined) doc.duration = args.duration;
        if (args.difficulty !== undefined) doc.difficulty = args.difficulty;
        if (args.maxParticipants !== undefined) doc.maxParticipants = args.maxParticipants;
        if (args.minAge !== undefined) doc.minAge = args.minAge;
        if (args.rating !== undefined) doc.rating = args.rating;
        if (args.reviewCount !== undefined) doc.reviewCount = args.reviewCount;

        const activityId = await ctx.db.insert("activities", doc);

        // If the current user is an organiser, add this activity ID to their organisation
        try {
            const identity = await ctx.auth.getUserIdentity();
            if (identity) {
                const user = await ctx.db
                    .query("users")
                    .withIndex("byExternalId", (q) => q.eq("externalId", identity.subject))
                    .unique();

                if (user && user.role === "organizer") {
                    // Find organisation that contains this user in organizerIDs
                    const organisations = await ctx.db.query("organisations").collect();
                    const organisation = organisations.find((o: any) => Array.isArray(o.organizerIDs) && o.organizerIDs.some((id: any) => String(id) === String(user._id)));

                    if (organisation) {
                        const existing = Array.isArray(organisation.activityIDs) ? organisation.activityIDs : [];
                        await ctx.db.patch(organisation._id, {
                            activityIDs: [...existing, activityId],
                        });
                    }
                }
            }
        } catch (e) {
            // Don't block activity creation if organisation update fails; log for debugging
            console.warn("Failed to associate activity with organisation:", e);
        }

        return { success: true, activityId };
    }
});
