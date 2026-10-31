/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// 3 participants, 100 EUR total, reservation far in the future.
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = (externalId: string) =>
      ctx.db.insert("users", {
        externalId,
        name: externalId,
        lastname: "",
        username: externalId,
        slug: externalId,
        description: "",
        email: `${externalId}@example.com`,
        contact: "",
        avatar: "",
        totalExp: BigInt(0),
        friends: [],
      });
    const organiser = await user("organiser");
    const a = await user("a");
    const b = await user("b");
    const c = await user("c");
    const activityId = await ctx.db.insert("activities", {
      activityName: "Kayak",
      description: "",
      address: "",
      longitude: 0,
      latitude: 0,
      price: 100,
      duration: BigInt(60),
      difficulty: "easy",
      maxParticipants: BigInt(10),
      minAge: BigInt(0),
      tags: [],
      equipment: [],
      availableTimeSlots: ["10:00"],
    });
    const organisationId = await ctx.db.insert("organisations", {
      organisationName: "Org",
      organisationEmail: "org@example.com",
      address: "",
      longitude: 0,
      latitude: 0,
      description: "",
      IBAN: "",
      organisersIDs: [organiser],
      activityIDs: [activityId],
    });
    await ctx.db.patch(activityId, { organisationId });
    const teamId = await ctx.db.insert("teams", {
      teamName: "Team",
      teamDescription: "",
      teammates: [a, b, c],
      createdBy: a,
      slug: "team",
    });
    const reservationId = await ctx.db.insert("reservations", {
      activityId,
      date: "2099-06-01",
      time: "10:00",
      userCount: BigInt(3),
      teamIds: [teamId],
      createdBy: a,
      paymentStatus: "pending",
    });
    return { a, b, c, organiser, teamId, reservationId };
  });
  return { t, ...ids };
}

function pay(
  t: ReturnType<typeof convexTest>,
  reservationId: Id<"reservations">,
  userId: Id<"users">,
  persons: bigint,
  key: string
) {
  return t.mutation(internal.reservations.recordPaymentInternal, {
    reservationId,
    userId,
    personsPaidFor: persons,
    stripeSetupIntentId: `seti_${key}`,
    stripePaymentMethodId: `pm_${key}`,
  });
}

describe("reservation payments", () => {
  test("server sets amounts and the last payer covers rounding", async () => {
    const { t, a, b, reservationId } = await setup();

    expect(await pay(t, reservationId, a, BigInt(1), "a")).toEqual({ amount: 33.33 });
    await expect(pay(t, reservationId, b, BigInt(3), "b")).rejects.toThrow(/1 to 2/);
    expect(await pay(t, reservationId, b, BigInt(2), "b")).toEqual({ amount: 66.67 });

    const reservation = await t.run((ctx) => ctx.db.get(reservationId));
    expect(reservation?.paymentStatus).toBe("on_hold");
    // Fully paid: nobody can add another payment.
    await expect(pay(t, reservationId, a, BigInt(1), "again")).rejects.toThrow(/already paid/);
  });

  test("not fulfilled until Stripe has captured every payment", async () => {
    const { t, a, b, reservationId } = await setup();
    await pay(t, reservationId, a, BigInt(1), "a");
    await pay(t, reservationId, b, BigInt(2), "b");

    await t.mutation(internal.reservations.checkAndUpdateFulfilledStatus, { reservationId });
    let reservation = await t.run((ctx) => ctx.db.get(reservationId));
    expect(reservation?.paymentStatus).toBe("on_hold");

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("reservationPayments")
        .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
        .collect();
      for (const row of rows) await ctx.db.patch(row._id, { capturedAt: Date.now() });
    });
    await t.mutation(internal.reservations.checkAndUpdateFulfilledStatus, { reservationId });
    reservation = await t.run((ctx) => ctx.db.get(reservationId));
    expect(reservation?.paymentStatus).toBe("fulfilled");
  });

  test("cancel releases saved cards but waits for Stripe on charged ones", async () => {
    const { t, a, b, reservationId } = await setup();
    await pay(t, reservationId, a, BigInt(1), "a");
    await pay(t, reservationId, b, BigInt(2), "b");
    await t.run(async (ctx) => {
      const [first] = await ctx.db
        .query("reservationPayments")
        .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
        .collect();
      await ctx.db.patch(first._id, { stripePaymentIntentId: "pi_charged" });
    });

    await t
      .withIdentity({ subject: "a" })
      .mutation(api.reservations.cancelReservation, { reservationId, cancellationReason: "sick" });

    const rows = await t.run((ctx) =>
      ctx.db
        .query("reservationPayments")
        .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
        .collect()
    );
    const charged = rows.find((r) => r.stripePaymentIntentId === "pi_charged");
    const saved = rows.find((r) => !r.stripePaymentIntentId);
    expect(charged?.refundedAt).toBeUndefined();
    expect(saved?.refundedAt).toBeTypeOf("number");
  });
});

