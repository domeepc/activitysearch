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
      organisationName?: string;
      organisationEmail?: string;
    } = {
      ...rest,
    };

    if (name !== undefined) {
      updates.organisationName = name;
    }

    if (email !== undefined) {
      updates.organisationEmail = email;
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
    country: v.optional(v.string()),
    businessType: v.optional(v.union(v.literal("individual"), v.literal("company"))),
    taxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Look up the Convex user by their Clerk external ID
    const user = await ctx.db
      .query("users")
      .withIndex("byExternalId", (q) =>
        q.eq("externalId", args.ownerExternalId)
      )
      .unique();

    if (!user) {
      throw new Error(
        "User not found in Convex database. Please try again in a moment."
      );
    }

    const organisationId = await ctx.db.insert("organisations", {
      organisationName: args.name,
      description: args.description || "",
      organisationEmail: args.email,
      address: args.address,
      longitude: 0,
      latitude: 0,
      IBAN: args.IBAN,
      organisersIDs: [user._id],
      activityIDs: [],
    });

    // Update user role to organiser
    await ctx.db.patch(user._id, {
      role: "organiser",
    });

    return organisationId;
  },
});

// Query to check if organisation exists for a user
export const getOrganisationByOwnerId = query({
  args: { ownerId: v.id("users") },
  handler: async (ctx, args) => {
    // Collect all organisations and find the first match
    // Note: Without an index on array fields, we must query all and filter in memory
    const allOrganisations = await ctx.db.query("organisations").collect();
    const organisation = allOrganisations.find((org) =>
      org.organisersIDs.includes(args.ownerId)
    );
    return organisation ?? null;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organisations").collect();
  },
});

export const getById = query({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, { organisationId }) => {
    return await ctx.db.get(organisationId);
  },
});

export const updateStripeAccount = mutation({
  args: {
    organisationId: v.id("organisations"),
    stripeAccountId: v.string(),
  },
  handler: async (ctx, { organisationId, stripeAccountId }) => {
    await ctx.db.patch(organisationId, {
      stripeAccountId,
      stripeAccountOnboardingComplete: false, // Will be updated via webhook
    });
    return { success: true };
  },
});
