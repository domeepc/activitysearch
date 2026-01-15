import { query } from "./_generated/server";
import { v } from "convex/values";

// DEPRECATED: updateLastActive mutation has been migrated to Ably Presence
// This mutation is no longer used. Presence is now handled by Ably.
// Keeping these queries for historical data fallback if needed.

// export const updateLastActive = mutation({
//   args: {},
//   handler: async (ctx) => {
//     const currentUser = await getCurrentUserOrThrow(ctx);
//     const now = Date.now();
//
//     await ctx.db.patch(currentUser._id, {
//       lastActive: now,
//     });
//
//     return { success: true, lastActive: now };
//   },
// });

export const getUserActivity = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return {
      lastActive: user.lastActive,
    };
  },
});

export const getUsersActivity = query({
  args: {
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, { userIds }) => {
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    
    return users
      .filter((user): user is NonNullable<typeof user> => user !== null)
      .map((user) => ({
        userId: user._id,
        lastActive: user.lastActive,
      }));
  },
});
