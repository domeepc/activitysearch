"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import Ably from "ably";
import type { TokenRequest } from "ably";

/**
 * Issues a short-lived Ably token for the current user (Convex user id as clientId).
 * Set ABLY_API_KEY in the Convex dashboard (full key, server-side only — not NEXT_PUBLIC).
 */
export const getAblyTokenRequest = action({
  args: {},
  handler: async (ctx): Promise<TokenRequest> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.runQuery(internal.users.getUserByExternalIdInternal, {
      externalId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const apiKey = process.env.ABLY_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("ABLY_API_KEY is not configured");
    }

    const rest = new Ably.Rest(apiKey);
    return await rest.auth.createTokenRequest({
      clientId: user._id,
    });
  },
});
