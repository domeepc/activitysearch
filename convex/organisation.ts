import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const updateOrganisation = mutation({
    args: {
        organisationId: v.id("organisations"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        email: v.string(),
        address: v.string(),
        contact: v.string(),
        IBAN: v.string(),
    },
    handler: async (ctx, args) => {
        const { organisationId, ...updates } = args;

        await ctx.db.patch(organisationId, updates);

        return { success: true };
    },
});

// Query to get user by external Clerk ID
export const getUserByExternalId = query({
    args: { externalId: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("byExternalId", (q) => q.eq("externalId", args.externalId))
            .unique();
        return user;
    },
});

export const createOrganisation = mutation({
    args: {
        name: v.string(),
        email: v.string(),
        description: v.optional(v.string()),
        ownerExternalId: v.string(), // Clerk user ID
        address: v.string(),
        IBAN: v.string(),
    },
    handler: async (ctx, args) => {
        // Look up the Convex user by their Clerk external ID
        const user = await ctx.db
            .query("users")
            .withIndex("byExternalId", (q) => q.eq("externalId", args.ownerExternalId))
            .unique();

        if (!user) {
            throw new Error("User not found in Convex database. Please try again in a moment.");
        }

        const organisationId = await ctx.db.insert("organisations", {
            organizationName: args.name,
            description: args.description || "",
            organizationEmail: args.email,
            address: args.address,
            longitude: 0,
            latitude: 0,
            IBAN: args.IBAN,
            organizerIDs: [user._id],
            activityIDs: [],
        });

        // Update user role to organizer
        await ctx.db.patch(user._id, {
            role: "organizer"
        });

        return organisationId;
    },
});

// Query to check if organization exists for a user
export const getOrganisationByOwnerId = query({
    args: { ownerId: v.id("users") },
    handler: async (ctx, args) => {
        const organisations = await ctx.db
            .query("organisations")
            .filter((q) => q.eq(q.field("organizerIDs"), [args.ownerId]))
            .collect();
        return organisations[0] ?? null;
    },
});