describe("audit fixes", () => {
  test("the team creator can't cancel once the activity started; the organiser still can", async () => {
    const { t, reservationId } = await setup();
    await t.run((ctx) => ctx.db.patch(reservationId, { date: "2000-01-01" }));

    await expect(
      t.withIdentity({ subject: "a" }).mutation(api.reservations.cancelReservation, { reservationId, cancellationReason: "free trip" })
    ).rejects.toThrow(/already started/);
    await t
      .withIdentity({ subject: "organiser" })
      .mutation(api.reservations.cancelReservation, { reservationId, cancellationReason: "storm" });
    expect((await t.run((ctx) => ctx.db.get(reservationId)))?.cancelledAt).toBeTypeOf("number");
  });

  test("a team with an upcoming booking can't be deleted; payment records are never deleted", async () => {
    const { t, a, teamId, reservationId } = await setup();
    await pay(t, reservationId, a, BigInt(1), "a");
    const asCreator = t.withIdentity({ subject: "a" });

    await expect(asCreator.mutation(api.teams.deleteTeam, { teamId })).rejects.toThrow(/upcoming reservation/);

    await asCreator.mutation(api.reservations.cancelReservation, { reservationId, cancellationReason: "plans changed" });
    await asCreator.mutation(api.teams.deleteTeam, { teamId });
    const [reservation, payments] = await t.run(async (ctx) => [
      await ctx.db.get(reservationId),
      await ctx.db.query("reservationPayments").withIndex("byReservation", (q) => q.eq("reservationId", reservationId)).collect(),
    ] as const);
    expect(reservation?.cancelledAt).toBeTypeOf("number");
    expect(payments).toHaveLength(1);
  });

  test("only the author can replace a message with its encrypted version", async () => {
    const { t, a, b } = await setup();
    const messageId = await t.run((ctx) => ctx.db.insert("messages", { senderId: a, receiverId: b, text: "I'll pay €50" }));

    await expect(
      t.withIdentity({ subject: "b" }).mutation(api.messages.migrateMessageToEncrypted, { messageId, encryptedText: "forged" })
    ).rejects.toThrow(/messages you sent/);
    await t.withIdentity({ subject: "a" }).mutation(api.messages.migrateMessageToEncrypted, { messageId, encryptedText: "ciphertext" });
    expect((await t.run((ctx) => ctx.db.get(messageId)))?.text).toBe("ciphertext");
  });

  test("loyalty points come back when the reservation is cancelled", async () => {
    const { t, a, reservationId } = await setup();
    await t.run((ctx) => ctx.db.patch(a, { loyaltyPoints: BigInt(1000) }));
    const asA = t.withIdentity({ subject: "a" });

    await asA.mutation(api.loyalty.redeemLoyaltyPointsForReservation, { reservationId, pointsToSpend: 150 });
    expect((await t.run((ctx) => ctx.db.get(a)))?.loyaltyPoints).toBe(BigInt(850));

    await asA.mutation(api.reservations.cancelReservation, { reservationId, cancellationReason: "sick" });
    expect((await t.run((ctx) => ctx.db.get(a)))?.loyaltyPoints).toBe(BigInt(1000));
  });

  test("signed-out visitors and other users don't get private profile fields", async () => {
    const { t, a, b } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.patch(a, { contact: "+385 91 000 0000", blocked: [b], loyaltyPoints: BigInt(42) });
    });

    const anonymous = await t.query(api.users.getUserById, { userId: a });
    expect(anonymous).toMatchObject({ name: "a", contact: "", friends: [], hasBlockedYou: false });
    expect(anonymous).not.toHaveProperty("blocked");
    expect(anonymous).not.toHaveProperty("loyaltyPoints");

    const asBlockedUser = await t.withIdentity({ subject: "b" }).query(api.users.getUserById, { userId: a });
    expect(asBlockedUser).toMatchObject({ contact: "+385 91 000 0000", hasBlockedYou: true });
    expect(asBlockedUser).not.toHaveProperty("blocked");

    const asOwner = await t.withIdentity({ subject: "a" }).query(api.users.getUserById, { userId: a });
    expect(asOwner).toMatchObject({ loyaltyPoints: BigInt(42), blocked: [b] });
  });

  test("user search finds people by username, first or last name (prefix), not yourself or organisers", async () => {
    const { t, b, organiser } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.patch(b, { name: "Ana", lastname: "Horvat", username: "anah" });
      await ctx.db.patch(organiser, { role: "organiser" });
    });
    const search = (query: string) =>
      t.withIdentity({ subject: "a" }).query(api.users.searchUsers, { query }).then((r) => r.map((u) => u.username));

    expect(await search("horv")).toEqual(["anah"]);
    expect(await search("ana horvat")).toEqual(["anah"]);
    expect(await search("organiser")).toEqual([]);
  });

  test("a declined charge is counted and the team is told", async () => {
    const { t, a, b, teamId, reservationId } = await setup();
    await pay(t, reservationId, a, BigInt(1), "a");
    await pay(t, reservationId, b, BigInt(2), "b");
    const [payment] = await t.run((ctx) =>
      ctx.db.query("reservationPayments").withIndex("byReservation", (q) => q.eq("reservationId", reservationId)).collect()
    );

    await t.mutation(internal.reservations.recordChargeFailure, { paymentId: payment._id, reason: "Your card has expired." });

    const [row, teamMessages] = await t.run(async (ctx) => [
      await ctx.db.get(payment._id),
      await ctx.db.query("groupMessages").withIndex("byTeam", (q) => q.eq("teamId", teamId)).collect(),
    ] as const);
    expect(row?.chargeAttempts).toBe(1);
    expect(teamMessages.some((m) => m.text.includes("declined") && m.text.includes("try the card again"))).toBe(true);
  });
});
