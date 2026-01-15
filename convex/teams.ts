import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";

// Helper function to generate secure random hash for team slug
function generateSecureHash(): string {
  // Generate a cryptographically secure random string
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}-${randomPart2}`.replace(/[^a-z0-9-]/g, '');
}

export const createTeam = mutation({
  args: {
    teamName: v.string(),
    teamDescription: v.optional(v.string()),
    friendIds: v.array(v.id("users")),
  },
  handler: async (ctx, { teamName, teamDescription, friendIds }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Verify all friendIds are actually friends
    for (const friendId of friendIds) {
      if (!currentUser.friends.includes(friendId)) {
        throw new Error(`User ${friendId} is not your friend`);
      }
    }

    // Generate secure random hash slug
    let slug = generateSecureHash();
    
    // Ensure slug is unique (very unlikely but check anyway)
    while (
      await ctx.db
        .query("teams")
        .withIndex("bySlug", (q) => q.eq("slug", slug))
        .first()
    ) {
      slug = generateSecureHash();
    }

    // Create team with current user and friends
    // Only creator has admin privileges (admins field kept for backwards compatibility)
    const teamId = await ctx.db.insert("teams", {
      teamName,
      teamDescription: teamDescription || "",
      teammates: [currentUser._id, ...friendIds],
      admins: [currentUser._id], // Only creator is admin
      createdBy: currentUser._id,
      slug,
      icon: undefined,
    });

    return teamId;
  },
});

export const getMyTeams = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get all teams where current user is a teammate
    const allTeams = await ctx.db.query("teams").collect();
    const myTeams = allTeams.filter((team) =>
      team.teammates.includes(currentUser._id)
    );

    // Get last message for each team
    const teamsWithLastMessage = await Promise.all(
      myTeams.map(async (team) => {
        const lastMessage = await ctx.db
          .query("groupMessages")
          .withIndex("byTeam", (q) => q.eq("teamId", team._id))
          .order("desc")
          .first();

        // Get teammate details
        const teammates = await Promise.all(
          team.teammates.map((id) => ctx.db.get(id))
        );

        // Determine read status for last message
        let lastMessageReadStatus: "sent" | "delivered" | "read" | null = null;
        if (lastMessage) {
          // Only show status if message was sent by current user
          if (lastMessage.senderId === currentUser._id) {
            const readBy = lastMessage.readBy || [];
            // Get teammates excluding the sender
            const otherTeammates = team.teammates.filter(
              (id) => id !== currentUser._id
            );

            if (otherTeammates.length === 0) {
              // No other teammates, consider it read
              lastMessageReadStatus = "read";
            } else {
              const readCount = otherTeammates.filter((id) =>
                readBy.includes(id)
              ).length;

              if (readCount === otherTeammates.length) {
                // All teammates have read it
                lastMessageReadStatus = "read";
              } else if (readCount > 0) {
                // Some teammates have read it
                lastMessageReadStatus = "delivered";
              } else {
                // No teammates have read it yet
                lastMessageReadStatus = "sent";
              }
            }
          }
        }

        // Use existing slug (should always exist for new teams, but handle legacy)
        const teamSlug = team.slug || generateSecureHash();

        return {
          _id: team._id,
          teamName: team.teamName,
          teamDescription: team.teamDescription,
          slug: teamSlug,
          icon: team.icon,
          admins: team.admins || [],
          teammates: teammates.filter(
            (t): t is NonNullable<typeof t> => t !== null
          ),
          createdBy: team.createdBy,
          lastMessage: lastMessage
            ? {
                text: lastMessage.text,
                timestamp: lastMessage.timestamp,
                senderId: lastMessage.senderId,
              }
            : null,
          lastMessageReadStatus,
        };
      })
    );

    // Sort by last message time (most recent first)
    return teamsWithLastMessage.sort((a, b) => {
      const aTime = a.lastMessage?.timestamp || 0;
      const bTime = b.lastMessage?.timestamp || 0;
      return bTime - aTime;
    });
  },
});

export const getTeamMessages = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Verify user is part of the team
    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.teammates.includes(currentUser._id)) {
      throw new Error("You are not a member of this team");
    }

    // Get all messages for this team
    const messages = await ctx.db
      .query("groupMessages")
      .withIndex("byTeam", (q) => q.eq("teamId", teamId))
      .order("asc")
      .collect();

    // Get sender details for each message
    const messagesWithSenders = await Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);

        // Determine status for messages sent by current user
        let status: "sent" | "delivered" | "read" | null = null;
        if (msg.senderId === currentUser._id) {
          const readBy = msg.readBy || [];
          // Get teammates excluding the sender
          const otherTeammates = team.teammates.filter(
            (id) => id !== currentUser._id
          );

          if (otherTeammates.length === 0) {
            // No other teammates, consider it read
            status = "read";
          } else {
            const readCount = otherTeammates.filter((id) =>
              readBy.includes(id)
            ).length;

            if (readCount === otherTeammates.length) {
              // All teammates have read it
              status = "read";
            } else if (readCount > 0) {
              // Some teammates have read it
              status = "delivered";
            } else {
              // No teammates have read it yet
              status = "sent";
            }
          }
        }

        return {
          _id: msg._id,
          text: msg.text,
          senderId: msg.senderId,
          timestamp: msg.timestamp,
          sender: sender
            ? {
                _id: sender._id,
                name: sender.name,
                lastname: sender.lastname,
                username: sender.username,
                avatar: sender.avatar,
              }
            : null,
          isFromCurrentUser: msg.senderId === currentUser._id,
          readBy: msg.readBy || [],
          status,
        };
      })
    );

    return {
      team: {
        _id: team._id,
        teamName: team.teamName,
        teamDescription: team.teamDescription,
        teammates: team.teammates,
        createdBy: team.createdBy,
      },
      messages: messagesWithSenders,
    };
  },
});

export const sendTeamMessage = mutation({
  args: {
    teamId: v.id("teams"),
    text: v.string(),
  },
  handler: async (ctx, { teamId, text }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Verify user is part of the team
    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.teammates.includes(currentUser._id)) {
      throw new Error("You are not a member of this team");
    }

    const timestamp = Date.now();

    await ctx.db.insert("groupMessages", {
      teamId,
      senderId: currentUser._id,
      text,
      timestamp,
    });

    return { success: true };
  },
});

export const inviteFriendToTeam = mutation({
  args: {
    teamId: v.id("teams"),
    friendId: v.id("users"),
  },
  handler: async (ctx, { teamId, friendId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Verify user is part of the team
    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.teammates.includes(currentUser._id)) {
      throw new Error("You are not a member of this team");
    }

    // Verify friendId is actually a friend
    if (!currentUser.friends.includes(friendId)) {
      throw new Error("User is not your friend");
    }

    // Check if friend is already in the team
    if (team.teammates.includes(friendId)) {
      throw new Error("User is already in this team");
    }

    // Add friend to team
    await ctx.db.patch(teamId, {
      teammates: [...team.teammates, friendId],
    });

    return { success: true };
  },
});

export const removeFromTeam = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  handler: async (ctx, { teamId, userId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Verify user is part of the team
    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Only creator can remove members, or user can remove themselves
    if (team.createdBy !== currentUser._id && currentUser._id !== userId) {
      throw new Error("Only the team creator can remove members");
    }

    // Cannot remove the creator
    if (team.createdBy === userId) {
      throw new Error("Cannot remove the team creator");
    }

    // Remove user from team
    await ctx.db.patch(teamId, {
      teammates: team.teammates.filter((id) => id !== userId),
    });

    return { success: true };
  },
});

export const markTeamMessageAsRead = mutation({
  args: {
    messageId: v.id("groupMessages"),
  },
  handler: async (ctx, { messageId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const message = await ctx.db.get(messageId);

    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user is part of the team
    const team = await ctx.db.get(message.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.teammates.includes(currentUser._id)) {
      throw new Error("You are not a member of this team");
    }

    // Don't mark your own messages as read
    if (message.senderId === currentUser._id) {
      return { success: true };
    }

    // Add current user to readBy array if not already there
    const readBy = message.readBy || [];
    if (!readBy.includes(currentUser._id)) {
      await ctx.db.patch(messageId, {
        readBy: [...readBy, currentUser._id],
      });
    }

    return { success: true };
  },
});

export const getTeamBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, { slug }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    const team = await ctx.db
      .query("teams")
      .withIndex("bySlug", (q) => q.eq("slug", slug))
      .first();

    if (!team) {
      return null;
    }

    // Verify user is part of the team
    if (!team.teammates.includes(currentUser._id)) {
      throw new Error("You are not a member of this team");
    }

    // Get teammate details
    const teammates = await Promise.all(
      team.teammates.map((id) => ctx.db.get(id))
    );

    return {
      _id: team._id,
      teamName: team.teamName,
      teamDescription: team.teamDescription,
      slug: team.slug,
      icon: team.icon,
      admins: team.admins || [],
      teammates: teammates.filter(
        (t): t is NonNullable<typeof t> => t !== null
      ),
      createdBy: team.createdBy,
    };
  },
});

export const getTeamMessagesBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, { slug }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get team by slug
    const team = await ctx.db
      .query("teams")
      .withIndex("bySlug", (q) => q.eq("slug", slug))
      .first();

    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.teammates.includes(currentUser._id)) {
      throw new Error("You are not a member of this team");
    }

    // Get all messages for this team
    const messages = await ctx.db
      .query("groupMessages")
      .withIndex("byTeam", (q) => q.eq("teamId", team._id))
      .order("asc")
      .collect();

    // Get sender details for each message
    const messagesWithSenders = await Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);

        // Determine status for messages sent by current user
        let status: "sent" | "delivered" | "read" | null = null;
        if (msg.senderId === currentUser._id) {
          const readBy = msg.readBy || [];
          // Get teammates excluding the sender
          const otherTeammates = team.teammates.filter(
            (id) => id !== currentUser._id
          );

          if (otherTeammates.length === 0) {
            // No other teammates, consider it read
            status = "read";
          } else {
            const readCount = otherTeammates.filter((id) =>
              readBy.includes(id)
            ).length;

            if (readCount === otherTeammates.length) {
              // All teammates have read it
              status = "read";
            } else if (readCount > 0) {
              // Some teammates have read it
              status = "delivered";
            } else {
              // No teammates have read it yet
              status = "sent";
            }
          }
        }

        return {
          _id: msg._id,
          text: msg.text,
          senderId: msg.senderId,
          timestamp: msg.timestamp,
          sender: sender
            ? {
                _id: sender._id,
                name: sender.name,
                lastname: sender.lastname,
                username: sender.username,
                avatar: sender.avatar,
              }
            : null,
          isFromCurrentUser: msg.senderId === currentUser._id,
          readBy: msg.readBy || [],
          status,
        };
      })
    );

    return {
      team: {
        _id: team._id,
        teamName: team.teamName,
        teamDescription: team.teamDescription,
        slug: team.slug,
        icon: team.icon,
        admins: team.admins || [],
        teammates: team.teammates,
        createdBy: team.createdBy,
      },
      messages: messagesWithSenders,
    };
  },
});

export const markTeamConversationAsRead = mutation({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Verify user is part of the team
    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.teammates.includes(currentUser._id)) {
      throw new Error("You are not a member of this team");
    }

    // Get all unread messages from team (excluding messages sent by current user)
    const unreadMessages = await ctx.db
      .query("groupMessages")
      .withIndex("byTeam", (q) => q.eq("teamId", teamId))
      .collect();

    // Mark all as read (excluding own messages)
    for (const msg of unreadMessages) {
      if (msg.senderId !== currentUser._id) {
        const readBy = msg.readBy || [];
        if (!readBy.includes(currentUser._id)) {
          await ctx.db.patch(msg._id, {
            readBy: [...readBy, currentUser._id],
          });
        }
      }
    }

    return { success: true };
  },
});

// Note: Admin functionality removed - only creator has admin privileges
// The admins field is kept for backwards compatibility but only creator is admin

export const leaveTeam = mutation({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    if (!team.teammates.includes(currentUser._id)) {
      throw new Error("You are not a member of this team");
    }

    // Cannot leave if you're the creator
    if (team.createdBy === currentUser._id) {
      throw new Error("Team creator cannot leave. Delete the team instead.");
    }

    // Remove from teammates and admins
    const newTeammates = team.teammates.filter((id) => id !== currentUser._id);
    const admins = team.admins || [];
    const newAdmins = admins.filter((id) => id !== currentUser._id);

    await ctx.db.patch(teamId, {
      teammates: newTeammates,
      admins: newAdmins,
    });

    return { success: true };
  },
});

export const updateTeamIcon = mutation({
  args: {
    teamId: v.id("teams"),
    icon: v.string(),
  },
  handler: async (ctx, { teamId, icon }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Only creator can update the team icon
    if (team.createdBy !== currentUser._id) {
      throw new Error("Only the team creator can update the team icon");
    }

    // Update the team icon
    await ctx.db.patch(teamId, { icon });

    return { success: true };
  },
});

export const deleteTeam = mutation({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Only creator can delete team
    if (team.createdBy !== currentUser._id) {
      throw new Error("Only team creator can delete the team");
    }

    // Delete all team messages first
    const teamMessages = await ctx.db
      .query("groupMessages")
      .withIndex("byTeam", (q) => q.eq("teamId", teamId))
      .collect();

    for (const msg of teamMessages) {
      await ctx.db.delete(msg._id);
    }

    // Delete the team
    await ctx.db.delete(teamId);

    return { success: true };
  },
});
