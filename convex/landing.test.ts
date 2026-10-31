/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

test("landing showcase: best-rated first, public-safe review authors, no sign-in needed", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      externalId: "u", name: "Ana", lastname: "Horvat", username: "anah", slug: "anah", description: "",
      email: "ana@example.com", contact: "+385", avatar: "", totalExp: BigInt(0), friends: [],
    });
    const activity = (name: string) =>
      ctx.db.insert("activities", {
        activityName: name, description: "", address: "", longitude: 0, latitude: 0, price: 25,
        duration: BigInt(60), difficulty: "easy", maxParticipants: BigInt(10), minAge: BigInt(0),
        tags: ["Water"], equipment: [], availableTimeSlots: [],
      });
    const kayak = await activity("Kayak");
    const hike = await activity("Hike");
    await ctx.db.insert("reviews", { userId, activityId: hike, rating: 3, text: "It was fine, nothing special." });
    await ctx.db.insert("reviews", { userId, activityId: kayak, rating: 5, text: "Amazing sunset tour, the guide was great!" });
  });

  const showcase = await t.query(api.landing.showcase, {});
  expect(showcase.topActivities.map((a) => [a.title, a.rating, a.price])).toEqual([
    ["Kayak", "5.0", "€25"],
    ["Hike", "3.0", "€25"],
  ]);
  // Only good reviews with real text; author is first name + last initial, nothing else about them
  expect(showcase.reviews).toHaveLength(1);
  expect(showcase.reviews[0]).toMatchObject({ author: "Ana H.", activityName: "Kayak", rating: 5 });
  expect(JSON.stringify(showcase)).not.toMatch(/ana@example\.com|Horvat|\+385/);
});

test("landing categories come from activity tags; data: photos never reach the page", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const activity = (name: string, tags: string[], images?: string[]) =>
      ctx.db.insert("activities", {
        activityName: name, description: "", address: "", longitude: 0, latitude: 0, price: 10,
        duration: BigInt(60), difficulty: "easy", maxParticipants: BigInt(10), minAge: BigInt(0),
        tags, equipment: [], availableTimeSlots: [], images,
      });
    await activity("Kayak", ["Water", "Outdoor"], ["https://x.convex.cloud/api/storage/kayak"]);
    await activity("SUP", ["Water"], ["data:image/jpeg;base64,AAAA"]);
    await activity("Hike", ["Outdoor", "Hiking"]);
  });

  const showcase = await t.query(api.landing.showcase, {});
  expect(showcase.categories.map((c) => [c.title, c.subtitle])).toEqual([
    ["Outdoor", "2 activities"],
    ["Water", "2 activities"],
    ["Hiking", "1 activity"],
  ]);
  expect(showcase.heroActivities.map((a) => a.title)).toEqual(["Kayak"]);
  expect(JSON.stringify(showcase)).not.toContain("data:image");
});
