import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getCurrentUser, getCurrentUserOrThrow } from "./users";
import { effectiveReservationTotalPrice } from "../lib/reservationsPricing";

const POINTS_PER_EURO = 10;
const MAX_DISCOUNT_FRACTION = 0.2;

export const getMyLoyaltyBalance = query({
  args: {},
  handler: async (ctx) => {
    const u = await getCurrentUser(ctx);
    if (!u) return null;
    const pts = u.loyaltyPoints ?? BigInt(0);
    return { balance: pts.toString() };
  },
});

export const redeemLoyaltyPointsForReservation = mutation({
  args: {
    reservationId: v.id("reservations"),
    pointsToSpend: v.number(),
  },
  handler: async (ctx, { reservationId, pointsToSpend }) => {
    const user = await getCurrentUserOrThrow(ctx);
    const reservation = await ctx.db.get(reservationId);
    if (!reservation || reservation.cancelledAt !== undefined) {
      throw new ConvexError("Reservation is not available");
    }
    if (reservation.loyaltyPointsSpent !== undefined) {
      throw new ConvexError(
        "A loyalty discount is already applied to this reservation"
      );
    }

    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();
    const anyPaid = payments.some((p) => !p.refundedAt && p.amount > 0);
    if (anyPaid) {
      throw new ConvexError(
        "Loyalty can only be applied before any payment is recorded for this reservation"
      );
    }

    const activity = await ctx.db.get(reservation.activityId);
    if (!activity) {
      throw new ConvexError("Activity not found");
    }

    const teams = await Promise.all(
      reservation.teamIds.map((tid) => ctx.db.get(tid))
    );
    const validTeams = teams.filter((t): t is NonNullable<typeof t> => t !== null);
    let isParticipant = reservation.createdBy === user._id;
    for (const t of validTeams) {
      if (t.teammates.includes(user._id)) isParticipant = true;
    }
    if (!isParticipant) {
      throw new ConvexError(
        "Only participants can redeem loyalty on this reservation"
      );
    }

    const pi = Math.floor(pointsToSpend);
    if (pi < POINTS_PER_EURO) {
      throw new ConvexError(`Spend at least ${POINTS_PER_EURO} points`);
    }

    const balance = user.loyaltyPoints ?? BigInt(0);
    if (BigInt(pi) > balance) {
      throw new ConvexError("Insufficient loyalty points");
    }

    const listPrice = activity.price;
    const maxDiscount = listPrice * MAX_DISCOUNT_FRACTION;
    const euroIfRedeemAll = pi / POINTS_PER_EURO;
    const discount = Math.min(maxDiscount, euroIfRedeemAll);
    const pointsUsed = Math.min(pi, Math.ceil(discount * POINTS_PER_EURO));

    if (pointsUsed < POINTS_PER_EURO || discount <= 0) {
      throw new ConvexError("Discount amount is too small");
    }

    const newTotal = effectiveReservationTotalPrice(listPrice, discount);
    if (newTotal <= 0) {
      throw new ConvexError("Discount cannot reduce the total below zero");
    }

    const newBalance = balance - BigInt(pointsUsed);
    await ctx.db.patch(user._id, {
      loyaltyPoints: newBalance,
    });

    await ctx.db.insert("loyaltyTransactions", {
      userId: user._id,
      amount: BigInt(-pointsUsed),
      reason: "reservation_discount",
      reservationId,
      createdAt: Date.now(),
    });

    await ctx.db.patch(reservationId, {
      loyaltyDiscountTotal: discount,
      loyaltyPointsSpent: BigInt(pointsUsed),
    });

    return {
      discount,
      pointsUsed,
      newBalance: Number(newBalance),
      newTotalDue: newTotal,
    };
  },
});
