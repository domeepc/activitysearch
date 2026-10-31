import {
  mutation,
  query,
  MutationCtx,
  QueryCtx,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow, getCurrentUser } from "./users";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { effectiveReservationTotalPrice } from "../lib/reservationsPricing";
import { reservationStartMs, todayInAppZone } from "../lib/reservationTime";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Older activities are only linked through org.activityIDs, so fall back to a scan.
async function organisationForActivity(
  ctx: QueryCtx,
  activityId: Id<"activities">
): Promise<Doc<"organisations"> | null> {
  const activity = await ctx.db.get(activityId);
  if (activity?.organisationId) {
    const org = await ctx.db.get(activity.organisationId);
    if (org) return org;
  }
  const allOrganisations = await ctx.db.query("organisations").collect();
  return allOrganisations.find((org) => org.activityIDs.includes(activityId)) ?? null;
}

// shortcut: scans organisations (one row per organiser), add a join table if that grows past a few thousand.
async function organiserActivityIds(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<Id<"activities">[]> {
  const allOrganisations = await ctx.db.query("organisations").collect();
  const ids = new Set<Id<"activities">>();
  for (const org of allOrganisations) {
    if (org.organisersIDs.includes(userId)) {
      for (const activityId of org.activityIDs) ids.add(activityId);
    }
  }
  return [...ids];
}

async function reservationsForActivities(
  ctx: QueryCtx,
  activityIds: Id<"activities">[]
): Promise<Doc<"reservations">[]> {
  const perActivity = await Promise.all(
    activityIds.map((activityId) =>
      ctx.db
        .query("reservations")
        .withIndex("byActivity", (q) => q.eq("activityId", activityId))
        .collect()
    )
  );
  return perActivity.flat();
}

async function activeReservationsOnDate(
  ctx: QueryCtx,
  activityId: Id<"activities">,
  date: string
): Promise<Doc<"reservations">[]> {
  const rows = await ctx.db
    .query("reservations")
    .withIndex("byDateTime", (q) => q.eq("activityId", activityId).eq("date", date))
    .collect();
  return rows.filter((r) => !r.cancelledAt);
}

// Shared by direct booking, queue auto-assign and queue accept.
async function insertReservation(
  ctx: MutationCtx,
  p: {
    activityId: Id<"activities">;
    date: string;
    time: string;
    teamIds: Id<"teams">[];
    userCount: bigint;
    createdBy: Id<"users">;
    organiserId: Id<"users">;
  }
): Promise<Id<"reservations">> {
  // Pair is stored sorted so one byUser1 lookup finds it.
  const [user1Id, user2Id] = [p.organiserId, p.createdBy].sort((a, b) =>
    a.localeCompare(b)
  );
  const pairConversations = await ctx.db
    .query("conversations")
    .withIndex("byUser1", (q) => q.eq("user1Id", user1Id))
    .collect();
  const existingConversation = pairConversations.find((c) => c.user2Id === user2Id);
  const conversationId =
    existingConversation?._id ??
    (await ctx.db.insert("conversations", { user1Id, user2Id, createdAt: Date.now() }));

  // Pay 7 days before the activity, or by the start if it is sooner.
  const startMs = reservationStartMs(p.date, p.time);
  const sevenDaysBefore = startMs - SEVEN_DAYS_MS;
  const paymentDeadline = sevenDaysBefore > Date.now() ? sevenDaysBefore : startMs;

  const reservationId = await ctx.db.insert("reservations", {
    activityId: p.activityId,
    date: p.date,
    time: p.time,
    teamIds: p.teamIds,
    userCount: p.userCount,
    createdBy: p.createdBy,
    readByOrganiser: false,
    reservationChatId: conversationId,
    paymentStatus: "pending",
    paymentDeadline,
  });

  if (!existingConversation?.reservationId) {
    await ctx.db.patch(conversationId, { reservationId });
  }

  for (const teamId of p.teamIds) {
    await ctx.db.insert("groupMessages", {
      teamId,
      senderId: p.createdBy,
      text: "Reservation card",
      messageType: "reservation_card",
      reservationCardData: { reservationId },
    });
  }

  await ctx.runMutation(internal.gamification.tryCompleteSystemQuest, {
    userId: p.createdBy,
    systemKey: "activity_reserved",
  });

  return reservationId;
}

async function nextQueueEntry(
  ctx: QueryCtx,
  activityId: Id<"activities">,
  date: string
): Promise<Doc<"reservationQueue"> | undefined> {
  const entries = await ctx.db
    .query("reservationQueue")
    .withIndex("byActivityDate", (q) => q.eq("activityId", activityId).eq("date", date))
    .collect();
  return entries
    .filter((q) => !q.notifiedAt)
    .sort((a, b) => a.createdAt - b.createdAt)[0];
}

// Cancels, releases payments and hands the slot to the queue. Shared by user and cron cancels.
async function cancelAndRelease(
  ctx: MutationCtx,
  reservation: Doc<"reservations">,
  cancellationReason: string
): Promise<
  | { autoAssigned: true; reservationId: Id<"reservations"> }
  | { queueNotified: true; queueEntryId: Id<"reservationQueue"> }
  | null
> {
  await ctx.db.patch(reservation._id, {
    cancelledAt: Date.now(),
    cancellationReason,
    paymentStatus: "cancelled",
  });

  const payments = await ctx.db
    .query("reservationPayments")
    .withIndex("byReservation", (q) => q.eq("reservationId", reservation._id))
    .collect();
  const scheduledRefundPis = new Set<string>();
  for (const payment of payments) {
    if (payment.refundedAt) continue;
    const pi = payment.stripePaymentIntentId;
    if (pi) {
      // refundPayment sets refundedAt only after Stripe confirms.
      if (!scheduledRefundPis.has(pi)) {
        scheduledRefundPis.add(pi);
        await ctx.scheduler.runAfter(0, internal.stripe.refundPayment, {
          paymentIntentId: pi,
          reservationId: reservation._id,
        });
      }
    } else {
      // Card only saved, never charged: nothing to return.
      await ctx.db.patch(payment._id, { refundedAt: Date.now() });
    }
  }

  await sendReservationCardUpdate(ctx, reservation._id);

  if (reservation.date < todayInAppZone()) return null;
  const firstInQueue = await nextQueueEntry(ctx, reservation.activityId, reservation.date);
  if (!firstInQueue) return null;

  const result = await assignFirstInQueueToFreedSlot(ctx, {
    activityId: reservation.activityId,
    date: reservation.date,
    time: reservation.time,
    queueEntry: firstInQueue,
  });
  if (result.assigned) {
    return { autoAssigned: true, reservationId: result.reservationId };
  }
  // Could not auto-book (slot gone, team changed): let them pick a time.
  await ctx.db.patch(firstInQueue._id, { notifiedAt: Date.now() });
  return { queueNotified: true, queueEntryId: firstInQueue._id };
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

    const teamsAsCreator = (
      await ctx.db
        .query("teams")
        .withIndex("byCreatedBy", (q) => q.eq("createdBy", currentUser._id))
        .collect()
    ).filter((team) => team.teammates.includes(currentUser._id));

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
    const reservationsForDate = await activeReservationsOnDate(ctx, activityId, date);

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
  // Validation failures are returned; unexpected errors throw so Convex rolls back.
  handler: async (ctx, { activityId, date, time, teamIds, userCount }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    const activity = await ctx.db.get(activityId);
    if (!activity) {
      return { success: false, error: "Activity not found" };
    }

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

    if (userCount <= 0) {
      return {
        success: false,
        error: "User count must be greater than 0",
      };
    }

    if (
      activity.maxParticipants &&
      userCount > Number(activity.maxParticipants)
    ) {
      return {
        success: false,
        error: `Team has ${userCount} members, but this activity only allows ${activity.maxParticipants} participants.`,
      };
    }

    if (teamIds.length === 0) {
      return {
        success: false,
        error: "At least one team must be selected",
      };
    }

    const teams: Doc<"teams">[] = [];
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
      teams.push(team);
    }

    if (reservationStartMs(date, time) <= Date.now()) {
      return {
        success: false,
        error: "Reservation date and time must be in the future",
      };
    }

    // Each team can only have one reservation per day per activity
    const activeReservationsForDate = await activeReservationsOnDate(ctx, activityId, date);
    for (const team of teams) {
      if (activeReservationsForDate.some((r) => r.teamIds.includes(team._id))) {
        return {
          success: false,
          error: `Team ${team.teamName} already has a reservation for this activity on ${date}. Each team can only have one reservation per day per activity.`,
        };
      }
    }

    if (await areBookingsFulfilledForDate(ctx, activityId, date)) {
      return {
        success: false,
        error:
          "This date is fully booked. Please join the queue to be notified when a slot becomes available.",
      };
    }

    if (activeReservationsForDate.some((r) => r.time === time)) {
      return {
        success: false,
        error:
          "This date and time slot is already reserved. Please choose a different time.",
      };
    }

    const organisation = await organisationForActivity(ctx, activityId);
    if (!organisation || organisation.organisersIDs.length === 0) {
      return { success: false, error: "Activity organiser not found" };
    }
    if (organisation.organisersIDs.includes(currentUser._id)) {
      return {
        success: false,
        error: "You cannot make reservations for your own activities.",
      };
    }
    const organiserId = organisation.organisersIDs[0];
    if (!(await ctx.db.get(organiserId))) {
      return { success: false, error: "Organiser user not found" };
    }

    const reservationId = await insertReservation(ctx, {
      activityId,
      date,
      time,
      teamIds,
      userCount,
      createdBy: currentUser._id,
      organiserId,
    });
    return { success: true, reservationId };
  },
});

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
  if (!availableTimeSlots.includes(time)) return { assigned: false };
  if (reservationStartMs(date, time) <= Date.now()) return { assigned: false };

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

  const organisation = await organisationForActivity(ctx, activityId);
  const organiserId = organisation?.organisersIDs[0];
  if (!organiserId || !(await ctx.db.get(organiserId))) {
    return { assigned: false };
  }

  const reservationId = await insertReservation(ctx, {
    activityId,
    date,
    time,
    teamIds: queueEntry.teamIds,
    userCount: queueEntry.userCount,
    createdBy: queueEntry.createdBy,
    organiserId,
  });
  await ctx.db.delete(queueEntry._id);
  return { assigned: true, reservationId };
}

