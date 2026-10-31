/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

test("a completed quest is celebrated once, then never again on reopen", async () => {
  const t = convexTest(schema, modules);
  const questId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      externalId: "a", name: "a", lastname: "", username: "a", slug: "a", description: "",
      email: "a@example.com", contact: "", avatar: "", totalExp: BigInt(0), friends: [],
    });
    const questId = await ctx.db.insert("quests", {
      questType: "system", questName: "Create a team", description: "", expAmount: BigInt(25), isActive: true,
    });
    const oldQuest = await ctx.db.insert("quests", {
      questType: "system", questName: "Old", description: "", expAmount: BigInt(5), isActive: true,
    });
    await ctx.db.insert("questCompletions", { userId, questId, completedAt: Date.now(), source: "system" });
    // Completed before tracking started: already celebrated by the old logic
    await ctx.db.insert("questCompletions", { userId, questId: oldQuest, completedAt: Date.parse("2026-01-01"), source: "system" });
    return questId;
  });
  const asA = t.withIdentity({ subject: "a" });

  expect((await asA.query(api.quests.pendingQuestCelebrations, {})).map((q) => q._id)).toEqual([questId]);
  await asA.mutation(api.quests.markQuestCelebrated, { questId });
  expect(await asA.query(api.quests.pendingQuestCelebrations, {})).toEqual([]);
});
