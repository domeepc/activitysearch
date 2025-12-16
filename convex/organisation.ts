import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const updateOrganisation = mutation({
    args: {
        organisationId: v.id("organisations"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        email: v.string(),
        address: v.string(),
        IBAN: v.string(),
    },
    handler: async (ctx, args) => {
        const { organisationId, name, email, ...rest } = args;

        // Map mutation args to schema field names
        const updates: {
            description?: string;
            address: string;
            IBAN: string;
            organizationName?: string;
            organizationEmail?: string;
        } = {
            ...rest,
        };

        if (name !== undefined) {
            updates.organizationName = name;
        }

        if (email !== undefined) {
            updates.organizationEmail = email;
        }

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
        // Collect all organisations and filter in JavaScript to check array membership
        const allOrganisations = await ctx.db
            .query("organisations")
            .collect();
        const organisations = allOrganisations.filter(
            (org) => org.organizerIDs.includes(args.ownerId)
        );
        return organisations[0] ?? null;
    },
});