import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  levelFromTotalExp,
  LOYALTY_POINTS_PER_LEVEL_UP,
} from "../lib/gamification/levels";
import { DEFAULT_QUEST_ICON_SVG } from "../lib/questDefaults";

export type SystemQuestKey =
  | "account_created"
  | "avatar_set"
  | "team_created"
  | "friend_added"
  | "activity_reserved";

export function sanitizeQuestIconSvg(svg: string): string {
  const trimmed = svg.trim();
  if (!trimmed.toLowerCase().startsWith("<svg")) {
    throw new Error("Icon must be an SVG element starting with <svg");
  }
  let s = trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  } while (s !== prev);
  s = s.replace(/\shref\s*=\s*["']?\s*javascript:/gi, ' href="blocked:"');
  if (s.length > 32_000) {
    throw new Error("SVG is too large (max 32KB)");
  }
  return s;
}

const MAX_ICON_IMAGE_URL_LEN = 2048;

/** Accepts HTTPS URLs only (e.g. Convex storage). Empty string clears. */
export function sanitizeQuestIconImageUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  if (t.length === 0) return undefined;
  if (t.length > MAX_ICON_IMAGE_URL_LEN) {
    throw new Error("Image URL is too long");
  }
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    throw new Error("Invalid quest image URL");
  }
  if (u.protocol !== "https:") {
    throw new Error("Quest image URL must use HTTPS");
  }
  return t;
}

export const DEFAULT_ICON = DEFAULT_QUEST_ICON_SVG;

export const SYSTEM_QUEST_SEED: Array<{
  systemKey: SystemQuestKey;
  questName: string;
  description: string;
  expAmount: bigint;
  iconSvg: string;
  sortOrder: number;
}> = [
  {
    systemKey: "account_created",
    questName: "Welcome aboard",
    description: "Create your account and join the adventure.",
    expAmount: BigInt(25),
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    sortOrder: 0,
  },
  {
    systemKey: "avatar_set",
    questName: "Face forward",
    description: "Add a profile picture that shows the real you.",
    expAmount: BigInt(30),
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>`,
    sortOrder: 1,
  },
  {
    systemKey: "team_created",
    questName: "Squad goals",
    description: "Create a team with your friends.",
    expAmount: BigInt(50),
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    sortOrder: 2,
  },
  {
    systemKey: "friend_added",
    questName: "Social butterfly",
    description: "Add someone as a friend on the platform.",
    expAmount: BigInt(35),
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
    sortOrder: 3,
  },
  {
    systemKey: "activity_reserved",
    questName: "Booked and ready",
    description: "Reserve a spot on an activity.",
    expAmount: BigInt(40),
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>`,
    sortOrder: 4,
  },
];

export async function awardQuestOnceCore(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    questId: Id<"quests">;
    source: "manual" | "system";
    markedByOrganiserId?: Id<"users">;
  }
): Promise<{
  awarded: boolean;
  levelsGained: number;
  newLevel: number;
  previousLevel: number;
}> {
  const existing = await ctx.db
    .query("questCompletions")
    .withIndex("by_user_quest", (q) =>
      q.eq("userId", args.userId).eq("questId", args.questId)
    )
    .first();

  if (existing) {
    const user = await ctx.db.get(args.userId);
    const totalExp = user?.totalExp ?? BigInt(0);
    const newLevel = levelFromTotalExp(totalExp);
    return {
      awarded: false,
      levelsGained: 0,
      newLevel,
      previousLevel: newLevel,
    };
  }

  const quest = await ctx.db.get(args.questId);
  if (!quest) {
    throw new Error("Quest not found");
  }
  if (quest.isActive === false) {
    throw new Error("Quest is not active");
  }

  const user = await ctx.db.get(args.userId);
  if (!user) {
    throw new Error("User not found");
  }

  const beforeExp = user.totalExp;
  const previousLevel = levelFromTotalExp(beforeExp);
  const delta = quest.expAmount;
  const afterExp = beforeExp + delta;
  const newLevel = levelFromTotalExp(afterExp);
  const levelsGained = newLevel - previousLevel;

  const currentLoyalty = user.loyaltyPoints ?? BigInt(0);
  const loyaltyGain =
    levelsGained > 0
      ? BigInt(levelsGained * LOYALTY_POINTS_PER_LEVEL_UP)
      : BigInt(0);

  await ctx.db.insert("questCompletions", {
    userId: args.userId,
    questId: args.questId,
    completedAt: Date.now(),
    source: args.source,
    markedByOrganiserId: args.markedByOrganiserId,
  });

  await ctx.db.patch(args.userId, {
    totalExp: afterExp,
    loyaltyPoints: currentLoyalty + loyaltyGain,
  });

  return {
    awarded: true,
    levelsGained,
    newLevel,
    previousLevel,
  };
}

export async function tryCompleteSystemQuestCore(
  ctx: MutationCtx,
  userId: Id<"users">,
  systemKey: SystemQuestKey
): Promise<
  | Awaited<ReturnType<typeof awardQuestOnceCore>>
  | { awarded: false; reason: string }
> {
  const quest = await ctx.db
    .query("quests")
    .withIndex("bySystemKey", (q) => q.eq("systemKey", systemKey))
    .first();
  if (!quest) {
    return { awarded: false as const, reason: "no_quest" };
  }
  if (quest.questType !== "system") {
    return { awarded: false as const, reason: "not_system" };
  }
  if (quest.isActive === false) {
    return { awarded: false as const, reason: "inactive" };
  }
  return await awardQuestOnceCore(ctx, {
    userId,
    questId: quest._id,
    source: "system",
  });
}

export async function seedSystemQuestsCore(
  ctx: MutationCtx
): Promise<{ inserted: number }> {
  let inserted = 0;
  for (const row of SYSTEM_QUEST_SEED) {
    const existing = await ctx.db
      .query("quests")
      .withIndex("bySystemKey", (q) => q.eq("systemKey", row.systemKey))
      .first();
    if (existing) continue;
    await ctx.db.insert("quests", {
      questType: "system",
      questName: row.questName,
      description: row.description,
      expAmount: row.expAmount,
      iconSvg: row.iconSvg,
      systemKey: row.systemKey,
      sortOrder: row.sortOrder,
      isActive: true,
    });
    inserted += 1;
  }
  return { inserted };
}
