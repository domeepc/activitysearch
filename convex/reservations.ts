import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Id } from "./_generated/dataModel";

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

    // Fetch team details for each reservation
    const reservationsWithTeams = await Promise.all(
      reservations.map(async (reservation) => {
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

    // Get all reservations for this activity and date
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("byActivity", (q) => q.eq("activityId", activityId))
      .collect();

    // Filter reservations for the specific date
    const reservationsForDate = reservations.filter(
      (r) => r.date === date
    );

    // Count unique reserved time slots
    const reservedSlots = reservationsForDate.length;
    const percentage =
      totalSlots > 0 ? (reservedSlots / totalSlots) * 100 : 0;

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

    // Mark reservation as cancelled
    await ctx.db.patch(reservationId, {
      cancelledAt: Date.now(),
      cancellationReason: cancellationReason.trim(),
    });

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

    // Get activity to validate time slot
    const activity = await ctx.db.get(activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    // Validate time is in availableTimeSlots
    const availableTimeSlots = activity.availableTimeSlots ?? [];
    if (availableTimeSlots.length === 0) {
      throw new Error("This activity has no available time slots defined");
    }
    if (!availableTimeSlots.includes(time)) {
      throw new Error(
        `Time ${time} is not available. Available times: ${availableTimeSlots.join(", ")}`
      );
    }

    // Validate userCount is positive
    if (userCount <= 0) {
      throw new Error("User count must be greater than 0");
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
          `You are not the creator of team ${team.teamName}. Only team creators can make reservations.`
        );
      }
    }

    // Validate date/time is not in the past
    const reservationDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    if (reservationDateTime <= now) {
      throw new Error("Reservation date and time must be in the future");
    }

    // Check for conflicts with existing reservations
    const existingReservations = await ctx.db
      .query("reservations")
      .withIndex("byDateTime", (q) =>
        q.eq("activityId", activityId).eq("date", date).eq("time", time)
      )
      .collect();

    if (existingReservations.length > 0) {
      throw new Error(
        "This date and time slot is already reserved. Please choose a different time."
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

    let existingConversation = allConversations.find(
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
      activityId,
      date,
      time,
      teamIds,
      userCount,
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
