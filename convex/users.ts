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
import { Id } from "./_generated/dataModel";

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
    // This query is cached by Convex based on arguments (empty in this case)
    // Multiple components calling this will share the same cached result
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
      // Batch fetch all users once
      const allUsers = await ctx.db.query("users").collect();
      const usersToUpdate = allUsers.filter(
        (otherUser) =>
          otherUser._id !== user._id &&
          otherUser.friends.includes(user._id)
      );

      // Batch update all affected users
      await Promise.all(
        usersToUpdate.map((otherUser) =>
          ctx.db.patch(otherUser._id, {
            friends: otherUser.friends.filter((id) => id !== user._id),
          })
        )
      );

      // Handle organization cleanup
      const allOrganisations = await ctx.db.query("organisations").collect();
      const userOrganisations = allOrganisations.filter((org) =>
        org.organisersIDs.includes(user._id)
      );

      // Pre-fetch all related data once to avoid repeated queries
      const allReviews = await ctx.db.query("reviews").collect();
      const allReservations = await ctx.db.query("reservations").collect();
      const allQuests = await ctx.db.query("quests").collect();

      // Create maps for efficient lookup
      const reviewsByActivity = new Map<string, typeof allReviews>();
      const reservationsByActivity = new Map<string, typeof allReservations>();
      const questsByActivity = new Map<string, typeof allQuests>();

      for (const review of allReviews) {
        const activityId = review.activityId.toString();
        if (!reviewsByActivity.has(activityId)) {
          reviewsByActivity.set(activityId, []);
        }
        reviewsByActivity.get(activityId)!.push(review);
      }

      for (const reservation of allReservations) {
        const activityId = reservation.activityId.toString();
        if (!reservationsByActivity.has(activityId)) {
          reservationsByActivity.set(activityId, []);
        }
        reservationsByActivity.get(activityId)!.push(reservation);
      }

      for (const quest of allQuests) {
        const activityId = quest.activityId.toString();
        if (!questsByActivity.has(activityId)) {
          questsByActivity.set(activityId, []);
        }
        questsByActivity.get(activityId)!.push(quest);
      }

      // Process each organisation
      for (const organisation of userOrganisations) {
        if (organisation.organisersIDs.length === 1) {
          // User is the only organiser - delete organization and all related data

          // Collect all items to delete
          const itemsToDelete: Array<{ 
            type: "review" | "reservation" | "quest" | "activity"; 
            id: Id<"reviews"> | Id<"reservations"> | Id<"quests"> | Id<"activities">;
          }> = [];

          // Delete all activities and related data
          for (const activityId of organisation.activityIDs) {
            const activityIdStr = activityId.toString();

            // Add reviews to delete list
            const reviews = reviewsByActivity.get(activityIdStr) || [];
            for (const review of reviews) {
              itemsToDelete.push({ type: "review", id: review._id });
            }

            // Add reservations to delete list
            const reservations = reservationsByActivity.get(activityIdStr) || [];
            for (const reservation of reservations) {
              itemsToDelete.push({ type: "reservation", id: reservation._id });
            }

            // Add quests to delete list
            const quests = questsByActivity.get(activityIdStr) || [];
            for (const quest of quests) {
              itemsToDelete.push({ type: "quest", id: quest._id });
            }

            // Add activity to delete list
            itemsToDelete.push({ type: "activity", id: activityId });
          }

          // Batch delete all items
          await Promise.all(
            itemsToDelete.map((item) => ctx.db.delete(item.id))
          );

          // Delete the organization
          await ctx.db.delete(organisation._id);
        } else {
          // There are other organisers - just remove this user from organisersIDs
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
  // Get identity first (fast operation)
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  // Lookup user by externalId using index (efficient)
  return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  // Uses index "byExternalId" for efficient lookup
  // This is already optimized - no further caching needed as Convex handles query-level caching
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
    // Early return for empty input
    if (userIds.length === 0) {
      return [];
    }

    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) return [];
    const blocked = currentUser.blocked || [];

    // Filter out blocked users before fetching
    const filteredUserIds = userIds.filter((id) => !blocked.includes(id));

    // Early return if all users are blocked
    if (filteredUserIds.length === 0) {
      return [];
    }

    // Batch fetch all users in parallel
    const users = await Promise.all(
      filteredUserIds.map((id) => ctx.db.get(id))
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

export const getBlockedUsers = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const blocked = currentUser.blocked || [];

    if (blocked.length === 0) {
      return [];
    }

    const users = await Promise.all(blocked.map((id) => ctx.db.get(id)));

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

export const unblockUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    const blocked = currentUser.blocked || [];
    if (!blocked.includes(userId)) {
      throw new Error("User is not blocked");
    }

    // Remove userId from the unblocker's blocked list only. Do NOT modify the
    // other account's blocked list: if they had blocked you, that stays.
    await ctx.db.patch(currentUser._id, {
      blocked: blocked.filter((id) => id !== userId),
    });

    return { success: true };
  },
});

