import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";

/**
 * Called by the client every ~30s while a tab is visible.
 * A user counts as online when `lastSeen` is within ONLINE_WINDOW_MS (see lib/presence.ts).
 */
export const heartbeat = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const now = Date.now();
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: now });
    } else {
      await ctx.db.insert("presence", { userId: user._id, lastSeen: now });
    }
    return null;
  },
});

/** Last-seen timestamps for the given users (signed-in callers only). */
export const getLastSeen = query({
  args: { userIds: v.array(v.id("users")) },
  returns: v.array(
    v.object({ userId: v.id("users"), lastSeen: v.union(v.number(), v.null()) })
  ),
  handler: async (ctx, { userIds }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await Promise.all(
      userIds.slice(0, 200).map(async (userId) => {
        const row = await ctx.db
          .query("presence")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .unique();
        if (row) return { userId, lastSeen: row.lastSeen };
        // Fall back to the legacy field for users who haven't sent a heartbeat yet.
        const user = await ctx.db.get(userId);
        return { userId, lastSeen: user?.lastActive ?? null };
      })
    );
  },
});
