import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, getCurrentUserOrThrow } from "./users";
import {
  sanitizeQuestIconSvg,
  sanitizeQuestIconImageUrl,
  DEFAULT_ICON,
  awardQuestOnceCore,
  seedSystemQuestsCore,
} from "./questLogic";

type AnyCtx = MutationCtx | QueryCtx;

async function requireOrganiserOfActivity(
  ctx: AnyCtx,
  activityId: Id<"activities">
) {
  const user = await getCurrentUserOrThrow(ctx);
  const allOrganisations = await ctx.db.query("organisations").collect();
  const organisation = allOrganisations.find((o) =>
    o.activityIDs.includes(activityId)
  );
  if (!organisation?.organisersIDs.includes(user._id)) {
    throw new Error("You can only manage quests for your organisation's activities");
  }
  return { user, organisation };
}

function isManualQuest(
  q: { questType?: "manual" | "system"; activityId?: Id<"activities"> }
): boolean {
  return (
    q.questType === "manual" ||
    (q.questType === undefined && q.activityId !== undefined)
  );
}

async function participantUserIdsForActivity(
  ctx: AnyCtx,
  activityId: Id<"activities">
): Promise<Id<"users">[]> {
  const reservations = await ctx.db
    .query("reservations")
    .withIndex("byActivity", (q) => q.eq("activityId", activityId))
    .collect();
  const active = reservations.filter((r) => r.cancelledAt === undefined);
  const ids = new Set<Id<"users">>();
  for (const r of active) {
    ids.add(r.createdBy);
    for (const tid of r.teamIds) {
      const team = await ctx.db.get(tid);
      if (team) {
        for (const u of team.teammates) {
          ids.add(u);
        }
      }
    }
  }
  return Array.from(ids);
}

/** Idempotent: call from the client once after login to create built-in system quests. */
export const ensureSystemQuests = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be signed in");
    }
    return await seedSystemQuestsCore(ctx);
  },
});

