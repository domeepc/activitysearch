import {
  internalMutation,
  mutation,
  query,
  QueryCtx,
  action,
} from "./_generated/server";
import { UserJSON, createClerkClient } from "@clerk/backend";
import { v, Validator } from "convex/values";
import { api } from "./_generated/api";

// Helper function to generate URL-safe slug from username
function generateSlug(username: string): string {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const getOAuthProviders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return {
      providers: identity.emailVerified
        ? ["google", "microsoft", "facebook"]
        : [],
    };
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const userAttributes = {
      name: data.first_name!,
      lastname: data.last_name!,
      username: data.username!,
      slug: generateSlug(data.username!),
      email: data.email_addresses[0]?.email_address,
      externalId: data.id!,
      avatar: data.image_url!,
      description: "",
      contact: "",
      totalExp: BigInt(0),
      friends: [],
      role: "user",
    };

    const user = await userByExternalId(ctx, data.id);
    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      // Preserve local database values for certain fields
      // Only update avatar from Clerk if it's not a custom base64 image
      const shouldUpdateAvatar =
        user.avatar === data.image_url || !user.avatar.startsWith("data:");

      await ctx.db.patch(user._id, {
        name: userAttributes.name,
        lastname: userAttributes.lastname,
        username: userAttributes.username,
        slug: userAttributes.slug,
        email: userAttributes.email,
        ...(shouldUpdateAvatar && { avatar: userAttributes.avatar }),
      });
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId);

    if (user !== null) {
      // Remove this user from ALL users' friends lists
      const allUsers = await ctx.db.query("users").collect();
      for (const otherUser of allUsers) {
        if (
          otherUser._id !== user._id &&
          otherUser.friends.includes(user._id)
        ) {
          await ctx.db.patch(otherUser._id, {
            friends: otherUser.friends.filter((id) => id !== user._id),
          });
        }
      }

      // Handle organization cleanup
      const allOrganisations = await ctx.db.query("organisations").collect();
      const userOrganisations = allOrganisations.filter((org) =>
        org.organisersIDs.includes(user._id)
      );

      for (const organisation of userOrganisations) {
        if (organisation.organisersIDs.length === 1) {
          // User is the only organizer - delete organization and all related data

          // Delete all activities and related data
          for (const activityId of organisation.activityIDs) {
            // Delete reviews for this activity
            const allReviews = await ctx.db.query("reviews").collect();
            const reviews = allReviews.filter(
              (review) => review.activityId === activityId
            );
            for (const review of reviews) {
              await ctx.db.delete(review._id);
            }

            // Delete reservations for this activity
            const allReservations = await ctx.db
              .query("reservations")
              .collect();
            const reservations = allReservations.filter(
              (reservation) => reservation.activityId === activityId
            );
            for (const reservation of reservations) {
              await ctx.db.delete(reservation._id);
            }

            // Delete quests for this activity
            const allQuests = await ctx.db.query("quests").collect();
            const quests = allQuests.filter(
              (quest) => quest.activityId === activityId
            );
            for (const quest of quests) {
              await ctx.db.delete(quest._id);
            }

            // Delete the activity itself
            await ctx.db.delete(activityId);
          }

          // Delete the organization
          await ctx.db.delete(organisation._id);
        } else {
          // There are other organizers - just remove this user from organisersIDs
          await ctx.db.patch(organisation._id, {
            organisersIDs: organisation.organisersIDs.filter(
              (id) => id !== user._id
            ),
          });
        }
      }

      await ctx.db.delete(user._id);
    } else {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`
      );
    }
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
    .unique();
}

export const getCurrentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const getUserBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("users")
      .withIndex("bySlug", (q) => q.eq("slug", slug))
      .first();
  },
});

export const getUsersByIds = query({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    return users.filter((user) => user !== null);
  },
});

export const checkUsernameExists = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const currentUser = await getCurrentUser(ctx);

    const existingUser = await ctx.db
      .query("users")
      .withIndex("byUsername", (q) => q.eq("username", username))
      .first();

    // Return true if username exists and is not the current user's username
    return existingUser !== null && existingUser._id !== currentUser?._id;
  },
});

export const updateUserProfile = action({
  args: {
    name: v.optional(v.string()),
    lastname: v.optional(v.string()),
    username: v.optional(v.string()),
    email: v.optional(v.string()),
    description: v.optional(v.string()),
    contact: v.optional(v.string()),
    exp: v.optional(v.number()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get current user to get the external ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const clerkUserId = identity.subject;

    // Initialize Clerk client
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    // Get full user details from Clerk to check external accounts
    const clerkUser = await clerk.users.getUser(clerkUserId);

    // Update Clerk user if name, lastname, username, or email is provided
    const clerkUpdates: {
      firstName?: string;
      lastName?: string;
      username?: string;
    } = {};

    if (args.name !== undefined) clerkUpdates.firstName = args.name;
    if (args.lastname !== undefined) clerkUpdates.lastName = args.lastname;
    if (args.username !== undefined) clerkUpdates.username = args.username;

    // Update Clerk if there are fields to update
    if (Object.keys(clerkUpdates).length > 0) {
      try {
        await clerk.users.updateUser(clerkUserId, clerkUpdates);
      } catch (error: unknown) {
        console.error("Error updating Clerk user:", error);
        throw new Error(
          `Failed to update user in Clerk: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    // Handle email updates - Update Clerk first, then Convex
    let shouldUpdateEmail = true;
    if (args.email !== undefined) {
      // Check if user has OAuth accounts (Google, Microsoft, Facebook)
      const hasOAuthAccount = clerkUser.externalAccounts.some(
        (account) =>
          account.provider === "google" ||
          account.provider === "microsoft" ||
          account.provider === "facebook"
      );

      if (!hasOAuthAccount) {
        // Check if the email already exists for this user
        const existingEmail = clerkUser.emailAddresses.find(
          (email) => email.emailAddress === args.email
        );

        if (!existingEmail) {
          try {
            // Create the new email address in Clerk (unverified)
            // Don't delete old email yet - will delete after verification
            await clerk.emailAddresses.createEmailAddress({
              userId: clerkUserId,
              emailAddress: args.email,
              verified: false,
            });

            // DON'T update the email in the local database yet
            // It will be updated when the email is verified via the webhook
            shouldUpdateEmail = false;
          } catch (error: unknown) {
            const errorMessage =
              (
                error as {
                  errors?: Array<{ message?: string }>;
                  message?: string;
                }
              )?.errors?.[0]?.message ||
              (error as { message?: string })?.message ||
              "Unknown error";

            // Handle specific error cases
            if (
              errorMessage.toLowerCase().includes("taken") ||
              errorMessage.toLowerCase().includes("already exists") ||
              errorMessage.toLowerCase().includes("in use")
            ) {
              throw new Error(
                "This email address is already in use by another account"
              );
            }

            throw new Error(errorMessage);
          }
        }
      }
    }

    // Note: Avatar updates are only stored in local database
    // Clerk avatar updates require uploading to their storage service
    // For now, we store avatars (base64 or URLs) locally

    // Update local database AFTER Clerk update (but exclude email if it's pending verification)
    const dbUpdateArgs = { ...args };
    if (!shouldUpdateEmail && args.email !== undefined) {
      delete dbUpdateArgs.email;
    }

    await ctx.runMutation(api.users.updateUserProfileMutation, dbUpdateArgs);
  },
});