// Helper function to check if bookings are fulfilled for a date
async function areBookingsFulfilledForDate(
  ctx: QueryCtx,
  activityId: Id<"activities">,
  date: string
): Promise<boolean> {
  const activity = await ctx.db.get(activityId);
  const availableTimeSlots = activity?.availableTimeSlots ?? [];
  if (availableTimeSlots.length === 0) {
    return false;
  }
  const reserved = await activeReservationsOnDate(ctx, activityId, date);
  const reservedTimes = new Set(reserved.map((r) => r.time));
  return availableTimeSlots.every((slot) => reservedTimes.has(slot));
}

export const cancelReservation = mutation({
  args: {
    reservationId: v.id("reservations"),
    cancellationReason: v.string(),
  },
  handler: async (ctx, { reservationId, cancellationReason }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    if (!cancellationReason || cancellationReason.trim() === "") {
      throw new Error("Cancellation reason is required");
    }

    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }
    if (reservation.cancelledAt) {
      throw new Error("Reservation is already cancelled");
    }

    // Allow organiser or team creator (createdBy) to cancel
    const organisation = await organisationForActivity(ctx, reservation.activityId);
    const isOrganiser =
      organisation?.organisersIDs.includes(currentUser._id) ?? false;
    const isTeamCreator = reservation.createdBy === currentUser._id;
    if (!isOrganiser && !isTeamCreator) {
      throw new Error(
        "Only the activity organiser or the team creator can cancel reservations"
      );
    }

    const result = await cancelAndRelease(ctx, reservation, cancellationReason.trim());
    if (result && "autoAssigned" in result) {
      return {
        success: true,
        queueNotified: false,
        autoAssigned: true,
        reservationId: result.reservationId,
      };
    }
    if (result) {
      return { success: true, queueNotified: true, queueEntryId: result.queueEntryId };
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

    const organiserReservations = await reservationsForActivities(
      ctx,
      await organiserActivityIds(ctx, currentUser._id)
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

export const getUnreadReservationCount = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser.role !== "organiser") {
      return 0;
    }
    const reservations = await reservationsForActivities(
      ctx,
      await organiserActivityIds(ctx, currentUser._id)
    );
    return reservations.filter((r) => r.readByOrganiser !== true && !r.cancelledAt)
      .length;
  },
});