export const listManualQuestsForActivity = query({
  args: { activityId: v.id("activities") },
  handler: async (ctx, { activityId }) => {
    const quests = await ctx.db
      .query("quests")
      .withIndex("byActivity", (q) => q.eq("activityId", activityId))
      .collect();
    return quests
      .filter((q) => isManualQuest(q))
      .filter((q) => q.isActive !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

export const listSystemQuests = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("quests").collect();
    return all
      .filter((q) => q.questType === "system")
      .filter((q) => q.isActive !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

export const organiserQuestDashboard = query({
  args: { activityId: v.id("activities") },
  handler: async (ctx, { activityId }) => {
    await requireOrganiserOfActivity(ctx, activityId);
    const quests = await ctx.db
      .query("quests")
      .withIndex("byActivity", (q) => q.eq("activityId", activityId))
      .collect();
    const manual = quests
      .filter((q) => isManualQuest(q))
      .filter((q) => q.isActive !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const userIds = await participantUserIdsForActivity(ctx, activityId);
    const users = (
      await Promise.all(userIds.map((id) => ctx.db.get(id)))
    ).filter((u): u is NonNullable<typeof u> => u !== null);

    const questIds = new Set(manual.map((q) => q._id));
    const rows: Array<{
      userId: Id<"users">;
      username: string;
      name: string;
      completedQuestIds: Id<"quests">[];
    }> = [];

    for (const u of users) {
      const completions = await ctx.db
        .query("questCompletions")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .collect();
      const completedQuestIds = completions
        .filter((c) => questIds.has(c.questId))
        .map((c) => c.questId);
      rows.push({
        userId: u._id,
        username: u.username,
        name: `${u.name} ${u.lastname}`.trim(),
        completedQuestIds,
      });
    }

    return { quests: manual, participants: rows };
  },
});

export const myQuestsOverview = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return {
        viewerId: null as null,
        systemQuests: [] as Array<{
          quest: Doc<"quests">;
          completed: boolean;
          completedAt?: number;
        }>,
        activityQuests: [] as Array<{
          activityId: Id<"activities">;
          activityName: string;
          quests: Array<{
            quest: Doc<"quests">;
            completed: boolean;
            completedAt?: number;
          }>;
        }>,
      };
    }

    const systemQuestsAll = await ctx.db.query("quests").collect();
    const systemQuests = systemQuestsAll
      .filter((q) => q.questType === "system")
      .filter((q) => q.isActive !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const myCompletions = await ctx.db
      .query("questCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const completedSet = new Set(myCompletions.map((c) => c.questId.toString()));
    const completedAtByQuestId = new Map<string, number>();
    for (const c of myCompletions) {
      completedAtByQuestId.set(c.questId.toString(), c.completedAt);
    }

    const systemWithStatus = systemQuests.map((quest) => {
      const id = quest._id.toString();
      const completed = completedSet.has(id);
      return {
        quest,
        completed,
        completedAt: completed
          ? completedAtByQuestId.get(id)
          : undefined,
      };
    });

    const reservations = await ctx.db.query("reservations").collect();
    const myActivityIds = new Set<string>();
    for (const r of reservations) {
      if (r.cancelledAt !== undefined) continue;
      const inReservation =
        r.createdBy === user._id ||
        (await Promise.all(
          r.teamIds.map((tid) => ctx.db.get(tid))
        )).some(
          (team) =>
            team !== null && team.teammates.includes(user._id)
        );
      if (inReservation) {
        myActivityIds.add(r.activityId.toString());
      }
    }

    const activityQuests: Array<{
      activityId: Id<"activities">;
      activityName: string;
      quests: Array<{ quest: Doc<"quests">; completed: boolean }>;
    }> = [];

    for (const aidStr of myActivityIds) {
      const activityId = aidStr as Id<"activities">;
      const activity = await ctx.db.get(activityId);
      if (!activity) continue;
      const qlist = await ctx.db
        .query("quests")
        .withIndex("byActivity", (q) => q.eq("activityId", activityId))
        .collect();
      const manual = qlist
        .filter((q) => isManualQuest(q))
        .filter((q) => q.isActive !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      if (manual.length === 0) continue;
      activityQuests.push({
        activityId,
        activityName: activity.activityName,
        quests: manual.map((quest) => {
          const id = quest._id.toString();
          const completed = completedSet.has(id);
          return {
            quest,
            completed,
            completedAt: completed
              ? completedAtByQuestId.get(id)
              : undefined,
          };
        }),
      });
    }

    return {
      viewerId: user._id,
      systemQuests: systemWithStatus,
      activityQuests,
    };
  },
});

export const createManualQuest = mutation({
  args: {
    activityId: v.id("activities"),
    questName: v.string(),
    description: v.string(),
    expAmount: v.number(),
    iconSvg: v.optional(v.string()),
    iconImageUrl: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrganiserOfActivity(ctx, args.activityId);
    if (!args.questName.trim()) {
      throw new Error("Quest name is required");
    }
    if (args.expAmount < 0 || !Number.isFinite(args.expAmount)) {
      throw new Error("Invalid XP amount");
    }
    const rawIcon = args.iconSvg?.trim() || DEFAULT_ICON;
    const iconSvg = sanitizeQuestIconSvg(rawIcon);
    const iconImageUrl = sanitizeQuestIconImageUrl(args.iconImageUrl);
    const id = await ctx.db.insert("quests", {
      questType: "manual",
      activityId: args.activityId,
      questName: args.questName.trim(),
      description: args.description.trim(),
      expAmount: BigInt(Math.floor(args.expAmount)),
      iconSvg,
      iconImageUrl,
      sortOrder: args.sortOrder,
      isActive: true,
    });
    return id;
  },
});

export const updateManualQuest = mutation({
  args: {
    questId: v.id("quests"),
    questName: v.optional(v.string()),
    description: v.optional(v.string()),
    expAmount: v.optional(v.number()),
    iconSvg: v.optional(v.string()),
    iconImageUrl: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { questId, ...patch }) => {
    const quest = await ctx.db.get(questId);
    if (!quest || !isManualQuest(quest) || !quest.activityId) {
      throw new Error("Manual quest not found");
    }
    await requireOrganiserOfActivity(ctx, quest.activityId);
    const updates: Record<string, unknown> = {};
    if (patch.questName !== undefined) {
      updates.questName = patch.questName.trim();
    }
    if (patch.description !== undefined) {
      updates.description = patch.description.trim();
    }
    if (patch.expAmount !== undefined) {
      if (patch.expAmount < 0 || !Number.isFinite(patch.expAmount)) {
        throw new Error("Invalid XP amount");
      }
      updates.expAmount = BigInt(Math.floor(patch.expAmount));
    }
    if (patch.iconSvg !== undefined) {
      updates.iconSvg = sanitizeQuestIconSvg(patch.iconSvg.trim() || DEFAULT_ICON);
    }
    if (patch.iconImageUrl !== undefined) {
      const img = sanitizeQuestIconImageUrl(patch.iconImageUrl);
      if (img !== undefined) {
        updates.iconImageUrl = img;
      }
    }
    if (patch.sortOrder !== undefined) {
      updates.sortOrder = patch.sortOrder;
    }
    if (patch.isActive !== undefined) {
      updates.isActive = patch.isActive;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(questId, updates as Partial<Doc<"quests">>);
    }
    return questId;
  },
});

export const deleteManualQuest = mutation({
  args: { questId: v.id("quests") },
  handler: async (ctx, { questId }) => {
    const quest = await ctx.db.get(questId);
    if (!quest || !isManualQuest(quest) || !quest.activityId) {
      throw new Error("Manual quest not found");
    }
    await requireOrganiserOfActivity(ctx, quest.activityId);
    const completions = await ctx.db
      .query("questCompletions")
      .withIndex("by_quest", (q) => q.eq("questId", questId))
      .collect();
    await Promise.all(completions.map((c) => ctx.db.delete(c._id)));
    await ctx.db.delete(questId);
    return { success: true as const };
  },
});

export const markQuestCompleteForUser = mutation({
  args: {
    questId: v.id("quests"),
    userId: v.id("users"),
  },
  handler: async (ctx, { questId, userId }) => {
    const quest = await ctx.db.get(questId);
    if (!quest || !isManualQuest(quest) || !quest.activityId) {
      throw new Error("Manual quest not found");
    }
    const { user: organiser } = await requireOrganiserOfActivity(
      ctx,
      quest.activityId
    );
    const allowed = await participantUserIdsForActivity(ctx, quest.activityId);
    if (!allowed.includes(userId)) {
      throw new Error("User is not a participant on an active reservation for this activity");
    }
    return await awardQuestOnceCore(ctx, {
      userId,
      questId,
      source: "manual",
      markedByOrganiserId: organiser._id,
    });
  },
});
