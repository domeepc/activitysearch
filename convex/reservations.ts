import {
  mutation,
  query,
  MutationCtx,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow, getCurrentUser } from "./users";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Helper function to generate secure random hash for conversation slugs
function generateSecureHash(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}-${randomPart2}`.replace(/[^a-z0-9-]/g, "");
}

export const getReservationsByActivity = query({
  args: { activityId: v.id("activities") },
  handler: async (ctx, { activityId }) => {
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("byActivity", (q) => q.eq("activityId", activityId))
      .collect();

    // Filter out cancelled reservations
    const activeReservations = reservations.filter((r) => !r.cancelledAt);

    // Fetch team details for each reservation
    const reservationsWithTeams = await Promise.all(
      activeReservations.map(async (reservation) => {
        const teams = await Promise.all(
          reservation.teamIds.map((teamId) => ctx.db.get(teamId))
        );
        return {
          ...reservation,
          teams: teams.filter((t): t is NonNullable<typeof t> => t !== null),
        };
      })
    );

    return reservationsWithTeams;
  },
});

export const getMyTeamsAsCreator = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get all teams where current user is a teammate
    const allTeams = await ctx.db.query("teams").collect();
    const myTeams = allTeams.filter((team) =>
      team.teammates.includes(currentUser._id)
    );

    // Filter to only teams where user is creator
    const teamsAsCreator = myTeams.filter(
      (team) => team.createdBy === currentUser._id
    );

    // Early return if no teams
    if (teamsAsCreator.length === 0) {
      return [];
    }

    // Collect all unique teammate IDs across all teams
    const allTeammateIds = new Set<string>();
    for (const team of teamsAsCreator) {
      for (const teammateId of team.teammates) {
        allTeammateIds.add(teammateId.toString());
      }
    }

    // Batch fetch all teammates at once
    const teammateIdsArray = Array.from(allTeammateIds).map(
      (id) => id as Id<"users">
    );
    const allTeammates = await Promise.all(
      teammateIdsArray.map((id) => ctx.db.get(id))
    );
    const teammateMap = new Map(
      allTeammates
        .filter((t): t is NonNullable<typeof t> => t !== null)
        .map((t) => [t._id.toString(), t])
    );

    // Build teams with teammate details
    return teamsAsCreator.map((team) => {
      const teammates = team.teammates
        .map((id) => teammateMap.get(id.toString()))
        .filter((t): t is NonNullable<typeof t> => t !== null);

      return {
        _id: team._id,
        teamName: team.teamName,
        teamDescription: team.teamDescription,
        slug: team.slug,
        icon: team.icon,
        teammates,
        createdBy: team.createdBy,
      };
    });
  },
});

export const getReservationStatusByDate = query({
  args: {
    activityId: v.id("activities"),
    date: v.string(),
  },
  handler: async (ctx, { activityId, date }) => {
    // Get activity to access availableTimeSlots
    const activity = await ctx.db.get(activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    const availableTimeSlots = activity.availableTimeSlots ?? [];
    const totalSlots = availableTimeSlots.length;

    // Get all active (non-cancelled) reservations for this activity and date
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("byActivity", (q) => q.eq("activityId", activityId))
      .collect();

    // Filter active reservations for the specific date
    const reservationsForDate = reservations.filter(
      (r) => r.date === date && !r.cancelledAt
    );

    // Count unique reserved time slots
    const reservedSlots = reservationsForDate.length;
    const percentage = totalSlots > 0 ? (reservedSlots / totalSlots) * 100 : 0;

    // Determine status
    let status: "available" | "limited" | "full";
    if (percentage === 100) {
      status = "full";
    } else if (percentage >= 50) {
      status = "limited";
    } else {
      status = "available";
    }

    return {
      totalSlots,
      reservedSlots,
      percentage,
      status,
    };
  },
});

export const createReservation = mutation({
  args: {
    activityId: v.id("activities"),
    date: v.string(),
    time: v.string(),
    teamIds: v.array(v.id("teams")),
    userCount: v.int64(),
  },
  handler: async (ctx, { activityId, date, time, teamIds, userCount }) => {
    try {
      const currentUser = await getCurrentUserOrThrow(ctx);

      // Get activity to validate time slot
      const activity = await ctx.db.get(activityId);
      if (!activity) {
        return { success: false, error: "Activity not found" };
      }

      // Validate time is in availableTimeSlots
      const availableTimeSlots = activity.availableTimeSlots ?? [];
      if (availableTimeSlots.length === 0) {
        return {
          success: false,
          error: "This activity has no available time slots defined",
        };
      }
      if (!availableTimeSlots.includes(time)) {
        return {
          success: false,
          error: `Time ${time} is not available. Available times: ${availableTimeSlots.join(
            ", "
          )}`,
        };
      }

      // Validate userCount is positive
      if (userCount <= 0) {
        return {
          success: false,
          error: "User count must be greater than 0",
        };
      }

      // Validate team size doesn't exceed activity maxParticipants
      if (
        activity.maxParticipants &&
        userCount > Number(activity.maxParticipants)
      ) {
        return {
          success: false,
          error: `Team has ${userCount} members, but this activity only allows ${activity.maxParticipants} participants.`,
        };
      }

      // Validate at least one team is selected
      if (teamIds.length === 0) {
        return {
          success: false,
          error: "At least one team must be selected",
        };
      }

      // Validate user is creator of all selected teams
      for (const teamId of teamIds) {
        const team = await ctx.db.get(teamId);
        if (!team) {
          return { success: false, error: `Team ${teamId} not found` };
        }
        if (team.createdBy !== currentUser._id) {
          return {
            success: false,
            error: `You are not the creator of team ${team.teamName}. Only team creators can make reservations.`,
          };
        }
      }

      // Validate date/time is not in the past
      const reservationDateTime = new Date(`${date}T${time}`);
      const now = new Date();
      if (reservationDateTime <= now) {
        return {
          success: false,
          error: "Reservation date and time must be in the future",
        };
      }

      // Check if any team already has a reservation for this activity on this date
      const allReservationsForDate = await ctx.db
        .query("reservations")
        .withIndex("byActivity", (q) => q.eq("activityId", activityId))
        .collect();

      const activeReservationsForDate = allReservationsForDate.filter(
        (r) => r.date === date && !r.cancelledAt
      );

      for (const teamId of teamIds) {
        const team = await ctx.db.get(teamId);
        if (!team) continue;

        const hasExistingReservation = activeReservationsForDate.some((r) =>
          r.teamIds.includes(teamId)
        );

        if (hasExistingReservation) {
          return {
            success: false,
            error: `Team ${team.teamName} already has a reservation for this activity on ${date}. Each team can only have one reservation per day per activity.`,
          };
        }
      }

      // Check if day is fulfilled
      const isFulfilled = await areBookingsFulfilledForDate(
        ctx as MutationCtx,
        activityId,
        date
      );

      // If fulfilled, redirect to queue instead
      if (isFulfilled) {
        return {
          success: false,
          error:
            "This date is fully booked. Please join the queue to be notified when a slot becomes available.",
        };
      }

      // Check for conflicts with existing reservations at this specific time
      const existingReservationsAtTime = activeReservationsForDate.filter(
        (r) => r.time === time
      );

      if (existingReservationsAtTime.length > 0) {
        return {
          success: false,
          error:
            "This date and time slot is already reserved. Please choose a different time.",
        };
      }

      // Find the organizer (owner of the activity's organization)
      const allOrganisations = await ctx.db.query("organisations").collect();
      const organisation = allOrganisations.find((org) =>
        org.activityIDs.includes(activityId)
      );

      if (!organisation || organisation.organisersIDs.length === 0) {
        return { success: false, error: "Activity organizer not found" };
      }

      // Get the first organizer (primary organizer)
      const organizerId = organisation.organisersIDs[0];
      const organizer = await ctx.db.get(organizerId);
      if (!organizer) {
        return { success: false, error: "Organizer user not found" };
      }

      // Create or find conversation between organizer and user
      // Note: No need to be friends for reservation chats
      const userIds = [organizerId, currentUser._id].sort((a, b) =>
        a.localeCompare(b)
      );
      const user1Id = userIds[0];
      const user2Id = userIds[1];

      // Check if conversation already exists
      const allConversations = await ctx.db
        .query("conversations")
        .withIndex("byUser1", (q) => q.eq("user1Id", user1Id))
        .collect();

      const existingConversation = allConversations.find(
        (c) => c.user2Id === user2Id
      );

      let conversationSlug: string;
      if (existingConversation) {
        conversationSlug = existingConversation.slug;
        // Update conversation to link to reservation if not already linked
        if (!existingConversation.reservationId) {
          // We'll update this after creating the reservation
        }
      } else {
        // Create new conversation with secure hash
        let slug = generateSecureHash();
        // Ensure slug is unique
        while (
          await ctx.db
            .query("conversations")
            .withIndex("bySlug", (q) => q.eq("slug", slug))
            .first()
        ) {
          slug = generateSecureHash();
        }

        const conversationId = await ctx.db.insert("conversations", {
          user1Id,
          user2Id,
          slug,
          createdAt: Date.now(),
        });
        const newConversation = await ctx.db.get(conversationId);
        conversationSlug = newConversation!.slug;
      }

      // Calculate payment deadline (7 days before activity, or activity date if less than 7 days away)
      const activityDate = new Date(`${date}T${time}`);
      const sevenDaysBefore = new Date(activityDate);
      sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
      const paymentDeadline =
        sevenDaysBefore > now
          ? sevenDaysBefore.getTime()
          : activityDate.getTime();

      // Create the reservation
      const reservationId = await ctx.db.insert("reservations", {
        activityId,
        date,
        time,
        teamIds,
        userCount,
        createdBy: currentUser._id,
        readByOrganizer: false,
        reservationChatSlug: conversationSlug,
        paymentStatus: "pending",
        paymentDeadline,
      });

      // Update conversation to link to reservation
      if (existingConversation && !existingConversation.reservationId) {
        await ctx.db.patch(existingConversation._id, {
          reservationId,
        });
      } else if (!existingConversation) {
        // Update the newly created conversation
        const newConv = await ctx.db
          .query("conversations")
          .withIndex("bySlug", (q) => q.eq("slug", conversationSlug))
          .first();
        if (newConv) {
          await ctx.db.patch(newConv._id, {
            reservationId,
          });
        }
      }

      // Send reservation card to each team's chat
      const timestamp = Date.now();
      for (const teamId of teamIds) {
        await ctx.db.insert("groupMessages", {
          teamId,
          senderId: currentUser._id,
          text: "Reservation card",
          timestamp,
          messageType: "reservation_card",
          reservationCardData: {
            reservationId,
          },
        });
      }

      return { success: true, reservationId };
    } catch (error) {
      // Catch any unexpected errors and return them gracefully
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while creating the reservation";
      return { success: false, error: errorMessage };
    }
  },
});

// Helper function to delete reservation conversation and messages
async function deleteReservationConversation(
  ctx: MutationCtx,
  reservationId: Id<"reservations">
): Promise<void> {
  // Find conversation linked to this reservation
  const allConversations = await ctx.db.query("conversations").collect();
  const conversation = allConversations.find(
    (c) => c.reservationId === reservationId
  );

  if (conversation) {
    // Delete all messages between the two users in this conversation
    const sentMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q
          .eq("senderId", conversation.user1Id)
          .eq("receiverId", conversation.user2Id)
      )
      .collect();

    const receivedMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q
          .eq("senderId", conversation.user2Id)
          .eq("receiverId", conversation.user1Id)
      )
      .collect();

    // Delete all messages
    const allMessages = [...sentMessages, ...receivedMessages];
    await Promise.all(allMessages.map((msg) => ctx.db.delete(msg._id)));

    // Delete the conversation
    await ctx.db.delete(conversation._id);
  }
}

// Helper function to check if bookings are fulfilled for a date
async function areBookingsFulfilledForDate(
  ctx: MutationCtx,
  activityId: Id<"activities">,
  date: string
): Promise<boolean> {
  const activity = await ctx.db.get(activityId);
  if (!activity) {
    return false;
  }

  const availableTimeSlots = activity.availableTimeSlots ?? [];
  if (availableTimeSlots.length === 0) {
    return false;
  }

  // Get all active (non-cancelled) reservations for this activity and date
  const allReservations = await ctx.db
    .query("reservations")
    .withIndex("byActivity", (q) => q.eq("activityId", activityId))
    .collect();

  const activeReservationsForDate = allReservations.filter(
    (r) => r.date === date && !r.cancelledAt
  );

  // Check if all time slots are reserved
  const reservedTimes = new Set(activeReservationsForDate.map((r) => r.time));
  return availableTimeSlots.every((slot) => reservedTimes.has(slot));
}

export const cancelReservation = mutation({
  args: {
    reservationId: v.id("reservations"),
    cancellationReason: v.string(),
  },
  handler: async (ctx, { reservationId, cancellationReason }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Validate cancellation reason
    if (!cancellationReason || cancellationReason.trim() === "") {
      throw new Error("Cancellation reason is required");
    }

    // Get reservation
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    // Check if already cancelled
    if (reservation.cancelledAt) {
      throw new Error("Reservation is already cancelled");
    }

    // Get activity to find organizer
    const activity = await ctx.db.get(reservation.activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    // Find the organizer
    const allOrganisations = await ctx.db.query("organisations").collect();
    const organisation = allOrganisations.find((org) =>
      org.activityIDs.includes(reservation.activityId)
    );

    if (
      !organisation ||
      !organisation.organisersIDs.includes(currentUser._id)
    ) {
      throw new Error("Only the activity organizer can cancel reservations");
    }

    // Mark reservation as cancelled and update payment status
    await ctx.db.patch(reservationId, {
      cancelledAt: Date.now(),
      cancellationReason: cancellationReason.trim(),
      paymentStatus: "cancelled",
    });

    // Refund all payments
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    const activePayments = payments.filter((p) => !p.refundedAt);
    for (const payment of activePayments) {
      // If payment has Stripe payment intent, refund it
      if (payment.stripePaymentIntentId) {
        try {
          await ctx.runMutation(internal.stripe.refundPayment, {
            paymentIntentId: payment.stripePaymentIntentId,
            reservationId,
          });
        } catch (error) {
          console.error("Error refunding Stripe payment:", error);
          // Still mark as refunded in our database even if Stripe refund fails
        }
      }

      await ctx.db.patch(payment._id, {
        refundedAt: Date.now(),
      });
    }

    // Send card update to teams
    await sendReservationCardUpdate(ctx, reservationId);

    // Delete reservation conversation and messages
    await deleteReservationConversation(ctx, reservationId);

    // Check queue for this activity/date and notify first team
    const queueEntries = await ctx.db
      .query("reservationQueue")
      .withIndex("byActivityDate", (q) =>
        q.eq("activityId", reservation.activityId).eq("date", reservation.date)
      )
      .collect();

    // Sort by createdAt (FIFO) and find first non-notified entry
    const sortedQueue = queueEntries
      .filter((q) => !q.notifiedAt)
      .sort((a, b) => a.createdAt - b.createdAt);

    if (sortedQueue.length > 0) {
      const firstInQueue = sortedQueue[0];
      await ctx.db.patch(firstInQueue._id, {
        notifiedAt: Date.now(),
      });

      return {
        success: true,
        queueNotified: true,
        queueEntryId: firstInQueue._id,
      };
    }

    return { success: true, queueNotified: false };
  },
});

export const getReservationsForOrganizer = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Check if user is an organizer
    if (currentUser.role !== "organiser") {
      return [];
    }

    // Find organization(s) where user is an organizer
    const allOrganisations = await ctx.db.query("organisations").collect();
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return [];
    }

    // Get all activity IDs from user's organizations
    const activityIds = new Set<Id<"activities">>();
    for (const org of userOrganisations) {
      for (const activityId of org.activityIDs) {
        activityIds.add(activityId);
      }
    }

    if (activityIds.size === 0) {
      return [];
    }

    // Get all reservations for these activities
    const allReservations = await ctx.db.query("reservations").collect();
    const organizerReservations = allReservations.filter((r) =>
      activityIds.has(r.activityId)
    );

    // Enrich reservations with related data
    const enrichedReservations = await Promise.all(
      organizerReservations.map(async (reservation) => {
        // Get activity
        const activity = await ctx.db.get(reservation.activityId);

        // Get user who made reservation
        const user = await ctx.db.get(reservation.createdBy);

        // Get teams
        const teams = await Promise.all(
          reservation.teamIds.map((teamId) => ctx.db.get(teamId))
        );

        return {
          ...reservation,
          activity: activity
            ? {
                _id: activity._id,
                activityName: activity.activityName,
                address: activity.address,
              }
            : null,
          user: user
            ? {
                _id: user._id,
                name: user.name,
                lastname: user.lastname,
                username: user.username,
                slug: user.slug,
                avatar: user.avatar,
              }
            : null,
          teams: teams
            .filter((t): t is NonNullable<typeof t> => t !== null)
            .map((t) => ({
              _id: t._id,
              teamName: t.teamName,
              slug: t.slug,
            })),
        };
      })
    );

    // Sort by date and time (most recent first)
    return enrichedReservations.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.time.localeCompare(a.time);
    });
  },
});

export const getPaymentDetailsForOrganizer = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Check if user is an organizer
    if (currentUser.role !== "organiser") {
      return [];
    }

    // Find organization(s) where user is an organizer
    const allOrganisations = await ctx.db.query("organisations").collect();
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return [];
    }

    // Get all activity IDs from user's organizations
    const activityIds = new Set<Id<"activities">>();
    for (const org of userOrganisations) {
      for (const activityId of org.activityIDs) {
        activityIds.add(activityId);
      }
    }

    if (activityIds.size === 0) {
      return [];
    }

    // Get all reservations for these activities
    const allReservations = await ctx.db.query("reservations").collect();
    const organizerReservations = allReservations.filter((r) =>
      activityIds.has(r.activityId)
    );

    // Enrich reservations with payment details
    const paymentDetails = await Promise.all(
      organizerReservations.map(async (reservation) => {
        // Get activity
        const activity = await ctx.db.get(reservation.activityId);

        // Get teams
        const teams = await Promise.all(
          reservation.teamIds.map((teamId) => ctx.db.get(teamId))
        );
        const validTeams = teams.filter(
          (t): t is NonNullable<typeof t> => t !== null
        );

        // Get all payments for this reservation
        const payments = await ctx.db
          .query("reservationPayments")
          .withIndex("byReservation", (q) =>
            q.eq("reservationId", reservation._id)
          )
          .collect();

        // Calculate payment totals
        const activePayments = payments.filter((p) => !p.refundedAt);
        const totalAmount = activity ? activity.price : 0;
        const collectedAmount = activePayments.reduce(
          (sum, p) => sum + p.amount,
          0
        );
        const saldo = collectedAmount; // Saldo is the collected amount

        return {
          reservationId: reservation._id,
          activityId: reservation.activityId,
          activityName: activity?.activityName || "Unknown Activity",
          activityAddress: activity?.address || "",
          teams: validTeams.map((t) => ({
            _id: t._id,
            teamName: t.teamName,
            slug: t.slug,
          })),
          saldo,
          totalAmount,
          paymentStatus: reservation.paymentStatus || "pending",
          date: reservation.date,
          time: reservation.time,
          userCount: Number(reservation.userCount),
          cancelledAt: reservation.cancelledAt,
        };
      })
    );

    // Filter out cancelled reservations and sort by date (most recent first)
    return paymentDetails
      .filter((p) => !p.cancelledAt)
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.time.localeCompare(a.time);
      });
  },
});

export const getUnreadReservationCount = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);

    // Return 0 if user is not authenticated
    if (!currentUser) {
      return 0;
    }

    // Check if user is an organizer
    if (currentUser.role !== "organiser") {
      return 0;
    }

    // Find organization(s) where user is an organizer
    const allOrganisations = await ctx.db.query("organisations").collect();
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return 0;
    }

    // Get all activity IDs from user's organizations
    const activityIds = new Set<Id<"activities">>();
    for (const org of userOrganisations) {
      for (const activityId of org.activityIDs) {
        activityIds.add(activityId);
      }
    }

    if (activityIds.size === 0) {
      return 0;
    }

    // Get all reservations for these activities
    const allReservations = await ctx.db.query("reservations").collect();
    const organizerReservations = allReservations.filter((r) =>
      activityIds.has(r.activityId)
    );

    // Count unread active reservations (readByOrganizer is false or undefined, not cancelled)
    const unreadCount = organizerReservations.filter(
      (r) => r.readByOrganizer !== true && !r.cancelledAt
    ).length;

    return unreadCount;
  },
});

export const markReservationsAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Check if user is an organizer
    if (currentUser.role !== "organiser") {
      return { success: true, count: 0 };
    }

    // Find organization(s) where user is an organizer
    const allOrganisations = await ctx.db.query("organisations").collect();
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return { success: true, count: 0 };
    }

    // Get all activity IDs from user's organizations
    const activityIds = new Set<Id<"activities">>();
    for (const org of userOrganisations) {
      for (const activityId of org.activityIDs) {
        activityIds.add(activityId);
      }
    }

    if (activityIds.size === 0) {
      return { success: true, count: 0 };
    }

    // Get all unread active reservations for these activities
    const allReservations = await ctx.db.query("reservations").collect();
    const organizerReservations = allReservations.filter(
      (r) =>
        activityIds.has(r.activityId) &&
        r.readByOrganizer !== true &&
        !r.cancelledAt
    );

    // Mark all as read
    let count = 0;
    for (const reservation of organizerReservations) {
      await ctx.db.patch(reservation._id, {
        readByOrganizer: true,
      });
      count++;
    }

    return { success: true, count };
  },
});

// Queue Management Functions

export const joinQueue = mutation({
  args: {
    activityId: v.id("activities"),
    date: v.string(),
    teamIds: v.array(v.id("teams")),
    userCount: v.int64(),
  },
  handler: async (ctx, { activityId, date, teamIds, userCount }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get activity
    const activity = await ctx.db.get(activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    // Validate team size doesn't exceed activity maxParticipants
    if (
      activity.maxParticipants &&
      userCount > Number(activity.maxParticipants)
    ) {
      throw new Error(
        `Team has ${userCount} members, but this activity only allows ${activity.maxParticipants} participants.`
      );
    }

    // Validate at least one team is selected
    if (teamIds.length === 0) {
      throw new Error("At least one team must be selected");
    }

    // Validate user is creator of all selected teams
    for (const teamId of teamIds) {
      const team = await ctx.db.get(teamId);
      if (!team) {
        throw new Error(`Team ${teamId} not found`);
      }
      if (team.createdBy !== currentUser._id) {
        throw new Error(
          `You are not the creator of team ${team.teamName}. Only team creators can join the queue.`
        );
      }
    }

    // Check if day is fulfilled (required for queue)
    const isFulfilled = await areBookingsFulfilledForDate(
      ctx as MutationCtx,
      activityId,
      date
    );

    if (!isFulfilled) {
      throw new Error(
        "Queue is only available when all time slots for this date are reserved."
      );
    }

    // Check if any team already has a reservation for this activity on this date
    const allReservationsForDate = await ctx.db
      .query("reservations")
      .withIndex("byActivity", (q) => q.eq("activityId", activityId))
      .collect();

    const activeReservationsForDate = allReservationsForDate.filter(
      (r) => r.date === date && !r.cancelledAt
    );

    for (const teamId of teamIds) {
      const team = await ctx.db.get(teamId);
      if (!team) continue;

      const hasExistingReservation = activeReservationsForDate.some((r) =>
        r.teamIds.includes(teamId)
      );

      if (hasExistingReservation) {
        throw new Error(
          `Team ${team.teamName} already has a reservation for this activity on ${date}.`
        );
      }
    }

    // Check if teams are already in queue
    const existingQueueEntries = await ctx.db
      .query("reservationQueue")
      .withIndex("byActivityDate", (q) =>
        q.eq("activityId", activityId).eq("date", date)
      )
      .collect();

    for (const teamId of teamIds) {
      const team = await ctx.db.get(teamId);
      if (!team) continue;

      const alreadyInQueue = existingQueueEntries.some(
        (q) => q.teamIds.includes(teamId) && !q.notifiedAt
      );

      if (alreadyInQueue) {
        throw new Error(
          `Team ${team.teamName} is already in the queue for this date.`
        );
      }
    }

    // Add to queue
    await ctx.db.insert("reservationQueue", {
      activityId,
      date,
      teamIds,
      userCount,
      createdBy: currentUser._id,
      createdAt: Date.now(),
    });

    // Calculate queue position
    const allQueueEntries = await ctx.db
      .query("reservationQueue")
      .withIndex("byActivityDate", (q) =>
        q.eq("activityId", activityId).eq("date", date)
      )
      .collect();

    const sortedQueue = allQueueEntries
      .filter((q) => !q.notifiedAt)
      .sort((a, b) => a.createdAt - b.createdAt);

    const position =
      sortedQueue.findIndex((q) =>
        q.teamIds.some((tid) => teamIds.includes(tid))
      ) + 1;

    return { success: true, position, totalInQueue: sortedQueue.length };
  },
});

export const leaveQueue = mutation({
  args: {
    queueEntryId: v.id("reservationQueue"),
  },
  handler: async (ctx, { queueEntryId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    const queueEntry = await ctx.db.get(queueEntryId);
    if (!queueEntry) {
      throw new Error("Queue entry not found");
    }

    // Verify user is the creator
    if (queueEntry.createdBy !== currentUser._id) {
      throw new Error("You can only remove your own queue entries");
    }

    // Only allow leaving if not yet notified
    if (queueEntry.notifiedAt) {
      throw new Error(
        "Cannot leave queue: You have been notified. Please accept or decline the reservation."
      );
    }

    await ctx.db.delete(queueEntryId);

    return { success: true };
  },
});

export const getQueuePosition = query({
  args: {
    activityId: v.id("activities"),
    date: v.string(),
    teamIds: v.array(v.id("teams")),
  },
  handler: async (ctx, { activityId, date, teamIds }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get all queue entries for this activity/date
    const queueEntries = await ctx.db
      .query("reservationQueue")
      .withIndex("byActivityDate", (q) =>
        q.eq("activityId", activityId).eq("date", date)
      )
      .collect();

    // Find queue entry for these teams
    const userQueueEntry = queueEntries.find(
      (q) =>
        q.teamIds.some((tid) => teamIds.includes(tid)) &&
        q.createdBy === currentUser._id &&
        !q.notifiedAt
    );

    if (!userQueueEntry) {
      return { inQueue: false, position: null, totalInQueue: 0 };
    }

    // Calculate position (FIFO based on createdAt)
    const sortedQueue = queueEntries
      .filter((q) => !q.notifiedAt)
      .sort((a, b) => a.createdAt - b.createdAt);

    const position =
      sortedQueue.findIndex((q) => q._id === userQueueEntry._id) + 1;

    return {
      inQueue: true,
      position,
      totalInQueue: sortedQueue.length,
      queueEntryId: userQueueEntry._id,
    };
  },
});

export const getQueueForActivity = query({
  args: {
    activityId: v.id("activities"),
  },
  handler: async (ctx, { activityId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Check if user is an organizer
    if (currentUser.role !== "organiser") {
      return [];
    }

    // Find organization(s) where user is an organizer
    const allOrganisations = await ctx.db.query("organisations").collect();
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return [];
    }

    // Verify activity belongs to user's organization
    const hasAccess = userOrganisations.some((org) =>
      org.activityIDs.includes(activityId)
    );

    if (!hasAccess) {
      return [];
    }

    // Get all queue entries for this activity
    const allQueueEntries = await ctx.db.query("reservationQueue").collect();

    const queueEntries = allQueueEntries.filter(
      (q) => q.activityId === activityId
    );

    // Enrich with team and user details
    const enrichedQueue = await Promise.all(
      queueEntries.map(async (entry) => {
        const user = await ctx.db.get(entry.createdBy);
        const teams = await Promise.all(
          entry.teamIds.map((teamId) => ctx.db.get(teamId))
        );

        return {
          ...entry,
          user: user
            ? {
                _id: user._id,
                name: user.name,
                lastname: user.lastname,
                username: user.username,
                slug: user.slug,
                avatar: user.avatar,
              }
            : null,
          teams: teams
            .filter((t): t is NonNullable<typeof t> => t !== null)
            .map((t) => ({
              _id: t._id,
              teamName: t.teamName,
              slug: t.slug,
            })),
        };
      })
    );

    // Sort by createdAt (FIFO)
    return enrichedQueue.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const acceptQueueReservation = mutation({
  args: {
    queueEntryId: v.id("reservationQueue"),
    time: v.string(),
  },
  handler: async (ctx, { queueEntryId, time }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    const queueEntry = await ctx.db.get(queueEntryId);
    if (!queueEntry) {
      throw new Error("Queue entry not found");
    }

    // Verify user is the creator
    if (queueEntry.createdBy !== currentUser._id) {
      throw new Error("You can only accept your own queue notifications");
    }

    // Verify notification was sent
    if (!queueEntry.notifiedAt) {
      throw new Error("You have not been notified yet");
    }

    // Get activity
    const activity = await ctx.db.get(queueEntry.activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    // Validate time is in availableTimeSlots
    const availableTimeSlots = activity.availableTimeSlots ?? [];
    if (!availableTimeSlots.includes(time)) {
      throw new Error(
        `Time ${time} is not available. Available times: ${availableTimeSlots.join(
          ", "
        )}`
      );
    }

    // Check if time slot is still available
    const existingReservations = await ctx.db
      .query("reservations")
      .withIndex("byDateTime", (q) =>
        q
          .eq("activityId", queueEntry.activityId)
          .eq("date", queueEntry.date)
          .eq("time", time)
      )
      .collect();

    const activeReservations = existingReservations.filter(
      (r) => !r.cancelledAt
    );

    if (activeReservations.length > 0) {
      throw new Error(
        "This time slot is no longer available. Please choose a different time."
      );
    }

    // Find organizer
    const allOrganisations = await ctx.db.query("organisations").collect();
    const organisation = allOrganisations.find((org) =>
      org.activityIDs.includes(queueEntry.activityId)
    );

    if (!organisation || organisation.organisersIDs.length === 0) {
      throw new Error("Activity organizer not found");
    }

    const organizerId = organisation.organisersIDs[0];
    const organizer = await ctx.db.get(organizerId);
    if (!organizer) {
      throw new Error("Organizer user not found");
    }

    // Create conversation
    const userIds = [organizerId, currentUser._id].sort((a, b) =>
      a.localeCompare(b)
    );
    const user1Id = userIds[0];
    const user2Id = userIds[1];

    const allConversations = await ctx.db
      .query("conversations")
      .withIndex("byUser1", (q) => q.eq("user1Id", user1Id))
      .collect();

    const existingConversation = allConversations.find(
      (c) => c.user2Id === user2Id
    );

    let conversationSlug: string;
    if (existingConversation) {
      conversationSlug = existingConversation.slug;
    } else {
      let slug = generateSecureHash();
      while (
        await ctx.db
          .query("conversations")
          .withIndex("bySlug", (q) => q.eq("slug", slug))
          .first()
      ) {
        slug = generateSecureHash();
      }

      const conversationId = await ctx.db.insert("conversations", {
        user1Id,
        user2Id,
        slug,
        createdAt: Date.now(),
      });
      const newConversation = await ctx.db.get(conversationId);
      conversationSlug = newConversation!.slug;
    }

    // Create reservation
    const reservationId = await ctx.db.insert("reservations", {
      activityId: queueEntry.activityId,
      date: queueEntry.date,
      time,
      teamIds: queueEntry.teamIds,
      userCount: queueEntry.userCount,
      createdBy: currentUser._id,
      readByOrganizer: false,
      reservationChatSlug: conversationSlug,
    });

    // Link conversation to reservation
    if (existingConversation && !existingConversation.reservationId) {
      await ctx.db.patch(existingConversation._id, {
        reservationId,
      });
    } else if (!existingConversation) {
      const newConv = await ctx.db
        .query("conversations")
        .withIndex("bySlug", (q) => q.eq("slug", conversationSlug))
        .first();
      if (newConv) {
        await ctx.db.patch(newConv._id, {
          reservationId,
        });
      }
    }

    // Remove from queue
    await ctx.db.delete(queueEntryId);

    // Notify next team in queue if any
    const remainingQueueEntries = await ctx.db
      .query("reservationQueue")
      .withIndex("byActivityDate", (q) =>
        q.eq("activityId", queueEntry.activityId).eq("date", queueEntry.date)
      )
      .collect();

    const nextInQueue = remainingQueueEntries
      .filter((q) => !q.notifiedAt)
      .sort((a, b) => a.createdAt - b.createdAt)[0];

    if (nextInQueue) {
      await ctx.db.patch(nextInQueue._id, {
        notifiedAt: Date.now(),
      });
    }

    return { success: true, reservationId };
  },
});

export const declineQueueReservation = mutation({
  args: {
    queueEntryId: v.id("reservationQueue"),
  },
  handler: async (ctx, { queueEntryId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    const queueEntry = await ctx.db.get(queueEntryId);
    if (!queueEntry) {
      throw new Error("Queue entry not found");
    }

    // Verify user is the creator
    if (queueEntry.createdBy !== currentUser._id) {
      throw new Error("You can only decline your own queue notifications");
    }

    // Verify notification was sent
    if (!queueEntry.notifiedAt) {
      throw new Error("You have not been notified yet");
    }

    // Remove from queue
    await ctx.db.delete(queueEntryId);

    // Notify next team in queue
    const remainingQueueEntries = await ctx.db
      .query("reservationQueue")
      .withIndex("byActivityDate", (q) =>
        q.eq("activityId", queueEntry.activityId).eq("date", queueEntry.date)
      )
      .collect();

    const nextInQueue = remainingQueueEntries
      .filter((q) => !q.notifiedAt)
      .sort((a, b) => a.createdAt - b.createdAt)[0];

    if (nextInQueue) {
      await ctx.db.patch(nextInQueue._id, {
        notifiedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Cleanup function to delete conversations for finished reservations
export const cleanupFinishedReservations = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const allReservations = await ctx.db.query("reservations").collect();

    // Find reservations that are finished (date/time has passed) and not cancelled
    const finishedReservations = allReservations.filter((r) => {
      if (r.cancelledAt) return false; // Skip already cancelled
      const reservationDateTime = new Date(`${r.date}T${r.time}`);
      return reservationDateTime < now;
    });

    // Delete conversations for finished reservations
    for (const reservation of finishedReservations) {
      await deleteReservationConversation(ctx, reservation._id);
    }

    return {
      success: true,
      cleanedUp: finishedReservations.length,
    };
  },
});

export const getMyQueueNotifications = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get all queue entries where user is creator and has been notified
    const allQueueEntries = await ctx.db.query("reservationQueue").collect();

    const myNotifications = allQueueEntries.filter(
      (q) => q.createdBy === currentUser._id && q.notifiedAt
    );

    // Enrich with activity and team details
    const enrichedNotifications = await Promise.all(
      myNotifications.map(async (entry) => {
        const activity = await ctx.db.get(entry.activityId);
        const teams = await Promise.all(
          entry.teamIds.map((teamId) => ctx.db.get(teamId))
        );

        return {
          ...entry,
          activity: activity
            ? {
                _id: activity._id,
                activityName: activity.activityName,
                address: activity.address,
                availableTimeSlots: activity.availableTimeSlots ?? [],
              }
            : null,
          teams: teams
            .filter((t): t is NonNullable<typeof t> => t !== null)
            .map((t) => ({
              _id: t._id,
              teamName: t.teamName,
              slug: t.slug,
            })),
        };
      })
    );

    // Sort by notification time (most recent first)
    return enrichedNotifications.sort(
      (a, b) => (b.notifiedAt ?? 0) - (a.notifiedAt ?? 0)
    );
  },
});

// Payment Tracking Functions

export const recordPayment = mutation({
  args: {
    reservationId: v.id("reservations"),
    amount: v.float64(),
    personsPaidFor: v.int64(),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      reservationId,
      amount,
      personsPaidFor,
      stripePaymentIntentId,
    }
  ) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get reservation
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    // Verify user is part of one of the teams
    const teams = await Promise.all(
      reservation.teamIds.map((teamId) => ctx.db.get(teamId))
    );
    const validTeams = teams.filter(
      (t): t is NonNullable<typeof t> => t !== null
    );

    const isTeamMember = validTeams.some((team) =>
      team.teammates.includes(currentUser._id)
    );

    if (!isTeamMember && reservation.createdBy !== currentUser._id) {
      throw new Error("User is not a member of the reservation teams");
    }

    // Calculate capture scheduled date (activity date)
    const activityDate = new Date(`${reservation.date}T${reservation.time}`);
    const captureScheduledFor = activityDate.getTime();

    // Record payment
    await ctx.db.insert("reservationPayments", {
      reservationId,
      userId: currentUser._id,
      amount,
      personsPaidFor,
      paidAt: Date.now(),
      stripePaymentIntentId,
      captureScheduledFor,
    });

    // Check if all payments are collected and update status
    await checkAndUpdatePaymentStatus(ctx, reservationId);

    return { success: true };
  },
});

export const getReservationPayments = query({
  args: {
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { reservationId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get reservation
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    // Verify user is part of one of the teams
    const teams = await Promise.all(
      reservation.teamIds.map((teamId) => ctx.db.get(teamId))
    );
    const validTeams = teams.filter(
      (t): t is NonNullable<typeof t> => t !== null
    );

    const isTeamMember = validTeams.some((team) =>
      team.teammates.includes(currentUser._id)
    );

    if (!isTeamMember && reservation.createdBy !== currentUser._id) {
      throw new Error("You do not have access to this reservation");
    }

    // Get all payments for this reservation
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    // Filter out refunded payments
    const activePayments = payments.filter((p) => !p.refundedAt);

    // Get user details for each payment
    const paymentsWithUsers = await Promise.all(
      activePayments.map(async (payment) => {
        const user = await ctx.db.get(payment.userId);
        return {
          ...payment,
          user: user
            ? {
                _id: user._id,
                name: user.name,
                lastname: user.lastname,
                avatar: user.avatar,
              }
            : null,
        };
      })
    );

    return paymentsWithUsers;
  },
});

export const calculatePaymentProgress = query({
  args: {
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { reservationId }) => {
    // Get reservation
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    // Get activity to get price
    const activity = await ctx.db.get(reservation.activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    const totalAmount = activity.price;
    const totalParticipants = Number(reservation.userCount);
    const perPersonAmount = totalAmount / totalParticipants;

    // Get all active payments
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    const activePayments = payments.filter((p) => !p.refundedAt);

    // Calculate collected amount and persons paid for
    const collectedAmount = activePayments.reduce(
      (sum, p) => sum + p.amount,
      0
    );
    const personsPaidFor = activePayments.reduce(
      (sum, p) => sum + Number(p.personsPaidFor),
      0
    );

    const isFullyPaid = collectedAmount >= totalAmount;
    const remainingAmount = Math.max(0, totalAmount - collectedAmount);
    const remainingPersons = totalParticipants - personsPaidFor;

    return {
      totalAmount,
      collectedAmount,
      perPersonAmount,
      totalParticipants,
      personsPaidFor,
      remainingPersons,
      isFullyPaid,
      remainingAmount,
      payments: activePayments.length,
    };
  },
});

export const updatePaymentStatus = mutation({
  args: {
    reservationId: v.id("reservations"),
    status: v.union(
      v.literal("pending"),
      v.literal("on_hold"),
      v.literal("fulfilled"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, { reservationId, status }) => {
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    await ctx.db.patch(reservationId, {
      paymentStatus: status,
    });

    return { success: true };
  },
});

// Helper function to send reservation card update to teams
async function sendReservationCardUpdate(
  ctx: MutationCtx,
  reservationId: Id<"reservations">
): Promise<void> {
  const reservation = await ctx.db.get(reservationId);
  if (!reservation) return;

  const timestamp = Date.now();
  for (const teamId of reservation.teamIds) {
    await ctx.db.insert("groupMessages", {
      teamId,
      senderId: reservation.createdBy,
      text: "Reservation card",
      timestamp,
      messageType: "reservation_card",
      reservationCardData: {
        reservationId,
      },
    });
  }
}

// Helper function to check and update payment status
async function checkAndUpdatePaymentStatus(
  ctx: MutationCtx,
  reservationId: Id<"reservations">
): Promise<void> {
  const reservation = await ctx.db.get(reservationId);
  if (!reservation) return;

  // Only update if status is pending
  if (reservation.paymentStatus !== "pending") return;

  // Get activity
  const activity = await ctx.db.get(reservation.activityId);
  if (!activity) return;

  const totalAmount = activity.price;

  // Get all active payments
  const payments = await ctx.db
    .query("reservationPayments")
    .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
    .collect();

  const activePayments = payments.filter((p) => !p.refundedAt);
  const collectedAmount = activePayments.reduce((sum, p) => sum + p.amount, 0);

  // If fully paid, move to on_hold and send card update
  if (collectedAmount >= totalAmount) {
    await ctx.db.patch(reservationId, {
      paymentStatus: "on_hold",
    });
    // Send card update to teams
    await sendReservationCardUpdate(ctx, reservationId);
  }
}

// Function to check and update payment status when activity date passes
// Made internal so it can be called from scheduled jobs
export const checkAndFulfillReservations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allReservations = await ctx.db.query("reservations").collect();

    // Find reservations that should be fulfilled (activity date passed, status is on_hold)
    const reservationsToFulfill = allReservations.filter((r) => {
      if (r.paymentStatus !== "on_hold") return false;
      if (r.cancelledAt) return false;

      // Parse the activity date and time
      let activityDateTime: Date;
      if (r.time.includes("-")) {
        // Time range, use start time
        const startTime = r.time.split("-")[0].trim();
        activityDateTime = new Date(`${r.date}T${startTime}`);
      } else {
        // Single time
        activityDateTime = new Date(`${r.date}T${r.time}`);
      }

      // Check if activity date/time has passed
      return activityDateTime.getTime() < now;
    });

    // Update status, capture payments, and send card updates
    for (const reservation of reservationsToFulfill) {
      // Capture all payments for this reservation
      const payments = await ctx.db
        .query("reservationPayments")
        .withIndex("byReservation", (q) =>
          q.eq("reservationId", reservation._id)
        )
        .collect();

      const uncapturedPayments = payments.filter(
        (p) => p.stripePaymentIntentId && !p.capturedAt && !p.refundedAt
      );

      // Capture each payment
      let allCaptured = true;
      for (const payment of uncapturedPayments) {
        if (payment.stripePaymentIntentId) {
          try {
            const result = await ctx.runMutation(
              internal.stripe.capturePayment,
              {
                paymentIntentId: payment.stripePaymentIntentId,
                reservationId: reservation._id,
              }
            );
            if (!result.success) {
              allCaptured = false;
              console.error(
                `Failed to capture payment ${payment.stripePaymentIntentId}`
              );
            }
          } catch (error) {
            console.error("Error capturing payment:", error);
            allCaptured = false;
          }
        }
      }

      // Only mark as fulfilled if all payments were successfully captured
      // or if there are no payments to capture (edge case)
      if (allCaptured || uncapturedPayments.length === 0) {
        await ctx.db.patch(reservation._id, {
          paymentStatus: "fulfilled",
        });
        await sendReservationCardUpdate(ctx, reservation._id);
        console.log(`Reservation ${reservation._id} marked as fulfilled`);
      } else {
        console.warn(
          `Reservation ${reservation._id} has some uncaptured payments, status not updated`
        );
      }
    }

    return {
      success: true,
      fulfilled: reservationsToFulfill.length,
    };
  },
});

// Helper mutation to capture payment for a reservation
export const captureReservationPayments = mutation({
  args: {
    reservationId: v.id("reservations"),
  },
  handler: async (
    ctx,
    { reservationId }
  ): Promise<{
    success: boolean;
    captured: number;
    results: Array<
      { success: boolean; amount: number; status: string } | { error: string }
    >;
  }> => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get reservation
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    // Verify user is organizer
    const allOrganisations = await ctx.db.query("organisations").collect();
    const organisation = allOrganisations.find((org) =>
      org.activityIDs.includes(reservation.activityId)
    );

    if (
      !organisation ||
      !organisation.organisersIDs.includes(currentUser._id)
    ) {
      throw new Error("Only organizers can capture payments");
    }

    // Get all uncaptured payments
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    const uncapturedPayments = payments.filter(
      (p) => p.stripePaymentIntentId && !p.capturedAt && !p.refundedAt
    );

    // Capture each payment using the stripe mutation
    const captureResults: Array<
      { success: boolean; amount: number; status: string } | { error: string }
    > = [];
    for (const payment of uncapturedPayments) {
      if (payment.stripePaymentIntentId) {
        try {
          const result: { success: boolean; amount: number; status: string } =
            await ctx.runMutation(internal.stripe.capturePayment, {
              paymentIntentId: payment.stripePaymentIntentId,
              reservationId,
            });
          captureResults.push(result);
        } catch (error) {
          console.error("Error capturing payment:", error);
          captureResults.push({
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    return {
      success: true,
      captured: captureResults.length,
      results: captureResults,
    };
  },
});

export const getReservationCardData = query({
  args: {
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { reservationId }) => {
    // Get reservation
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      return null;
    }

    // Get activity
    const activity = await ctx.db.get(reservation.activityId);
    if (!activity) {
      return null;
    }

    // Get teams
    const teams = await Promise.all(
      reservation.teamIds.map((teamId) => ctx.db.get(teamId))
    );
    const validTeams = teams.filter(
      (t): t is NonNullable<typeof t> => t !== null
    );

    // Collect all unique participant IDs
    const participantIds = new Set<Id<"users">>();
    for (const team of validTeams) {
      for (const teammateId of team.teammates) {
        participantIds.add(teammateId);
      }
    }

    // Get participant details
    const participants = await Promise.all(
      Array.from(participantIds).map((id) => ctx.db.get(id))
    );
    const participantDetails = participants
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        lastname: p.lastname,
        avatar: p.avatar,
      }));

    // Calculate payment progress
    const totalAmount = activity.price;
    const totalParticipants = Number(reservation.userCount);
    const perPersonAmount = totalAmount / totalParticipants;

    // Get all active payments
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    const activePayments = payments.filter((p) => !p.refundedAt);
    const collectedAmount = activePayments.reduce(
      (sum, p) => sum + p.amount,
      0
    );
    const personsPaidFor = activePayments.reduce(
      (sum, p) => sum + Number(p.personsPaidFor),
      0
    );

    const paymentProgress = {
      totalAmount,
      collectedAmount,
      perPersonAmount,
      totalParticipants,
      personsPaidFor,
      remainingPersons: totalParticipants - personsPaidFor,
      isFullyPaid: collectedAmount >= totalAmount,
      remainingAmount: Math.max(0, totalAmount - collectedAmount),
      payments: activePayments.length,
    };

    return {
      reservation: {
        _id: reservation._id,
        date: reservation.date,
        time: reservation.time,
        userCount: reservation.userCount,
        paymentStatus: reservation.paymentStatus,
        paymentDeadline: reservation.paymentDeadline,
        cancelledAt: reservation.cancelledAt,
      },
      activity: {
        _id: activity._id,
        activityName: activity.activityName,
        description: activity.description,
        images: activity.images,
        duration: activity.duration,
        price: activity.price,
      },
      teams: validTeams.map((t) => ({
        _id: t._id,
        teamName: t.teamName,
      })),
      paymentProgress,
      participants: participantDetails,
    };
  },
});