export const updateUserProfileMutation = mutation({
  args: {
    name: v.optional(v.string()),
    lastname: v.optional(v.string()),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    description: v.optional(v.string()),
    contact: v.optional(v.string()),
    exp: v.optional(v.number()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);

    const updates: {
      name?: string;
      lastname?: string;
      email?: string;
      username?: string;
      slug?: string;
      description?: string;
      contact?: string;
      totalExp?: bigint;
      avatar?: string;
    } = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.lastname !== undefined) updates.lastname = args.lastname;
    if (args.email !== undefined) updates.email = args.email;
    if (args.username !== undefined) {
      updates.username = args.username;
      updates.slug = generateSlug(args.username);
    }
    if (args.description !== undefined) updates.description = args.description;
    if (args.contact !== undefined) updates.contact = args.contact;
    if (args.exp !== undefined) updates.totalExp = BigInt(args.exp);
    if (args.avatar !== undefined) updates.avatar = args.avatar;

    await ctx.db.patch(user._id, updates);
    return await ctx.db.get(user._id);
  },
});

export const addFriend = mutation({
  args: { friendId: v.id("users") },
  handler: async (ctx, { friendId }) => {
    const user = await getCurrentUserOrThrow(ctx);

    // Check if already friends
    if (user.friends.includes(friendId)) {
      throw new Error("Already friends with this user");
    }

    // Check if trying to add yourself
    if (user._id === friendId) {
      throw new Error("Cannot add yourself as a friend");
    }

    // Add friend to current user's friends list
    await ctx.db.patch(user._id, {
      friends: [...user.friends, friendId],
    });

    // Add current user to friend's friends list (mutual friendship)
    const friend = await ctx.db.get(friendId);
    if (friend) {
      await ctx.db.patch(friendId, {
        friends: [...friend.friends, user._id],
      });
    }

    return await ctx.db.get(user._id);
  },
});