export const markReservationsAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    if (currentUser.role !== "organiser") {
      return { success: true, count: 0 };
    }
    const reservations = await reservationsForActivities(
      ctx,
      await organiserActivityIds(ctx, currentUser._id)
    );
    const unread = reservations.filter((r) => r.readByOrganiser !== true && !r.cancelledAt);
    for (const reservation of unread) {
      await ctx.db.patch(reservation._id, { readByOrganiser: true });
    }
    return { success: true, count: unread.length };
  },
});

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
    if (date < todayInAppZone()) {
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
    const organisation = await organisationForActivity(ctx, activityId);
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
    const isFulfilled = await areBookingsFulfilledForDate(ctx, activityId, date);

    if (!isFulfilled) {
      throw new Error(
        "Queue is only available when all time slots for this date are reserved."
      );
    }

    // Check if any team already has a reservation for this activity on this date
    const activeReservationsForDate = await activeReservationsOnDate(ctx, activityId, date);

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

    if (reservationStartMs(queueEntry.date, time) <= Date.now()) {
      throw new Error("Reservation date and time must be in the future");
    }

    const taken = await activeReservationsOnDate(ctx, queueEntry.activityId, queueEntry.date);
    if (taken.some((r) => r.time === time)) {
      throw new Error(
        "This time slot is no longer available. Please choose a different time."
      );
    }

    const organisation = await organisationForActivity(ctx, queueEntry.activityId);
    if (!organisation || organisation.organisersIDs.length === 0) {
      throw new Error("Activity organiser not found");
    }
    const organiserId = organisation.organisersIDs[0];
    if (!(await ctx.db.get(organiserId))) {
      throw new Error("Organiser user not found");
    }

    const reservationId = await insertReservation(ctx, {
      activityId: queueEntry.activityId,
      date: queueEntry.date,
      time,
      teamIds: queueEntry.teamIds,
      userCount: queueEntry.userCount,
      createdBy: currentUser._id,
      organiserId,
    });

    await ctx.db.delete(queueEntryId);

    const nextInQueue = await nextQueueEntry(ctx, queueEntry.activityId, queueEntry.date);
    if (nextInQueue) {
      await ctx.db.patch(nextInQueue._id, { notifiedAt: Date.now() });
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

    const nextInQueue = await nextQueueEntry(ctx, queueEntry.activityId, queueEntry.date);

    if (nextInQueue) {
      await ctx.db.patch(nextInQueue._id, {
        notifiedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const getMyQueueNotifications = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return [];
    }

    const myNotifications = (
      await ctx.db
        .query("reservationQueue")
        .withIndex("byCreatedBy", (q) => q.eq("createdBy", currentUser._id))
        .collect()
    ).filter((q) => q.notifiedAt);

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

// Called by stripe.recordCardPayment after it has checked the SetupIntent with Stripe.
// The amount is worked out here, never taken from the client.
export const recordPaymentInternal = internalMutation({
  args: {
    reservationId: v.id("reservations"),
    userId: v.id("users"),
    personsPaidFor: v.int64(),
    stripeSetupIntentId: v.string(),
    stripePaymentMethodId: v.string(),
  },
  handler: async (
    ctx,
    { reservationId, userId, personsPaidFor, stripeSetupIntentId, stripePaymentMethodId }
  ) => {
    const reservation = await ctx.db.get(reservationId);
    if (!reservation || reservation.cancelledAt) {
      throw new Error("Reservation not found");
    }
    if (reservation.paymentStatus !== "pending") {
      throw new Error("This reservation is already paid");
    }

    const teams = await Promise.all(reservation.teamIds.map((id) => ctx.db.get(id)));
    const participantIds = new Set<Id<"users">>();
    for (const team of teams) {
      for (const id of team?.teammates ?? []) participantIds.add(id);
    }
    if (!participantIds.has(userId) && reservation.createdBy !== userId) {
      throw new Error("User is not a member of the reservation teams");
    }

    const activity = await ctx.db.get(reservation.activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();
    if (payments.some((p) => p.stripeSetupIntentId === stripeSetupIntentId)) {
      throw new Error("This card authorisation was already recorded");
    }
    const activePayments = payments.filter((p) => !p.refundedAt);

    const totalAmount = effectiveReservationTotalPrice(
      activity.price,
      reservation.loyaltyDiscountTotal
    );
    const totalParticipants = Math.max(1, participantIds.size);
    const collected = activePayments.reduce((sum, p) => sum + p.amount, 0);
    const personsCovered = activePayments.reduce((sum, p) => sum + Number(p.personsPaidFor), 0);
    const remainingPersons = totalParticipants - personsCovered;
    const persons = Number(personsPaidFor);
    if (!Number.isInteger(persons) || persons < 1 || persons > remainingPersons) {
      throw new Error(`You can pay for 1 to ${Math.max(0, remainingPersons)} people`);
    }

    const roundCents = (value: number) => Math.round(value * 100) / 100;
    // The last payer covers rounding leftovers so the total is reached exactly.
    const amount =
      persons === remainingPersons
        ? roundCents(Math.max(0, totalAmount - collected))
        : roundCents((totalAmount / totalParticipants) * persons);

    await ctx.db.insert("reservationPayments", {
      reservationId,
      userId,
      amount,
      personsPaidFor,
      paidAt: Date.now(),
      stripeSetupIntentId,
      stripePaymentMethodId,
      captureScheduledFor: reservationStartMs(reservation.date, reservation.time),
    });

    await checkAndUpdatePaymentStatus(ctx, reservationId);

    return { amount };
  },
});

// Internal query: reservation payments + payer profile (for Stripe actions)
export const getReservationPaymentsInternal = internalQuery({
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

/** Set Stripe PaymentIntent on a single payer row (per-payer authorisations). */
export const patchReservationPaymentIntentId = internalMutation({
  args: {
    paymentId: v.id("reservationPayments"),
    paymentIntentId: v.string(),
  },
  handler: async (ctx, { paymentId, paymentIntentId }) => {
    const row = await ctx.db.get(paymentId);
    if (!row || row.refundedAt) {
      return { success: false as const };
    }
    if (row.stripePaymentIntentId) {
      return { success: true as const, skipped: true as const };
    }
    await ctx.db.patch(paymentId, { stripePaymentIntentId: paymentIntentId });
    return { success: true as const };
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

  const totalAmount = effectiveReservationTotalPrice(
    activity.price,
    reservation.loyaltyDiscountTotal
  );

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

// Daily cron: cancel reservations still unpaid on the activity day.
export const checkAndCancelUnpaidReservations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = todayInAppZone();
    const reservationsToCancel = (
      await ctx.db
        .query("reservations")
        .withIndex("byDate", (q) => q.eq("date", today))
        .collect()
    ).filter((r) => r.paymentStatus === "pending" && !r.cancelledAt);

    for (const reservation of reservationsToCancel) {
      await cancelAndRelease(ctx, reservation, "Payment not completed by activity date");

      // Tell the customer in the organiser chat.
      const conversation = reservation.reservationChatId
        ? await ctx.db.get(reservation.reservationChatId)
        : null;
      if (conversation) {
        const organiserId =
          conversation.user1Id === reservation.createdBy
            ? conversation.user2Id
            : conversation.user1Id;
        await ctx.db.insert("messages", {
          senderId: organiserId,
          receiverId: reservation.createdBy,
          text: "Your reservation has been automatically cancelled because payment was not completed by the activity date. Any payments made have been refunded.",
        });
      }
    }

    return { success: true, cancelled: reservationsToCancel.length };
  },
});

// Hourly cron: on the activity day, charge the saved cards. Fulfilment happens once Stripe confirms.
export const checkAndFulfillReservations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = todayInAppZone();
    const reservationsToCharge = (
      await ctx.db
        .query("reservations")
        .withIndex("byDate", (q) => q.eq("date", today))
        .collect()
    ).filter((r) => r.paymentStatus === "on_hold" && !r.cancelledAt);

    for (const reservation of reservationsToCharge) {
      await ctx.scheduler.runAfter(0, internal.stripe.chargeReservation, {
        reservationId: reservation._id,
      });
    }

    return { success: true, scheduled: reservationsToCharge.length };
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
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    for (const p of payments) {
      if (p.stripePaymentIntentId === paymentIntentId) {
        await ctx.db.patch(p._id, { refundedAt });
      }
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
    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    let updated = false;
    for (const p of payments) {
      if (p.stripePaymentIntentId === paymentIntentId && !p.capturedAt) {
        await ctx.db.patch(p._id, { capturedAt });
        updated = true;
      }
    }

    if (updated) {
      await checkAndUpdateFulfilledStatusHelper(ctx, reservationId);
    }
  },
});

// Fulfilled only when every paying row has really been captured by Stripe.
async function checkAndUpdateFulfilledStatusHelper(
  ctx: MutationCtx,
  reservationId: Id<"reservations">
): Promise<void> {
  const reservation = await ctx.db.get(reservationId);
  if (!reservation || reservation.paymentStatus !== "on_hold") return;

  const payments = await ctx.db
    .query("reservationPayments")
    .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
    .collect();
  const payingRows = payments.filter((p) => !p.refundedAt && p.amount > 0);
  if (payingRows.length === 0 || !payingRows.every((p) => p.capturedAt)) return;

  await ctx.db.patch(reservationId, { paymentStatus: "fulfilled" });
  await sendReservationCardUpdate(ctx, reservationId);
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

/** Used by internal Stripe actions (no signed-in user context). */
export const getReservationActivityIdInternal = internalQuery({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, { reservationId }) => {
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      return null;
    }
    return { activityId: reservation.activityId };
  },
});

export const getReservationCardData = query({
  args: {
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { reservationId }) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return null;
    }

    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      return null;
    }

    const activity = await ctx.db.get(reservation.activityId);
    if (!activity) {
      return null;
    }

    const teams = await Promise.all(
      reservation.teamIds.map((teamId) => ctx.db.get(teamId))
    );
    const validTeams = teams.filter(
      (t): t is NonNullable<typeof t> => t !== null
    );

    const participantIds = new Set<Id<"users">>();
    for (const team of validTeams) {
      for (const teammateId of team.teammates) {
        participantIds.add(teammateId);
      }
    }

    const organisation = await organisationForActivity(ctx, reservation.activityId);
    const isOrganiser =
      currentUser.role === "organiser" &&
      !!organisation?.organisersIDs.includes(currentUser._id);

    const isTeamCreator = reservation.createdBy === currentUser._id;
    const isParticipant = participantIds.has(currentUser._id);
    if (!isTeamCreator && !isParticipant && !isOrganiser) {
      return null;
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
    const totalAmount = effectiveReservationTotalPrice(
      activity.price,
      reservation.loyaltyDiscountTotal
    );
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
      listPrice: activity.price,
      loyaltyDiscountTotal: reservation.loyaltyDiscountTotal ?? 0,
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

    const hasPaid = activePayments.some((p) => p.userId === currentUser._id);

    return {
      isTeamCreator,
      canLeaveReview,
      hasPaid,
      reservation: {
        _id: reservation._id,
        date: reservation.date,
        time: reservation.time,
        userCount: reservation.userCount,
        paymentStatus: reservation.paymentStatus,
        paymentDeadline: reservation.paymentDeadline,
        cancelledAt: reservation.cancelledAt,
        cancellationReason: reservation.cancellationReason,
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

// Rows for the organiser payments table (stripe.getStripePaymentIntentsForOrganiser).
export const getOrganiserPaymentRows = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const reservations = await reservationsForActivities(
      ctx,
      await organiserActivityIds(ctx, userId)
    );

    const rows = [];
    for (const reservation of reservations) {
      const payments = (
        await ctx.db
          .query("reservationPayments")
          .withIndex("byReservation", (q) => q.eq("reservationId", reservation._id))
          .collect()
      ).filter((p) => p.amount > 0 && (p.stripePaymentIntentId || p.stripePaymentMethodId));
      if (payments.length === 0) continue;

      const activity = await ctx.db.get(reservation.activityId);
      const teams = (await Promise.all(reservation.teamIds.map((id) => ctx.db.get(id)))).filter(
        (t): t is Doc<"teams"> => t !== null
      );
      const active = payments.filter((p) => !p.refundedAt);
      const collected = active.reduce((sum, p) => sum + p.amount, 0);
      const total = activity
        ? effectiveReservationTotalPrice(activity.price, reservation.loyaltyDiscountTotal)
        : 0;
      const remainingAmount =
        reservation.paymentStatus === "fulfilled" ? 0 : Math.max(0, total - collected);

      for (const p of payments) {
        const team = teams.find((t) => t.teammates.includes(p.userId)) ?? teams[0] ?? null;
        const teamMembers = new Set(team?.teammates ?? []);
        const payer = await ctx.db.get(p.userId);
        const status = p.refundedAt
          ? ("refunded" as const)
          : p.capturedAt
            ? ("paid" as const)
            : ("on_hold" as const);
        rows.push({
          paymentIntentId: p.stripePaymentIntentId ?? p._id,
          reservationId: reservation._id,
          teamId: team?._id ?? null,
          teamName: team?.teamName ?? "Unknown Team",
          payerName: payer ? `${payer.name} ${payer.lastname}`.trim() : "Teammate",
          personsPaidFor: Number(p.personsPaidFor),
          activityName: activity?.activityName ?? "Unknown Activity",
          activityAddress: activity?.address ?? "",
          date: reservation.date,
          time: reservation.time,
          status,
          stripeStatus: status,
          amount: p.amount,
          collectedAmount: active
            .filter((x) => teamMembers.has(x.userId))
            .reduce((sum, x) => sum + x.amount, 0),
          remainingAmount,
          currency: "EUR",
          createdAt: p.paidAt,
          capturedAt: p.capturedAt,
          refundedAt: p.refundedAt,
        });
      }
    }

    return rows.sort(
      (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)
    );
  },
});
