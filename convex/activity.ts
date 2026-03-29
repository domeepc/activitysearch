import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, getCurrentUserOrThrow } from "./users";

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

export const isOrganiserOfActivity = query({
    args: { activityId: v.id("activities") },
    handler: async (ctx, { activityId }) => {
        const currentUser = await getCurrentUser(ctx);
        if (!currentUser) return false;
        const allOrganisations = await ctx.db.query("organisations").collect();
        const organisation = allOrganisations.find((o) =>
            o.activityIDs.includes(activityId)
        );
        return organisation?.organisersIDs.includes(currentUser._id) ?? false;
    },
});

export const getActivitiesByIds = query({
    args: { activityIds: v.array(v.id("activities")) },
    handler: async (ctx, { activityIds }) => {
        if (activityIds.length === 0) {
            return [];
        }
        // Fetch all activities by their IDs
        const activities = await Promise.all(
            activityIds.map(async (id) => {
                const activity = await ctx.db.get(id);
                return activity;
            })
        );
        // Filter out any null results (in case an activity was deleted)
        return activities.filter((activity) => activity !== null);
    }
});

export const getAllTags = query({
    args: {},
    handler: async (ctx) => {
        const activities = await ctx.db.query("activities").collect();
        const allTags = new Set<string>();
        activities.forEach((activity) => {
            if (activity.tags && Array.isArray(activity.tags)) {
                activity.tags.forEach((tag: string) => {
                    if (tag && typeof tag === "string") {
                        allTags.add(tag.toLowerCase().trim());
                    }
                });
            }
        });
        return Array.from(allTags).sort();
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
        availableTimeSlots: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        // Check if user is authenticated and is an organiser
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("You must be logged in to create an activity");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("byExternalId", (q) => q.eq("externalId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        if (user.role !== "organiser") {
            throw new Error("Only organisers can create activities");
        }

        const doc: Omit<Doc<"activities">, "_id" | "_creationTime"> = {
            activityName: args.activityName ?? "",
            longitude: args.longitude,
            latitude: args.latitude,
            description: args.description,
            address: args.address,
            price: args.price,
            tags: args.tags ?? [],
            equipment: args.equipment ?? [],
            images: args.images ?? [],
            duration: args.duration !== undefined ? BigInt(args.duration) : BigInt(0),
            difficulty: args.difficulty ?? "",
            maxParticipants: args.maxParticipants !== undefined ? BigInt(args.maxParticipants) : BigInt(0),
            minAge: args.minAge !== undefined ? BigInt(args.minAge) : BigInt(0),
            rating: args.rating,
            reviewCount: args.reviewCount,
            availableTimeSlots: args.availableTimeSlots,
        };

        const activityId = await ctx.db.insert("activities", doc);

        // Add this activity ID to the user's organisation
        try {
            // Find organisation that contains this user in organisersIDs
            const organisations = await ctx.db.query("organisations").collect();
            const organisation = organisations.find((o: Doc<"organisations">) => Array.isArray(o.organisersIDs) && o.organisersIDs.some((id: Id<"users">) => String(id) === String(user._id)));

            if (organisation) {
                const existing = Array.isArray(organisation.activityIDs) ? organisation.activityIDs : [];
                await ctx.db.patch(organisation._id, {
                    activityIDs: [...existing, activityId],
                });
                await ctx.db.patch(activityId, {
                    organisationId: organisation._id,
                });
            }
        } catch (e) {
            // Don't block activity creation if organisation update fails; log for debugging
            console.warn("Failed to associate activity with organisation:", e);
        }

        return { success: true, activityId };
    }
});

export const updateActivity = mutation({
    args: {
        activityId: v.id("activities"),
        activityName: v.optional(v.string()),
        longitude: v.optional(v.float64()),
        latitude: v.optional(v.float64()),
        description: v.optional(v.string()),
        address: v.optional(v.string()),
        price: v.optional(v.float64()),
        duration: v.optional(v.int64()),
        difficulty: v.optional(v.string()),
        maxParticipants: v.optional(v.int64()),
        minAge: v.optional(v.int64()),
        tags: v.optional(v.array(v.string())),
        equipment: v.optional(v.array(v.string())),
        images: v.optional(v.array(v.string())),
        availableTimeSlots: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const currentUser = await getCurrentUserOrThrow(ctx);
        const activity = await ctx.db.get(args.activityId);
        if (!activity) {
            throw new Error("Activity not found");
        }
        const allOrganisations = await ctx.db.query("organisations").collect();
        const organisation = allOrganisations.find((o) =>
            o.activityIDs.includes(args.activityId)
        );
        if (!organisation || !organisation.organisersIDs.includes(currentUser._id)) {
            throw new Error("You can only edit activities of your organisation");
        }
        const updates: Partial<Doc<"activities">> = {};
        if (args.activityName !== undefined) updates.activityName = args.activityName;
        if (args.longitude !== undefined) updates.longitude = args.longitude;
        if (args.latitude !== undefined) updates.latitude = args.latitude;
        if (args.description !== undefined) updates.description = args.description;
        if (args.address !== undefined) updates.address = args.address;
        if (args.price !== undefined) updates.price = args.price;
        if (args.duration !== undefined) updates.duration = args.duration;
        if (args.difficulty !== undefined) updates.difficulty = args.difficulty;
        if (args.maxParticipants !== undefined) updates.maxParticipants = args.maxParticipants;
        if (args.minAge !== undefined) updates.minAge = args.minAge;
        if (args.tags !== undefined) updates.tags = args.tags;
        if (args.equipment !== undefined) updates.equipment = args.equipment;
        if (args.images !== undefined) updates.images = args.images;
        if (args.availableTimeSlots !== undefined) updates.availableTimeSlots = args.availableTimeSlots;
        if (Object.keys(updates).length === 0) return;
        await ctx.db.patch(args.activityId, updates);
    },
});