export const removeFriend = mutation({
  args: { friendId: v.id("users") },
  handler: async (ctx, { friendId }) => {
    const user = await getCurrentUserOrThrow(ctx);

    // Remove friend from current user's friends list
    await ctx.db.patch(user._id, {
      friends: user.friends.filter((id) => id !== friendId),
    });

    // Remove current user from friend's friends list
    const friend = await ctx.db.get(friendId);
    if (friend) {
      await ctx.db.patch(friendId, {
        friends: friend.friends.filter((id) => id !== user._id),
      });
    }

    return await ctx.db.get(user._id);
  },
});

export const finalizeEmailChange = action({
  args: {
    newEmailId: v.string(),
    oldEmail: v.string(),
  },
  handler: async (ctx, { newEmailId }): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const clerkUserId = identity.subject;
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    try {
      // Get updated user data
      let clerkUser = await clerk.users.getUser(clerkUserId);

      // Find the newly verified email to confirm it's actually verified
      const newEmail = clerkUser.emailAddresses.find(
        (email) => email.id === newEmailId
      );

      if (!newEmail) {
        throw new Error("New email address not found");
      }

      // Check if the new email is verified
      if (newEmail.verification?.status !== "verified") {
        throw new Error(
          "New email address must be verified before it can be set as primary"
        );
      }

      // Set the new email as primary (now that it's verified)
      await clerk.users.updateUser(clerkUserId, {
        primaryEmailAddressID: newEmailId,
      });

      // Small delay to ensure Clerk has processed the primary email change
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Reload user to get updated state
      clerkUser = await clerk.users.getUser(clerkUserId);

      // Delete all old email addresses that are not the new primary email
      const oldEmails = clerkUser.emailAddresses.filter(
        (email) => email.id !== newEmailId
      );

      for (const oldEmailAddress of oldEmails) {
        try {
          await clerk.emailAddresses.deleteEmailAddress(oldEmailAddress.id);
        } catch (deleteError) {
          // Log but don't fail if we can't delete an old email
          console.error(
            `Failed to delete email ${oldEmailAddress.emailAddress}:`,
            deleteError
          );
        }
      }

      // Update the local database with the new verified email
      await ctx.runMutation(api.users.updateUserProfileMutation, {
        email: newEmail.emailAddress,
      });
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : "Unknown error");
    }
  },
});

export const unlinkOAuthProvider = action({
  args: {
    provider: v.union(
      v.literal("google"),
      v.literal("microsoft"),
      v.literal("facebook")
    ),
  },
  handler: async (ctx, { provider }): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const clerkUserId = identity.subject;
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    try {
      const clerkUser = await clerk.users.getUser(clerkUserId);

      // Clerk uses provider names like "oauth_google", "oauth_microsoft", etc.
      const providerPrefix = `oauth_${provider}`;

      // Find the external account to unlink
      const externalAccount = clerkUser.externalAccounts.find(
        (account) =>
          account.provider === provider || account.provider === providerPrefix
      );

      if (!externalAccount) {
        throw new Error(`No ${provider} account linked`);
      }

      // Delete the external account
      await clerk.users.deleteUserExternalAccount({
        userId: clerkUserId,
        externalAccountId: externalAccount.id,
      });
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : "Unknown error");
    }
  },
});

export const deleteAccount = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    // Get current user to get the external ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const clerkUserId = identity.subject;

    // Initialize Clerk client
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    // Delete from Clerk
    try {
      await clerk.users.deleteUser(clerkUserId);
    } catch (error: unknown) {
      console.error("Error deleting Clerk user:", error);
      throw new Error(
        `Failed to delete user from Clerk: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    // Delete from local database will be handled by the deleteFromClerk webhook
  },
});
