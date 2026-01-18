import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Id } from "./_generated/dataModel";

/**
 * Create a review for an activity. User must have participated in a fulfilled
 * reservation for this activity (payment captured by Stripe) and must not have
 * already reviewed this activity.
 */
export const createReview = mutation({
  args: {
    activityId: v.id("activities"),
    text: v.string(),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, { activityId, text, rating }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Check for existing review (one review per user per activity)
    const existing = await ctx.db
      .query("reviews")
      .withIndex("byUserAndActivity", (q) =>
        q.eq("userId", currentUser._id).eq("activityId", activityId)
      )
      .unique();
    if (existing) {
      throw new Error("You have already reviewed this activity.");
    }

    // Verify user has a fulfilled reservation for this activity (participant)
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("byActivity", (q) => q.eq("activityId", activityId))
      .collect();

    const fulfilled = reservations.filter(
      (r) => !r.cancelledAt && r.paymentStatus === "fulfilled"
    );

    let isParticipant = false;
    for (const res of fulfilled) {
      const teams = await Promise.all(
        res.teamIds.map((tid) => ctx.db.get(tid))
      );
      for (const t of teams) {
        if (t?.teammates.includes(currentUser._id)) {
          isParticipant = true;
          break;
        }
      }
      if (isParticipant) break;
    }

    if (!isParticipant) {
      throw new Error(
        "You can only review activities you attended after payment was completed."
      );
    }

    const ratingVal =
      rating != null && rating >= 1 && rating <= 5 ? rating : undefined;

    await ctx.db.insert("reviews", {
      text: text.trim() || "No comment.",
      rating: ratingVal,
      userId: currentUser._id,
      activityId,
    });

    // Recalculate activity rating and reviewCount
    const activityReviews = await ctx.db
      .query("reviews")
      .filter((q) => q.eq(q.field("activityId"), activityId))
      .collect();

    const withRating = activityReviews.filter((r) => r.rating != null);
    const avgRating =
      withRating.length > 0
        ? withRating.reduce((s, r) => s + (r.rating ?? 0), 0) / withRating.length
        : undefined;

    await ctx.db.patch(activityId, {
      rating: avgRating,
      reviewCount: BigInt(activityReviews.length),
    });

    return { success: true };
  },
});
