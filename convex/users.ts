import { internalMutation, mutation, query, QueryCtx, action } from './_generated/server';
import { UserJSON, createClerkClient } from '@clerk/backend';
import { v, Validator } from 'convex/values';
import { api } from './_generated/api';

// Helper function to generate URL-safe slug from username
function generateSlug(username: string): string {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const userAttributes = {
      name: data.first_name!,
      lastname: data.last_name! ,
      username: data.username!,
      slug: generateSlug(data.username!),
      email: data.email_addresses[0]?.email_address,
      externalId: data.id!,
      avatar: data.image_url!,
      description: '',
      contact: '',
      totalExp: 0n,
      friends: [],
    };

    const user = await userByExternalId(ctx, data.id);
    if (user === null) {
      await ctx.db.insert('users', userAttributes);
    } else {
      // Preserve local database values for certain fields
      // Only update avatar from Clerk if it's not a custom base64 image
      const shouldUpdateAvatar = user.avatar === data.image_url || !user.avatar.startsWith('data:');
      
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
    .query('users')
    .withIndex('byExternalId', (q) => q.eq('externalId', externalId))
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
      .query('users')
      .withIndex('bySlug', (q) => q.eq('slug', slug))
      .first();
  },
});

export const getUsersByIds = query({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    const users = await Promise.all(
      userIds.map((id) => ctx.db.get(id))
    );
    return users.filter((user) => user !== null);
  },
});

export const checkUsernameExists = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const currentUser = await getCurrentUser(ctx);
    
    const existingUser = await ctx.db
      .query('users')
      .withIndex('byUsername', (q) => q.eq('username', username))
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
  handler: async (ctx, args): Promise<any> => {
    // Get current user to get the external ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }
    
    const clerkUserId = identity.subject;
    
    // Initialize Clerk client
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    
    // Update Clerk user if name, lastname, username, or avatar is provided
    // Note: email updates require a separate flow with verification
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
      } catch (error: any) {
        console.error("Error updating Clerk user:", error);
        throw new Error(`Failed to update user in Clerk: ${error?.message || 'Unknown error'}`);
      }
    }
    
    // Note: Avatar updates are only stored in local database
    // Clerk avatar updates require uploading to their storage service
    // For now, we store avatars (base64 or URLs) locally
    
    // Update local database (including email and avatar which are stored locally)
    return await ctx.runMutation(api.users.updateUserProfileMutation, args);
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
  handler: async (ctx, args): Promise<any> => {
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

