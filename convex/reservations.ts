import {
  mutation,
  query,
  MutationCtx,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow, getCurrentUser } from "./users";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

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

      // Find the organiser (owner of the activity's organisation)
      const allOrganisations = await ctx.db.query("organisations").collect();
      const organisation = allOrganisations.find((org) =>
        org.activityIDs.includes(activityId)
      );

      if (!organisation || organisation.organisersIDs.length === 0) {
        return { success: false, error: "Activity organiser not found" };
      }

      if (organisation.organisersIDs.includes(currentUser._id)) {
        return {
          success: false,
          error: "You cannot make reservations for your own activities.",
        };
      }

      // Get the first organiser (primary organiser)
      const organiserId = organisation.organisersIDs[0];
      const organiser = await ctx.db.get(organiserId);
      if (!organiser) {
        return { success: false, error: "Organiser user not found" };
      }

      // Create or find conversation between organiser and user
      // Note: No need to be friends for reservation chats
      const userIds = [organiserId, currentUser._id].sort((a, b) =>
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

      let conversationId: Id<"conversations">;
      if (existingConversation) {
        conversationId = existingConversation._id;
        // Update conversation to link to reservation if not already linked
        if (!existingConversation.reservationId) {
          // We'll update this after creating the reservation
        }
      } else {
        // Create new conversation
        conversationId = await ctx.db.insert("conversations", {
          user1Id,
          user2Id,
          createdAt: Date.now(),
        });
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
        readByOrganiser: false,
        reservationChatId: conversationId,
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
        await ctx.db.patch(conversationId, {
          reservationId,
        });
      }

      // Send reservation card to each team's chat
      for (const teamId of teamIds) {
        await ctx.db.insert("groupMessages", {
          teamId,
          senderId: currentUser._id,
          text: "Reservation card",
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

// Helper to auto-assign the first-in-queue to a freed slot when a reservation is cancelled.
// Returns { assigned: true, reservationId } on success, or { assigned: false } if validation fails.
async function assignFirstInQueueToFreedSlot(
  ctx: MutationCtx,
  p: {
    activityId: Id<"activities">;
    date: string;
    time: string;
    queueEntry: Doc<"reservationQueue">;
  }
): Promise<
  | { assigned: true; reservationId: Id<"reservations"> }
  | { assigned: false }
> {
  const { activityId, date, time, queueEntry } = p;

  const activity = await ctx.db.get(activityId);
  if (!activity) return { assigned: false };

  const availableTimeSlots = activity.availableTimeSlots ?? [];
  if (availableTimeSlots.length === 0 || !availableTimeSlots.includes(time)) {
    return { assigned: false };
  }

  const now = new Date();
  const activityDateTime = new Date(`${date}T${time}`);
  if (activityDateTime <= now) return { assigned: false };

  for (const teamId of queueEntry.teamIds) {
    const team = await ctx.db.get(teamId);
    if (!team || team.createdBy !== queueEntry.createdBy) {
      return { assigned: false };
    }
  }

  if (
    activity.maxParticipants &&
    queueEntry.userCount > Number(activity.maxParticipants)
  ) {
    return { assigned: false };
  }

  const allOrganisations = await ctx.db.query("organisations").collect();
  const organisation = allOrganisations.find((org) =>
    org.activityIDs.includes(activityId)
  );
  if (!organisation || organisation.organisersIDs.length === 0) {
    return { assigned: false };
  }

  const organiserId = organisation.organisersIDs[0];
  const organiser = await ctx.db.get(organiserId);
  if (!organiser) return { assigned: false };

  const userIds = [organiserId, queueEntry.createdBy].sort((a, b) =>
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

  let conversationId: Id<"conversations">;
  if (existingConversation) {
    conversationId = existingConversation._id;
  } else {
    conversationId = await ctx.db.insert("conversations", {
      user1Id,
      user2Id,
      createdAt: Date.now(),
    });
  }

  const sevenDaysBefore = new Date(activityDateTime);
  sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
  const paymentDeadline =
    sevenDaysBefore > now
      ? sevenDaysBefore.getTime()
      : activityDateTime.getTime();

  const reservationId = await ctx.db.insert("reservations", {
    activityId,
    date,
    time,
    teamIds: queueEntry.teamIds,
    userCount: queueEntry.userCount,
    createdBy: queueEntry.createdBy,
    readByOrganiser: false,
    reservationChatId: conversationId,
    paymentStatus: "pending",
    paymentDeadline,
  });

  if (existingConversation && !existingConversation.reservationId) {
    await ctx.db.patch(existingConversation._id, { reservationId });
  } else if (!existingConversation) {
    await ctx.db.patch(conversationId, { reservationId });
  }

  for (const teamId of queueEntry.teamIds) {
    await ctx.db.insert("groupMessages", {
      teamId,
      senderId: queueEntry.createdBy,
      text: "Reservation card",
      messageType: "reservation_card",
      reservationCardData: { reservationId },
    });
  }

  await ctx.db.delete(queueEntry._id);

  return { assigned: true, reservationId };
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

    // Get activity to find organiser
    const activity = await ctx.db.get(reservation.activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    // Allow organiser or team creator (createdBy) to cancel
    const allOrganisations = await ctx.db.query("organisations").collect();
    const organisation = allOrganisations.find((org) =>
      org.activityIDs.includes(reservation.activityId)
    );
    const isOrganiser =
      organisation?.organisersIDs.includes(currentUser._id) ?? false;
    const isTeamCreator = reservation.createdBy === currentUser._id;

    if (!isOrganiser && !isTeamCreator) {
      throw new Error(
        "Only the activity organiser or the team creator can cancel reservations"
      );
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
        // Schedule action to refund payment (actions can use Stripe SDK)
        await ctx.scheduler.runAfter(0, internal.stripe.refundPayment, {
          paymentIntentId: payment.stripePaymentIntentId,
          reservationId,
        });
        // Mark as refunded in our database immediately (action will also update it)
        await ctx.db.patch(payment._id, {
          refundedAt: Date.now(),
        });
      } else {
        // No Stripe payment intent, just mark as refunded in our database
        await ctx.db.patch(payment._id, {
          refundedAt: Date.now(),
        });
      }
    }

    // Send card update to teams
    await sendReservationCardUpdate(ctx, reservationId);

    // Delete reservation conversation and messages
    await deleteReservationConversation(ctx, reservationId);

    // Only notify queue if the freed date is still in the future (or today)
    const freedDateStart = new Date(`${reservation.date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (freedDateStart >= today) {
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
        const result = await assignFirstInQueueToFreedSlot(ctx, {
          activityId: reservation.activityId,
          date: reservation.date,
          time: reservation.time,
          queueEntry: firstInQueue,
        });
        if (result.assigned) {
          return {
            success: true,
            queueNotified: false,
            autoAssigned: true,
            reservationId: result.reservationId,
          };
        }
        // Fallback: validation failed or slot in the past
        await ctx.db.patch(firstInQueue._id, {
          notifiedAt: Date.now(),
        });
        return {
          success: true,
          queueNotified: true,
          queueEntryId: firstInQueue._id,
        };
      }
    }

    return { success: true, queueNotified: false };
  },
});

export const getReservationsForOrganiser = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Check if user is an organiser
    if (currentUser.role !== "organiser") {
      return [];
    }

    // Find organisation(s) where user is an organiser
    const allOrganisations = await ctx.db.query("organisations").collect();
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return [];
    }

    // Get all activity IDs from user's organisations
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
    const organiserReservations = allReservations.filter((r) =>
      activityIds.has(r.activityId)
    );

    // Enrich reservations with related data
    const enrichedReservations = await Promise.all(
      organiserReservations.map(async (reservation) => {
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

export const getPaymentDetailsForOrganiser = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Check if user is an organiser
    if (currentUser.role !== "organiser") {
      return [];
    }

    // Find organisation(s) where user is an organiser
    const allOrganisations = await ctx.db.query("organisations").collect();
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return [];
    }

    // Get all activity IDs from user's organisations
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
    const organiserReservations = allReservations.filter((r) =>
      activityIds.has(r.activityId)
    );

    // Enrich reservations with payment details
    const paymentDetails = await Promise.all(
      organiserReservations.map(async (reservation) => {
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

    // Check if user is an organiser
    if (currentUser.role !== "organiser") {
      return 0;
    }

    // Find organisation(s) where user is an organiser
    const allOrganisations = await ctx.db.query("organisations").collect();
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return 0;
    }

    // Get all activity IDs from user's organisations
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
    const organiserReservations = allReservations.filter((r) =>
      activityIds.has(r.activityId)
    );

    // Count unread active reservations (readByOrganizer is false or undefined, not cancelled)
    const unreadCount = organiserReservations.filter(
      (r) => r.readByOrganiser !== true && !r.cancelledAt
    ).length;

    return unreadCount;
  },
});

export const markReservationsAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Check if user is an organiser
    if (currentUser.role !== "organiser") {
      return { success: true, count: 0 };
    }

    // Find organisation(s) where user is an organiser
    const allOrganisations = await ctx.db.query("organisations").collect();
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return { success: true, count: 0 };
    }

    // Get all activity IDs from user's organisations
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
    const organiserReservations = allReservations.filter(
      (r) =>
        activityIds.has(r.activityId) &&
        r.readByOrganiser !== true &&
        !r.cancelledAt
    );

    // Mark all as read
    let count = 0;
    for (const reservation of organiserReservations) {
      await ctx.db.patch(reservation._id, {
        readByOrganiser: true,
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

    // Reject past dates
    const dateStart = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateStart < today) {
      throw new Error("Cannot join the queue for a date in the past.");
    }

    // Get activity
    const activity = await ctx.db.get(activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    // Validate userCount is positive
    if (userCount <= 0) {
      throw new Error("User count must be greater than 0");
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

    // Reject if user is an organiser of this activity
    const allOrganisations = await ctx.db.query("organisations").collect();
    const organisation = allOrganisations.find((org) =>
      org.activityIDs.includes(activityId)
    );
    if (organisation?.organisersIDs.includes(currentUser._id)) {
      throw new Error("You cannot join the queue for your own activities.");
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
        return {
          success: false as const,
          error: `Team ${team.teamName} already has a reservation for this activity on ${date}.`,
        };
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

      const alreadyInQueue = existingQueueEntries.some((q) =>
        q.teamIds.includes(teamId)
      );

      if (alreadyInQueue) {
        return {
          success: false as const,
          error: `Team ${team.teamName} is already in the queue for this date.`,
        };
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

    // Check if user is an organiser
    if (currentUser.role !== "organiser") {
      return [];
    }

    // Find organisation(s) where user is an organiser
    const allOrganisations = await ctx.db.query("organisations").collect();
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return [];
    }

    // Verify activity belongs to user's organisation
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

    // Find organiser
    const allOrganisations = await ctx.db.query("organisations").collect();
    const organisation = allOrganisations.find((org) =>
      org.activityIDs.includes(queueEntry.activityId)
    );

    if (!organisation || organisation.organisersIDs.length === 0) {
      throw new Error("Activity organiser not found");
    }

    const organiserId = organisation.organisersIDs[0];
    const organiser = await ctx.db.get(organiserId);
    if (!organiser) {
      throw new Error("Organiser user not found");
    }

    // Create conversation
    const userIds = [organiserId, currentUser._id].sort((a, b) =>
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

    let conversationId: Id<"conversations">;
    if (existingConversation) {
      conversationId = existingConversation._id;
    } else {
      conversationId = await ctx.db.insert("conversations", {
        user1Id,
        user2Id,
        createdAt: Date.now(),
      });
    }

    // Validate date/time is in the future
    const now = new Date();
    const activityDate = new Date(`${queueEntry.date}T${time}`);
    if (activityDate <= now) {
      throw new Error("Reservation date and time must be in the future");
    }

    // Calculate payment deadline (7 days before activity, or activity date if less than 7 days away)
    const sevenDaysBefore = new Date(activityDate);
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
    const paymentDeadline =
      sevenDaysBefore > now
        ? sevenDaysBefore.getTime()
        : activityDate.getTime();

    // Create reservation
    const reservationId = await ctx.db.insert("reservations", {
      activityId: queueEntry.activityId,
      date: queueEntry.date,
      time,
      teamIds: queueEntry.teamIds,
      userCount: queueEntry.userCount,
      createdBy: currentUser._id,
      readByOrganiser: false,
      reservationChatId: conversationId,
      paymentStatus: "pending",
      paymentDeadline,
    });

    // Link conversation to reservation
    if (existingConversation && !existingConversation.reservationId) {
      await ctx.db.patch(existingConversation._id, {
        reservationId,
      });
    } else if (!existingConversation) {
      await ctx.db.patch(conversationId, {
        reservationId,
      });
    }

    // Send reservation card to each team's chat
    for (const teamId of queueEntry.teamIds) {
      await ctx.db.insert("groupMessages", {
        teamId,
        senderId: currentUser._id,
        text: "Reservation card",
        messageType: "reservation_card",
        reservationCardData: {
          reservationId,
        },
      });
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
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return [];
    }

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
    stripeSetupIntentId: v.optional(v.string()),
    stripePaymentMethodId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      reservationId,
      amount,
      personsPaidFor,
      stripePaymentIntentId,
      stripeSetupIntentId,
      stripePaymentMethodId,
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

    // Record payment (with SetupIntent ID and payment method ID - PaymentIntent will be created when team saldo is fulfilled)
    await ctx.db.insert("reservationPayments", {
      reservationId,
      userId: currentUser._id,
      amount,
      personsPaidFor,
      paidAt: Date.now(),
      stripePaymentIntentId, // May be null initially, set when team PaymentIntent is created
      stripeSetupIntentId, // SetupIntent used to collect payment method
      stripePaymentMethodId, // Payment method ID from SetupIntent
      captureScheduledFor,
    });

    // Check if all payments are collected and update status
    await checkAndUpdatePaymentStatus(ctx, reservationId);

    // Check if team's saldo is fulfilled and create payment intent if needed
    await checkAndCreateTeamPaymentIntent(ctx, reservationId, currentUser._id);

    return { success: true };
  },
});

// Internal query to get reservation payments without authentication (for use by actions)
export const getReservationPaymentsInternal = internalMutation({
  args: {
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { reservationId }) => {
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
                email: user.email,
              }
            : null,
        };
      })
    );

    return paymentsWithUsers;
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

    // Check if user is the creator
    const isCreator = reservation.createdBy === currentUser._id;

    // Check if user is an organiser of the activity's organisation
    let isOrganiser = false;
    if (currentUser.role === "organiser") {
      const allOrganisations = await ctx.db.query("organisations").collect();
      const activityOrganisation = allOrganisations.find((org) =>
        org.activityIDs.includes(reservation.activityId)
      );
      isOrganiser =
        activityOrganisation?.organisersIDs.includes(currentUser._id) ?? false;
    }

    if (!isTeamMember && !isCreator && !isOrganiser) {
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
                email: user.email,
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

    // Derive totalParticipants from actual team rosters (updates when users are added/removed via inviteFriendToTeam, etc.)
    const teams = await Promise.all(
      reservation.teamIds.map((teamId) => ctx.db.get(teamId))
    );
    const validTeams = teams.filter(
      (t): t is NonNullable<typeof t> => t !== null
    );
    const participantIds = new Set<Id<"users">>();
    for (const team of validTeams) {
      for (const id of team.teammates) {
        participantIds.add(id);
      }
    }

    const totalAmount = activity.price;
    const totalParticipants = Math.max(1, participantIds.size);
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

  for (const teamId of reservation.teamIds) {
    await ctx.db.insert("groupMessages", {
      teamId,
      senderId: reservation.createdBy,
      text: "Reservation card",
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

// Helper function to check if team's saldo is fulfilled and create payment intent
async function checkAndCreateTeamPaymentIntent(
  ctx: MutationCtx,
  reservationId: Id<"reservations">,
  userId: Id<"users">
): Promise<void> {
  const reservation = await ctx.db.get(reservationId);
  if (!reservation) return;

  // Get activity
  const activity = await ctx.db.get(reservation.activityId);
  if (!activity) return;

  const totalAmount = activity.price;

  // Get all teams for this reservation
  const teams = await Promise.all(
    reservation.teamIds.map((teamId) => ctx.db.get(teamId))
  );
  const validTeams = teams.filter(
    (t): t is NonNullable<typeof t> => t !== null
  );

  // Find which team the user belongs to
  const userTeam = validTeams.find((team) =>
    team.teammates.includes(userId)
  );
  if (!userTeam) return;

  // Get all payments for this reservation from this team
  const allPayments = await ctx.db
    .query("reservationPayments")
    .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
    .collect();

  // Filter payments by team members
  const teamMemberIds = new Set(userTeam.teammates);
  const teamPayments = allPayments.filter(
    (p) => teamMemberIds.has(p.userId) && !p.refundedAt
  );

  // Check if team already has a payment intent that is modifiable
  // Get all unique payment intent IDs for this team
  const teamPaymentIntentIds = Array.from(
    new Set(
      teamPayments
        .map((p) => p.stripePaymentIntentId)
        .filter((id): id is string => id !== undefined)
    )
  );

  if (teamPaymentIntentIds.length > 0) {
    // Team already has payment intent(s), check if any are modifiable
    // If multiple exist, they should be consolidated (handled by getStripePaymentIntentsForOrganiser)
    // For now, if any payment intent exists, don't create another one
    // The consolidation logic will handle merging multiple intents
    return;
  }

  // Calculate team's collected amount (saldo)
  const teamCollectedAmount = teamPayments.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  // Calculate how much the team needs to pay
  // For simplicity, assume team pays for all participants in reservation
  // You may need to adjust this based on your business logic
  const teamRequiredAmount = totalAmount;

  // Check if all team members have provided payment methods (via SetupIntent)
  const teamPaymentsWithPaymentMethods = teamPayments.filter(
    (p) => p.stripePaymentMethodId !== undefined
  );

  // If team's saldo is fulfilled AND all team members have provided payment methods, create payment intent
  // Note: Payment intent creation must happen in an action (not mutation) because
  // Stripe SDK uses setTimeout internally. We use ctx.scheduler to schedule it.
  if (
    teamCollectedAmount >= teamRequiredAmount &&
    teamPaymentsWithPaymentMethods.length === teamPayments.length &&
    teamPayments.length > 0
  ) {
    // Schedule the payment intent creation to run as an action
    // This is necessary because Stripe SDK uses setTimeout which isn't allowed in mutations
    try {
      // Schedule the action to run immediately (delay 0)
      await ctx.scheduler.runAfter(
        0,
        internal.stripe.createTeamPaymentIntentInternal,
        {
          reservationId,
          teamId: userTeam._id,
          amount: teamCollectedAmount,
        }
      );
    } catch (error) {
      console.error("Error scheduling team payment intent creation:", error);
      // Don't throw - payment is still recorded, intent can be created later
    }
  }
}

// Function to check and cancel reservations if payment not complete on activity date
// Made internal so it can be called from scheduled jobs
// Runs daily to check if reservations should be cancelled
export const checkAndCancelUnpaidReservations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    const todayDateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format
    const allReservations = await ctx.db.query("reservations").collect();

    // Find reservations that should be cancelled (activity date matches today exactly, payment status is pending)
    const reservationsToCancel = allReservations.filter((r) => {
      if (r.paymentStatus !== "pending") return false;
      if (r.cancelledAt) return false;

      // Check if activity date exactly matches today (not if it's passed)
      // Compare date strings (YYYY-MM-DD format)
      return r.date === todayDateStr;
    });

    // Cancel reservations that haven't been paid by activity date
    for (const reservation of reservationsToCancel) {
      // Mark reservation as cancelled
      await ctx.db.patch(reservation._id, {
        cancelledAt: Date.now(),
        cancellationReason: "Payment not completed by activity date",
        paymentStatus: "cancelled",
      });

      // Refund all payments
      const payments = await ctx.db
        .query("reservationPayments")
        .withIndex("byReservation", (q) =>
          q.eq("reservationId", reservation._id)
        )
        .collect();

      const activePayments = payments.filter((p) => !p.refundedAt);
      for (const payment of activePayments) {
        // If payment has Stripe payment intent, refund it
        if (payment.stripePaymentIntentId) {
          // Schedule action to refund payment (actions can use Stripe SDK)
          await ctx.scheduler.runAfter(0, internal.stripe.refundPayment, {
            paymentIntentId: payment.stripePaymentIntentId,
            reservationId: reservation._id,
          });
          // Mark as refunded in our database immediately (action will also update it)
          await ctx.db.patch(payment._id, {
            refundedAt: Date.now(),
          });
        } else {
          // No Stripe payment intent, just mark as refunded in our database
          await ctx.db.patch(payment._id, {
            refundedAt: Date.now(),
          });
        }
      }

      // Re-fetch reservation to ensure we have the latest data before sending card update
      const updatedReservation = await ctx.db.get(reservation._id);
      if (updatedReservation) {
        // Send card update to teams
        await sendReservationCardUpdate(ctx, reservation._id);
      }

      // Send notification message to reservation conversation before deleting it
      const allConversations = await ctx.db.query("conversations").collect();
      const reservationConversation = allConversations.find(
        (c) => c.reservationId === reservation._id
      );

      if (reservationConversation) {
        // Find the organiser to send the message as
        const allOrganisations = await ctx.db.query("organisations").collect();
        const activityOrganisation = allOrganisations.find((org) =>
          org.activityIDs.includes(reservation.activityId)
        );

        if (activityOrganisation && activityOrganisation.organisersIDs.length > 0) {
          // Find which organiser is in the conversation
          const organiserInConversation = activityOrganisation.organisersIDs.find(
            (orgId) =>
              orgId === reservationConversation.user1Id ||
              orgId === reservationConversation.user2Id
          );

          if (organiserInConversation) {
            // Determine the receiver (the customer - the other user in the conversation)
            const customerId =
              reservationConversation.user1Id === organiserInConversation
                ? reservationConversation.user2Id
                : reservationConversation.user1Id;

            // Send notification message from organiser to customer
            await ctx.db.insert("messages", {
              senderId: organiserInConversation,
              receiverId: customerId,
              text: "Your reservation has been automatically cancelled because payment was not completed by the activity date. Any payments made have been refunded.",
            });
          }
        }
      }

      // Delete reservation conversation and messages
      await deleteReservationConversation(ctx, reservation._id);

      // Only notify queue if the freed date is still in the future (or today)
      const freedDateStart = new Date(`${reservation.date}T00:00:00`);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (freedDateStart >= todayStart) {
        // Check queue for this activity/date and notify first team
        const queueEntries = await ctx.db
          .query("reservationQueue")
          .withIndex("byActivityDate", (q) =>
            q
              .eq("activityId", reservation.activityId)
              .eq("date", reservation.date)
          )
          .collect();

        // Sort by createdAt (FIFO) and find first non-notified entry
        const sortedQueue = queueEntries
          .filter((q) => !q.notifiedAt)
          .sort((a, b) => a.createdAt - b.createdAt);

        if (sortedQueue.length > 0) {
          const firstInQueue = sortedQueue[0];
          const result = await assignFirstInQueueToFreedSlot(ctx, {
            activityId: reservation.activityId,
            date: reservation.date,
            time: reservation.time,
            queueEntry: firstInQueue,
          });
          if (!result.assigned) {
            await ctx.db.patch(firstInQueue._id, {
              notifiedAt: Date.now(),
            });
          }
        }
      }

      console.log(
        `Reservation ${reservation._id} automatically cancelled due to incomplete payment`
      );
    }

    return {
      success: true,
      cancelled: reservationsToCancel.length,
    };
  },
});

// Function to check and update payment status on activity day
// Made internal so it can be called from scheduled jobs
export const checkAndFulfillReservations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    const todayDateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format
    const allReservations = await ctx.db.query("reservations").collect();

    // Find reservations that should be fulfilled (activity date is today, status is on_hold)
    const reservationsToFulfill = allReservations.filter((r) => {
      if (r.paymentStatus !== "on_hold") return false;
      if (r.cancelledAt) return false;

      // Check if activity date matches today (not if it has passed)
      // Compare date strings (YYYY-MM-DD format)
      return r.date === todayDateStr;
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
      // Note: capturePayment already updates status and sends card updates via checkAndUpdateFulfilledStatusHelper
      // But we also update here as a fallback in case all payments were already captured
      if (allCaptured || uncapturedPayments.length === 0) {
        // Double-check status - capturePayment may have already updated it
        const updatedReservation = await ctx.db.get(reservation._id);
        if (updatedReservation && updatedReservation.paymentStatus !== "fulfilled") {
          await ctx.db.patch(reservation._id, {
            paymentStatus: "fulfilled",
          });
          await sendReservationCardUpdate(ctx, reservation._id);
          console.log(`Reservation ${reservation._id} marked as fulfilled`);
        }
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

    // Verify user is organiser
    const allOrganisations = await ctx.db.query("organisations").collect();
    const organisation = allOrganisations.find((org) =>
      org.activityIDs.includes(reservation.activityId)
    );

    if (
      !organisation ||
      !organisation.organisersIDs.includes(currentUser._id)
    ) {
      throw new Error("Only organisers can capture payments");
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

// Internal mutation to update payment capturedAt timestamp
export const updatePaymentCapturedAt = internalMutation({
  args: {
    paymentId: v.id("reservationPayments"),
    capturedAt: v.number(),
  },
  handler: async (ctx, { paymentId, capturedAt }) => {
    await ctx.db.patch(paymentId, {
      capturedAt,
    });
  },
});

// Internal mutation to update payment capturedAt from action and check if all payments are captured
export const updatePaymentCapturedAtFromAction = internalMutation({
  args: {
    paymentIntentId: v.string(),
    reservationId: v.id("reservations"),
    capturedAt: v.number(),
  },
  handler: async (ctx, { paymentIntentId, reservationId, capturedAt }) => {
    // Get all payments for this reservation
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    // Find the payment with this payment intent ID
    const payment = payments.find(
      (p) => p.stripePaymentIntentId === paymentIntentId
    );

    if (payment && !payment.capturedAt) {
      // Update payment record
      await ctx.db.patch(payment._id, {
        capturedAt,
      });

      // Check if all payments are captured and update reservation status
      // This will also send card updates if status changes to fulfilled
      await checkAndUpdateFulfilledStatusHelper(ctx, reservationId);
    }
  },
});

// Internal mutation to update payment refundedAt timestamp
export const updatePaymentRefundedAt = internalMutation({
  args: {
    paymentIntentId: v.string(),
    reservationId: v.id("reservations"),
    refundedAt: v.number(),
  },
  handler: async (ctx, { paymentIntentId, reservationId, refundedAt }) => {
    // Get all payments for this reservation
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();
    
    // Find the payment with this payment intent ID
    const payment = payments.find(
      (p) => p.stripePaymentIntentId === paymentIntentId
    );
    
    if (payment) {
      await ctx.db.patch(payment._id, {
        refundedAt,
      });
    }
  },
});

// Internal mutation to update payment from webhook
export const updatePaymentFromWebhook = internalMutation({
  args: {
    paymentIntentId: v.string(),
    reservationId: v.id("reservations"),
    capturedAt: v.number(),
  },
  handler: async (ctx, { paymentIntentId, reservationId, capturedAt }) => {
    // Get all payments for this reservation
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();
    
    // Find the payment with this payment intent ID
    const payment = payments.find(
      (p) => p.stripePaymentIntentId === paymentIntentId
    );
    
    if (payment && !payment.capturedAt) {
      // Update payment record
      await ctx.db.patch(payment._id, {
        capturedAt,
      });
      
      // Check if all payments are captured and update reservation status
      await checkAndUpdateFulfilledStatusHelper(ctx, reservationId);
    }
  },
});

// Helper function to check if all payments are captured and update reservation status to fulfilled
async function checkAndUpdateFulfilledStatusHelper(
  ctx: MutationCtx,
  reservationId: Id<"reservations">
): Promise<void> {
  const reservation = await ctx.db.get(reservationId);
  if (!reservation) return;

  // Only update if status is on_hold
  if (reservation.paymentStatus !== "on_hold") return;

  // Get all payments for this reservation
  const payments = await ctx.db
    .query("reservationPayments")
    .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
    .collect();

  // Filter to only payments with payment intents (not refunded)
  const activePayments = payments.filter(
    (p) => p.stripePaymentIntentId && !p.refundedAt
  );

  // Check if all active payments are captured
  const allCaptured = activePayments.length > 0 && activePayments.every((p) => p.capturedAt);

  if (allCaptured) {
    await ctx.db.patch(reservationId, {
      paymentStatus: "fulfilled",
    });
    await sendReservationCardUpdate(ctx, reservationId);
    console.log(`Reservation ${reservationId} marked as fulfilled`);
  }
}

// Internal mutation to check if all payments are captured and update reservation status to fulfilled
export const checkAndUpdateFulfilledStatus = internalMutation({
  args: {
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { reservationId }) => {
    await checkAndUpdateFulfilledStatusHelper(ctx, reservationId);
  },
});

// Internal mutation to update team payment intent IDs (used by team payment intent creation)
export const updateTeamPaymentIntentIds = internalMutation({
  args: {
    reservationId: v.id("reservations"),
    teamId: v.id("teams"),
    paymentIntentId: v.string(),
  },
  handler: async (ctx, { reservationId, teamId, paymentIntentId }) => {
    // Get all payments for this reservation
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    // Get team to filter by team members
    const team = await ctx.db.get(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    const teamMemberIds = new Set(team.teammates);

    // Update all payments from this team that don't have a payment intent ID
    for (const payment of payments) {
      if (
        teamMemberIds.has(payment.userId) &&
        !payment.stripePaymentIntentId &&
        !payment.refundedAt
      ) {
        await ctx.db.patch(payment._id, {
          stripePaymentIntentId: paymentIntentId,
        });
      }
    }

    return { success: true };
  },
});

// Internal mutation to update payment intent IDs (used by consolidation)
export const updatePaymentIntentIds = internalMutation({
  args: {
    reservationId: v.id("reservations"),
    oldPaymentIntentIds: v.array(v.string()),
    newPaymentIntentId: v.string(),
  },
  handler: async (ctx, { reservationId, oldPaymentIntentIds, newPaymentIntentId }) => {
    // Get all payments for this reservation
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    // Update all payments that reference the old payment intent IDs
    for (const payment of payments) {
      if (
        payment.stripePaymentIntentId &&
        oldPaymentIntentIds.includes(payment.stripePaymentIntentId) &&
        !payment.capturedAt &&
        !payment.refundedAt
      ) {
        await ctx.db.patch(payment._id, {
          stripePaymentIntentId: newPaymentIntentId,
        });
      }
    }

    return { success: true, updated: payments.length };
  },
});

export const getReservationCardData = query({
  args: {
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { reservationId }) => {
    const currentUser = await getCurrentUser(ctx);

    // Get reservation
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      return null;
    }

    const isTeamCreator =
      !!currentUser && reservation.createdBy === currentUser._id;

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

    // Calculate payment progress from actual team roster (updates when users are added/removed from teams)
    const totalAmount = activity.price;
    const totalParticipants = Math.max(1, participantIds.size);
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

    // Can leave review: fulfilled (payment captured), user is participant, not yet reviewed
    const isParticipant = !!currentUser && participantIds.has(currentUser._id);
    const hasReviewed = currentUser
      ? (await ctx.db
          .query("reviews")
          .withIndex("byUserAndActivity", (q) =>
            q.eq("userId", currentUser._id).eq("activityId", reservation.activityId)
          )
          .unique()) != null
      : false;
    const canLeaveReview =
      isParticipant &&
      (reservation.paymentStatus === "fulfilled") &&
      !hasReviewed;

    return {
      isTeamCreator,
      canLeaveReview,
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