export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) return [];

    const searchTerm = query.toLowerCase().trim();
    if (searchTerm.length < 2) return [];

    const blocked = currentUser.blocked || [];

    // Get all users and filter by search term
    // Note: We include blocked users in search results but mark them as blocked
    // This allows users to see they've blocked someone and potentially unblock them
    const allUsers = await ctx.db.query("users").collect();

    return allUsers
      .filter((user) => {
        if (user._id === currentUser._id) return false;
        // Filter out organisers - only show regular users
        if (user.role === "organiser") return false;
        const name = `${user.name} ${user.lastname}`.toLowerCase();
        const username = user.username.toLowerCase();
        return name.includes(searchTerm) || username.includes(searchTerm);
      })
      .slice(0, 20) // Limit to 20 results
      .map((user) => ({
        _id: user._id,
        name: user.name,
        lastname: user.lastname,
        username: user.username,
        slug: user.slug,
        avatar: user.avatar,
        isBlocked: blocked.includes(user._id),
        hasBlockedYou: user.blocked?.includes(currentUser._id) ?? false,
      }));
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

    // Check if user is blocked
    const blocked = user.blocked || [];
    if (blocked.includes(friendId)) {
      throw new Error(
        "Cannot add a blocked user as a friend. Unblock them first."
      );
    }

    // Check if the other user has blocked you
    const otherUser = await ctx.db.get(friendId);
    if (otherUser) {
      const otherUserBlocked = otherUser.blocked || [];
      if (otherUserBlocked.includes(user._id)) {
        throw new Error("This user has blocked you");
      }
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

export const blockUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    if (currentUser._id === userId) {
      throw new Error("Cannot block yourself");
    }

    const blocked = currentUser.blocked || [];
    if (blocked.includes(userId)) {
      throw new Error("User is already blocked");
    }

    // Remove from friends if they are friends
    const friends = currentUser.friends.filter((id) => id !== userId);

    // Add to blocked list
    await ctx.db.patch(currentUser._id, {
      blocked: [...blocked, userId],
      friends,
    });

    // Also remove current user from the blocked user's friends list
    const blockedUser = await ctx.db.get(userId);
    if (blockedUser) {
      const blockedUserFriends = blockedUser.friends.filter(
        (id) => id !== currentUser._id
      );
      await ctx.db.patch(userId, {
        friends: blockedUserFriends,
      });
    }

    // Delete conversation between the two users
    // Conversations are stored with sorted user IDs (user1Id < user2Id)
    const userIds = [currentUser._id, userId].sort((a, b) => a.localeCompare(b));
    const user1Id = userIds[0];
    const user2Id = userIds[1];

    // Find conversation using byUser1 index
    const allConversations = await ctx.db
      .query("conversations")
      .withIndex("byUser1", (q) => q.eq("user1Id", user1Id))
      .collect();

    const conversation = allConversations.find((c) => c.user2Id === user2Id);

    // Delete conversation if it exists
    if (conversation) {
      await ctx.db.delete(conversation._id);
    }

    // Delete all messages between the two users
    // Get messages where currentUser is sender and userId is receiver
    const sentMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q.eq("senderId", currentUser._id).eq("receiverId", userId)
      )
      .collect();

    // Get messages where userId is sender and currentUser is receiver
    const receivedMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q.eq("senderId", userId).eq("receiverId", currentUser._id)
      )
      .collect();

    // Delete all messages
    const allMessages = [...sentMessages, ...receivedMessages];
    await Promise.all(allMessages.map((msg) => ctx.db.delete(msg._id)));

    return { success: true };
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

    // Delete conversation between the two users
    // Conversations are stored with sorted user IDs (user1Id < user2Id)
    const userIds = [user._id, friendId].sort((a, b) => a.localeCompare(b));
    const user1Id = userIds[0];
    const user2Id = userIds[1];

    // Find conversation using byUser1 index
    const allConversations = await ctx.db
      .query("conversations")
      .withIndex("byUser1", (q) => q.eq("user1Id", user1Id))
      .collect();

    const conversation = allConversations.find((c) => c.user2Id === user2Id);

    // Delete conversation if it exists
    if (conversation) {
      await ctx.db.delete(conversation._id);
    }

    // Delete all messages between the two users
    // Get messages where user is sender and friendId is receiver
    const sentMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q.eq("senderId", user._id).eq("receiverId", friendId)
      )
      .collect();

    // Get messages where friendId is sender and user is receiver
    const receivedMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q.eq("senderId", friendId).eq("receiverId", user._id)
      )
      .collect();

    // Delete all messages
    const allMessages = [...sentMessages, ...receivedMessages];
    await Promise.all(allMessages.map((msg) => ctx.db.delete(msg._id)));

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

/**
 * Get a user's public key for encryption
 */
export const getUserPublicKey = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      // Return null instead of throwing - user might not exist
      return null;
    }

    // Public keys are public information, so any authenticated user can access them
    return user.publicKey || null;
  },
});

/**
 * Set or update a user's public key
 */
export const setUserPublicKey = mutation({
  args: {
    publicKey: v.string(),
  },
  handler: async (ctx, { publicKey }) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Validate that publicKey is a valid JWK string
    try {
      JSON.parse(publicKey);
    } catch {
      throw new Error("Invalid public key format. Expected JWK JSON string.");
    }
    
    await ctx.db.patch(user._id, {
      publicKey,
    });
    
    return { success: true };
  },
});
