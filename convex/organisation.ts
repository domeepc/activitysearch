import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, getCurrentUserOrThrow } from "./users";

async function assertCurrentUserIsOrganiserOf(
  ctx: { db: { get: (id: Id<"organisations">) => Promise<Doc<"organisations"> | null> } },
  organisationId: Id<"organisations">,
  userId: Id<"users">
): Promise<Doc<"organisations">> {
  const org = await ctx.db.get(organisationId);
  if (!org || !org.organisersIDs.includes(userId)) {
    throw new Error("Forbidden: you are not an organiser of this organisation");
  }
  return org;
}

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
    const currentUser = await getCurrentUserOrThrow(ctx);
    await assertCurrentUserIsOrganiserOf(ctx, args.organisationId, currentUser._id);

    const { organisationId, name, email, ...rest } = args;

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
    address: v.string(),
    IBAN: v.string(),
    country: v.optional(v.string()),
    businessType: v.optional(v.union(v.literal("individual"), v.literal("company"))),
    taxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be signed in to create an organisation");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("byExternalId", (q) => q.eq("externalId", identity.subject))
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

    await ctx.db.patch(user._id, {
      role: "organiser",
    });

    return organisationId;
  },
});

export const getOrganisationByOwnerId = query({
  args: { ownerId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser._id !== args.ownerId) {
      return null;
    }
    const allOrganisations = await ctx.db.query("organisations").collect();
    const organisation = allOrganisations.find((org) =>
      org.organisersIDs.includes(args.ownerId)
    );
    return organisation ?? null;
  },
});

/** @deprecated Prefer getOrganisationForActivityInternal from server code. */
export const getAll = query({
  args: {},
  handler: async () => {
    return [];
  },
});

function publicOrganisationProjection(org: Doc<"organisations">) {
  return {
    _id: org._id,
    organisationName: org.organisationName,
    description: org.description,
    address: org.address,
    longitude: org.longitude,
    latitude: org.latitude,
    activityIDs: org.activityIDs,
  };
}

export const getById = query({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, { organisationId }) => {
    const org = await ctx.db.get(organisationId);
    if (!org) {
      return null;
    }
    const currentUser = await getCurrentUser(ctx);
    if (currentUser && org.organisersIDs.includes(currentUser._id)) {
      return org;
    }
    return publicOrganisationProjection(org);
  },
});

/** Full organisation row — Convex-internal use only (actions, other internal functions). */
export const getByIdInternal = internalQuery({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, { organisationId }) => {
    return await ctx.db.get(organisationId);
  },
});

export const getOrganisationForActivityInternal = internalQuery({
  args: { activityId: v.id("activities") },
  handler: async (ctx, { activityId }) => {
    const activity = await ctx.db.get(activityId);
    if (activity?.organisationId) {
      return await ctx.db.get(activity.organisationId);
    }
    const allOrganisations = await ctx.db.query("organisations").collect();
    return (
      allOrganisations.find((o) => o.activityIDs.includes(activityId)) ?? null
    );
  },
});

export const getMyOrganisationsAsOrganiser = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser.role !== "organiser") {
      return [];
    }
    const allOrganisations = await ctx.db.query("organisations").collect();
    return allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );
  },
});

export const updateStripeAccount = mutation({
  args: {
    organisationId: v.id("organisations"),
    stripeAccountId: v.string(),
  },
  handler: async (ctx, { organisationId, stripeAccountId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    await assertCurrentUserIsOrganiserOf(ctx, organisationId, currentUser._id);
    await ctx.db.patch(organisationId, {
      stripeAccountId,
      stripeAccountOnboardingComplete: false,
    });
    return { success: true };
  },
});

/** Called from Convex actions after the action has verified organiser access. */
export const updateStripeAccountInternal = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    stripeAccountId: v.string(),
  },
  handler: async (ctx, { organisationId, stripeAccountId }) => {
    await ctx.db.patch(organisationId, {
      stripeAccountId,
      stripeAccountOnboardingComplete: false,
    });
    return { success: true };
  },
});
