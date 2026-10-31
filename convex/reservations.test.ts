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
    return { a, b, c, reservationId };
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
