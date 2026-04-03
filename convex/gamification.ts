import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  awardQuestOnceCore,
  tryCompleteSystemQuestCore,
  seedSystemQuestsCore,
} from "./questLogic";

const systemKeyValidator = v.union(
  v.literal("account_created"),
  v.literal("avatar_set"),
  v.literal("team_created"),
  v.literal("friend_added"),
  v.literal("activity_reserved")
);

export const awardQuestOnce = internalMutation({
  args: {
    userId: v.id("users"),
    questId: v.id("quests"),
    source: v.union(v.literal("manual"), v.literal("system")),
    markedByOrganiserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => awardQuestOnceCore(ctx, args),
});

export const tryCompleteSystemQuest = internalMutation({
  args: {
    userId: v.id("users"),
    systemKey: systemKeyValidator,
  },
  handler: async (ctx, { userId, systemKey }) =>
    tryCompleteSystemQuestCore(ctx, userId, systemKey),
});

export const seedSystemQuests = internalMutation({
  args: {},
  handler: async (ctx) => seedSystemQuestsCore(ctx),
});
