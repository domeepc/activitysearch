import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Id } from "./_generated/dataModel";

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

    // Create the reservation
    const reservationId = await ctx.db.insert("reservations", {
      activityId,
      date,
      time,
      teamIds,
      userCount,
      createdBy: currentUser._id,
    });

    return { success: true, reservationId };
  },
});
