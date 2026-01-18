import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow, getCurrentUser } from "./users";
import { Id } from "./_generated/dataModel";

export const sendMessage = mutation({
  args: {
    receiverId: v.id("users"),
    text: v.optional(v.string()),
    encryptedText: v.optional(v.string()),
    encryptionVersion: v.optional(v.union(v.literal("symmetric"), v.literal("asymmetric"))),
  },
  handler: async (ctx, { receiverId, text, encryptedText, encryptionVersion }) => {
    const sender = await getCurrentUserOrThrow(ctx);

    if (sender._id === receiverId) {
      throw new Error("Cannot send message to yourself");
    }

    // Check if receiver is blocked
    const blocked = sender.blocked || [];
    if (blocked.includes(receiverId)) {
      throw new Error("Cannot send message to a blocked user");
    }

    // Check if current user is blocked by receiver
    const receiver = await ctx.db.get(receiverId);
    if (!receiver) {
      throw new Error("Receiver not found");
    }
    const receiverBlocked = receiver.blocked || [];
    if (receiverBlocked.includes(sender._id)) {
      throw new Error("You have been blocked by this user");
    }

    // Validate message - must have either text or encryptedText
    const messageText = encryptedText || text;
    if (!messageText || !messageText.trim()) {
      throw new Error("Message cannot be empty");
    }

    const isEncrypted = !!encryptedText;

    // Ensure conversation exists with secure hash slug
    const userIds = [sender._id, receiverId].sort((a, b) => a.localeCompare(b));
    const user1Id = userIds[0];
    const user2Id = userIds[1];

    // Find conversation by checking both user positions
    const allConversations = await ctx.db
      .query("conversations")
      .withIndex("byUser1", (q) => q.eq("user1Id", user1Id))
      .collect();

    const conversation = allConversations.find((c) => c.user2Id === user2Id);

    let conversationId: Id<"conversations">;
    if (!conversation) {
      // Create new conversation
      conversationId = await ctx.db.insert("conversations", {
        user1Id,
        user2Id,
        createdAt: Date.now(),
      });
    } else {
      conversationId = conversation._id;
    }

    await ctx.db.insert("messages", {
      senderId: sender._id,
      receiverId,
      text: messageText.trim(),
      encrypted: isEncrypted ? true : undefined,
      encryptionVersion: isEncrypted && encryptionVersion ? encryptionVersion : undefined,
    });

    return { success: true, conversationId };
  },
});

export const getConversations = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return [];
    }
    const blocked = currentUser.blocked || [];
    const friends = currentUser.friends || [];

    // Filter out blocked users from friends list
    const validFriends = friends.filter((friendId) => !blocked.includes(friendId));

    if (validFriends.length === 0) {
      return [];
    }

    // Batch fetch all conversations for current user at once
    const allUserConversations = await ctx.db
      .query("conversations")
      .withIndex("byUser1", (q) => q.eq("user1Id", currentUser._id))
      .collect();
    const user2Conversations = await ctx.db
      .query("conversations")
      .withIndex("byUser2", (q) => q.eq("user2Id", currentUser._id))
      .collect();
    
    // Create a map of conversation data by partner ID and track reservation conversations
    const conversationMap = new Map<string, { conversationId: Id<"conversations">; reservationId?: Id<"reservations"> }>();
    for (const conv of [...allUserConversations, ...user2Conversations]) {
      const otherUserId =
        conv.user1Id === currentUser._id ? conv.user2Id : conv.user1Id;
      conversationMap.set(otherUserId.toString(), {
        conversationId: conv._id,
        reservationId: conv.reservationId,
      });
    }

    // Get all messages where current user is sender or receiver in parallel
    // This is more efficient than querying per friend
    const allSentMessages = await Promise.all(
      validFriends.map((friendId) =>
        ctx.db
          .query("messages")
          .withIndex("byConversation", (q) =>
            q.eq("senderId", currentUser._id).eq("receiverId", friendId)
          )
          .collect()
      )
    );

    const allReceivedMessages = await Promise.all(
      validFriends.map((friendId) =>
        ctx.db
          .query("messages")
          .withIndex("byConversation", (q) =>
            q.eq("senderId", friendId).eq("receiverId", currentUser._id)
          )
          .collect()
      )
    );

    // Build lastMessages map efficiently
    const lastMessages: Map<
      string,
      {
        text: string;
        timestamp: number;
        senderId: typeof currentUser._id;
        readBy?: (typeof currentUser._id)[];
      }
    > = new Map();

    for (let i = 0; i < validFriends.length; i++) {
      const friendId = validFriends[i];
      const sentToFriend = allSentMessages[i];
      const receivedFromFriend = allReceivedMessages[i];

      // Find the most recent message in this conversation
      const allMessages = [...sentToFriend, ...receivedFromFriend];
      if (allMessages.length > 0) {
        const lastMessage = allMessages.reduce((latest, msg) =>
          msg._creationTime > latest._creationTime ? msg : latest
        );

        lastMessages.set(friendId.toString(), {
          text: lastMessage.text,
          timestamp: lastMessage._creationTime,
          senderId: lastMessage.senderId,
          readBy: lastMessage.readBy,
        });
      }
    }

    // Get partner IDs that have messages (conversations)
    const partnerIds = Array.from(lastMessages.keys()).map(
      (idStr) => idStr as typeof currentUser._id
    );

    if (partnerIds.length === 0) {
      return [];
    }

    // Batch fetch all partner users at once
    const partners = await Promise.all(
      partnerIds.map((id) => ctx.db.get(id))
    );
    const partnerMap = new Map(
      partners
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => [p._id.toString(), p])
    );

    // Build conversations array - only include friends with messages
    const conversations = partnerIds
      .map((partnerId) => {
        const partner = partnerMap.get(partnerId.toString());
        if (!partner) return null;

        const partnerIdStr = partnerId.toString();
        const lastMessage = lastMessages.get(partnerIdStr);

        // Determine read status
        let lastMessageReadStatus: "sent" | "delivered" | "read" | null = null;
        if (lastMessage) {
          // Only show status if message was sent by current user
          if (lastMessage.senderId === currentUser._id) {
            // Check if the partner has read the message
            const isRead = lastMessage.readBy?.includes(partnerId) || false;
            // For individual messages: "sent" = one gray check, "read" = two blue checks
            // "delivered" is not used for individual messages (only for teams)
            lastMessageReadStatus = isRead ? "read" : "sent";
          }
        }

        const convData = conversationMap.get(partnerIdStr);
        return {
          userId: partner._id,
          name: partner.name,
          lastname: partner.lastname,
          username: partner.username,
          slug: partner.slug,
          conversationId: convData?.conversationId || null,
          reservationId: convData?.reservationId || null,
          avatar: partner.avatar,
          role: partner.role,
          lastMessage: lastMessage?.text || "",
          lastMessageTime: lastMessage?.timestamp || 0,
          lastActive: partner.lastActive, // Kept for fallback if Ably is unavailable
          lastMessageReadStatus,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // Sort by last message time
    return conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  },
});

export const getMessages = query({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, { otherUserId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get other user details (only fetch once)
    const otherUser = await ctx.db.get(otherUserId);
    if (!otherUser) {
      throw new Error("User not found");
    }

    // Note: We allow viewing historical messages even if blocked
    // New messages are prevented by the sendMessage mutation

    // Get all messages between current user and other user using the conversation index
    const sentMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q.eq("senderId", currentUser._id).eq("receiverId", otherUserId)
      )
      .collect();

    const receivedMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q.eq("senderId", otherUserId).eq("receiverId", currentUser._id)
      )
      .collect();

    // Combine and sort by creation time
    const allMessages = [...sentMessages, ...receivedMessages].sort(
      (a, b) => a._creationTime - b._creationTime
    );

    return {
      messages: allMessages.map((msg) => {
        // Determine status for messages sent by current user
        let status: "sent" | "read" | null = null;
        if (msg.senderId === currentUser._id) {
          // Message sent by current user - check if receiver has read it
          const isRead = msg.readBy?.includes(otherUserId) || false;
          status = isRead ? "read" : "sent";
        }

        return {
          _id: msg._id,
          text: msg.text,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          timestamp: msg._creationTime,
          isFromCurrentUser: msg.senderId === currentUser._id,
          readBy: msg.readBy || [],
          status,
          encrypted: msg.encrypted || false,
          encryptionVersion: msg.encryptionVersion || (msg.encrypted ? "symmetric" : undefined),
        };
      }),
      otherUser: {
        _id: otherUser._id,
        name: otherUser.name,
        lastname: otherUser.lastname,
        username: otherUser.username,
        avatar: otherUser.avatar,
        lastActive: otherUser.lastActive, // Kept for fallback if Ably is unavailable
      },
    };
  },
});

export const markMessageAsRead = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, { messageId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const message = await ctx.db.get(messageId);

    if (!message) {
      throw new Error("Message not found");
    }

    // Only the receiver can mark a message as read
    if (message.receiverId !== currentUser._id) {
      throw new Error("You can only mark messages sent to you as read");
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

export const getMessagesByConversationId = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) return null;

    // Get conversation by ID
    const conversation = await ctx.db.get(conversationId);

    if (!conversation) {
      // Conversation may have been deleted (e.g., when friend was removed)
      // Return null to allow frontend to handle gracefully
      return null;
    }

    // Verify current user is part of this conversation
    if (
      conversation.user1Id !== currentUser._id &&
      conversation.user2Id !== currentUser._id
    ) {
      throw new Error("You do not have access to this conversation");
    }

    // If this is a reservation chat, the reservation must still exist
    if (conversation.reservationId !== undefined) {
      const reservation = await ctx.db.get(conversation.reservationId);
      if (!reservation) {
        return null; // Reservation deleted; treat as conversation not found
      }
    }

    const otherUserId =
      conversation.user1Id === currentUser._id
        ? conversation.user2Id
        : conversation.user1Id;

    // Get other user details (only fetch once)
    const friend = await ctx.db.get(otherUserId);
    if (!friend) {
      throw new Error("User not found");
    }

    // Note: We allow viewing historical messages even if blocked
    // New messages are prevented by the sendMessage mutation

    // Get all messages between current user and other user using the conversation index
    const sentMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q.eq("senderId", currentUser._id).eq("receiverId", otherUserId)
      )
      .collect();

    const receivedMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q.eq("senderId", otherUserId).eq("receiverId", currentUser._id)
      )
      .collect();

    // Check if this is a reservation conversation (conversation already fetched above)
    const isReservationChat = conversation.reservationId !== undefined;

    // Allow access if they have messages together OR if they're friends OR if it's a reservation chat
    // This allows viewing historical conversations even if friendship was removed
    // and allows reservation chats without requiring friendship
    const hasMessages = sentMessages.length > 0 || receivedMessages.length > 0;
    const isFriend = currentUser.friends.includes(friend._id);

    if (!hasMessages && !isFriend && !isReservationChat) {
      throw new Error("You are not friends with this user");
    }

    // Combine and sort by creation time
    const allMessages = [...sentMessages, ...receivedMessages].sort(
      (a, b) => a._creationTime - b._creationTime
    );

    return {
      messages: allMessages.map((msg) => {
        // Determine status for messages sent by current user
        let status: "sent" | "read" | null = null;
        if (msg.senderId === currentUser._id) {
          // Message sent by current user - check if receiver has read it
          const isRead = msg.readBy?.includes(otherUserId) || false;
          status = isRead ? "read" : "sent";
        }

        return {
          _id: msg._id,
          text: msg.text,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          timestamp: msg._creationTime,
          isFromCurrentUser: msg.senderId === currentUser._id,
          readBy: msg.readBy || [],
          status,
          encrypted: msg.encrypted || false,
          encryptionVersion: msg.encryptionVersion || (msg.encrypted ? "symmetric" : undefined),
        };
      }),
      otherUser: {
        _id: friend._id,
        name: friend.name,
        lastname: friend.lastname,
        username: friend.username,
        avatar: friend.avatar,
        lastActive: friend.lastActive, // Kept for fallback if Ably is unavailable
        slug: friend.slug,
      },
      conversationId: conversation._id,
    };
  },
});

// Mutation to get or create a conversation ID for a user pair (called when opening chat)
export const getOrCreateConversationId = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, { otherUserId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    if (currentUser._id === otherUserId) {
      throw new Error("Cannot create conversation with yourself");
    }

    const userIds = [currentUser._id, otherUserId].sort((a, b) =>
      a.localeCompare(b)
    );
    const user1Id = userIds[0];
    const user2Id = userIds[1];

    // Find existing conversation
    const allConversations = await ctx.db
      .query("conversations")
      .withIndex("byUser1", (q) => q.eq("user1Id", user1Id))
      .collect();

    const conversation = allConversations.find((c) => c.user2Id === user2Id);

    if (conversation) {
      return conversation._id;
    }

    // Create new conversation
    const conversationId = await ctx.db.insert("conversations", {
      user1Id,
      user2Id,
      createdAt: Date.now(),
    });

    return conversationId;
  },
});

export const markConversationAsRead = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, { otherUserId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Use the byConversation index for efficient querying
    // Only get messages sent TO current user FROM other user
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("byConversation", (q) =>
        q.eq("senderId", otherUserId).eq("receiverId", currentUser._id)
      )
      .collect();

    // Mark all as read in parallel
    // Additional safety check: ensure we never mark our own messages as read
    await Promise.all(
      unreadMessages.map(async (msg) => {
        // Double-check: never mark messages sent by current user as read
        if (msg.senderId === currentUser._id) {
          return;
        }
        const readBy = msg.readBy || [];
        if (!readBy.includes(currentUser._id)) {
          await ctx.db.patch(msg._id, {
            readBy: [...readBy, currentUser._id],
          });
        }
      })
    );

    return { success: true };
  },
});

export const migrateMessageToEncrypted = mutation({
  args: {
    messageId: v.id("messages"),
    encryptedText: v.string(),
  },
  handler: async (ctx, { messageId, encryptedText }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const message = await ctx.db.get(messageId);

    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user has access to this message
    const isSender = message.senderId === currentUser._id;
    const isReceiver = message.receiverId === currentUser._id;

    if (!isSender && !isReceiver) {
      throw new Error("You do not have access to this message");
    }

    // Only migrate if not already encrypted
    if (message.encrypted) {
      return { success: true, alreadyEncrypted: true };
    }

    // Update message with encrypted text
    // Migration uses asymmetric encryption (new default)
    await ctx.db.patch(messageId, {
      text: encryptedText,
      encrypted: true,
      encryptionVersion: "asymmetric",
    });

    return { success: true };
  },
});

export const getReservationConversations = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      return [];
    }
    const blocked = currentUser.blocked || [];

    // Get all conversations with reservationId set
    const allUserConversations = await ctx.db
      .query("conversations")
      .withIndex("byUser1", (q) => q.eq("user1Id", currentUser._id))
      .collect();
    const user2Conversations = await ctx.db
      .query("conversations")
      .withIndex("byUser2", (q) => q.eq("user2Id", currentUser._id))
      .collect();

    // Filter to only reservation conversations
    const reservationConversations = [...allUserConversations, ...user2Conversations].filter(
      (conv) => conv.reservationId !== undefined
    );

    if (reservationConversations.length === 0) {
      return [];
    }

    // Filter out blocked users from reservation conversations
    const validReservationConversations = reservationConversations.filter(
      (conv) => {
        const otherUserId =
          conv.user1Id === currentUser._id ? conv.user2Id : conv.user1Id;
        return !blocked.includes(otherUserId);
      }
    );

    // Get all partner IDs from reservation conversations (even without messages)
    const allPartnerIds = new Set<string>();
    for (const conv of validReservationConversations) {
      const otherUserId =
        conv.user1Id === currentUser._id ? conv.user2Id : conv.user1Id;
      allPartnerIds.add(otherUserId.toString());
    }

    const partnerIdsForMessages = Array.from(allPartnerIds).map(
      (idStr) => idStr as typeof currentUser._id
    );

    // Batch fetch all messages in parallel instead of in a loop
    const allSentMessages = await Promise.all(
      partnerIdsForMessages.map((otherUserId) =>
        ctx.db
          .query("messages")
          .withIndex("byConversation", (q) =>
            q.eq("senderId", currentUser._id).eq("receiverId", otherUserId)
          )
          .collect()
      )
    );

    const allReceivedMessages = await Promise.all(
      partnerIdsForMessages.map((otherUserId) =>
        ctx.db
          .query("messages")
          .withIndex("byConversation", (q) =>
            q.eq("senderId", otherUserId).eq("receiverId", currentUser._id)
          )
          .collect()
      )
    );

    // Build lastMessages map efficiently
    const lastMessages: Map<
      string,
      {
        text: string;
        timestamp: number;
        senderId: typeof currentUser._id;
        readBy?: (typeof currentUser._id)[];
      }
    > = new Map();

    for (let i = 0; i < partnerIdsForMessages.length; i++) {
      const otherUserId = partnerIdsForMessages[i];
      const sentToOther = allSentMessages[i];
      const receivedFromOther = allReceivedMessages[i];

      // Find the most recent message in this conversation
      const allMessages = [...sentToOther, ...receivedFromOther];
      if (allMessages.length > 0) {
        const lastMessage = allMessages.reduce((latest, msg) =>
          msg._creationTime > latest._creationTime ? msg : latest
        );

        lastMessages.set(otherUserId.toString(), {
          text: lastMessage.text,
          timestamp: lastMessage._creationTime,
          senderId: lastMessage.senderId,
          readBy: lastMessage.readBy,
        });
      }
    }
    
    const partnerIds = partnerIdsForMessages;

    if (partnerIds.length === 0) {
      return [];
    }

    // Batch fetch all partner users at once
    const partners = await Promise.all(
      partnerIds.map((id) => ctx.db.get(id))
    );
    const partnerMap = new Map(
      partners
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => [p._id.toString(), p])
    );

    // Get reservation details for each conversation - batch fetch
    const reservationIds = reservationConversations
      .map((conv) => conv.reservationId)
      .filter((id): id is Id<"reservations"> => id !== undefined);

    const reservations = await Promise.all(
      reservationIds.map((id) => ctx.db.get(id))
    );

    const activityIds = reservations
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => r.activityId);

    const activities = await Promise.all(
      activityIds.map((id) => ctx.db.get(id))
    );

    const activityMap = new Map(
      activities
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .map((a) => [a._id.toString(), a])
    );

    const reservationMap = new Map<string, {
      reservationId: Id<"reservations">;
      activityName: string;
      date: string;
      time: string;
      status: "active" | "cancelled";
    }>();

    for (const conv of reservationConversations) {
      if (conv.reservationId) {
        const reservation = reservations.find((r) => r?._id === conv.reservationId);
        if (reservation) {
          const activity = activityMap.get(reservation.activityId.toString());
          const otherUserId =
            conv.user1Id === currentUser._id ? conv.user2Id : conv.user1Id;
          reservationMap.set(otherUserId.toString(), {
            reservationId: reservation._id,
            activityName: activity?.activityName || "Unknown Activity",
            date: reservation.date,
            time: reservation.time,
            status: reservation.cancelledAt ? "cancelled" : "active",
          });
        }
      }
    }

    // Build conversations array
    const conversations = partnerIds
      .map((partnerId) => {
        const partner = partnerMap.get(partnerId.toString());
        if (!partner) return null;

        const partnerIdStr = partnerId.toString();
        const lastMessage = lastMessages.get(partnerIdStr);
        const reservationData = reservationMap.get(partnerIdStr);

        // Exclude reservation conversations whose reservation no longer exists
        if (!reservationData) {
          return null;
        }

        // Find conversation
        const conv = reservationConversations.find(
          (c) =>
            (c.user1Id === currentUser._id && c.user2Id === partnerId) ||
            (c.user2Id === currentUser._id && c.user1Id === partnerId)
        );

        // Determine read status
        let lastMessageReadStatus: "sent" | "delivered" | "read" | null = null;
        if (lastMessage) {
          if (lastMessage.senderId === currentUser._id) {
            const isRead = lastMessage.readBy?.includes(partnerId) || false;
            lastMessageReadStatus = isRead ? "read" : "sent";
          }
        }

        return {
          userId: partner._id,
          name: partner.name,
          lastname: partner.lastname,
          username: partner.username,
          slug: partner.slug,
          conversationId: conv?._id || null,
          reservationId: reservationData?.reservationId || null,
          activityName: reservationData?.activityName || null,
          reservationDate: reservationData?.date || null,
          reservationTime: reservationData?.time || null,
          reservationStatus: reservationData?.status || null,
          avatar: partner.avatar,
          role: partner.role,
          lastMessage: lastMessage?.text || "",
          lastMessageTime: lastMessage?.timestamp || 0,
          lastActive: partner.lastActive,
          lastMessageReadStatus,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // Sort by last message time
    return conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  },
});


export const getUnreadMessageCount = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);

    // Return 0 if user is not authenticated
    if (!currentUser) {
      return 0;
    }

    // Count unread individual messages
    const unreadIndividualMessages = await ctx.db
      .query("messages")
      .withIndex("byReceiver", (q) => q.eq("receiverId", currentUser._id))
      .collect();

    const unreadIndividualCount = unreadIndividualMessages.filter((msg) => {
      const readBy = msg.readBy || [];
      return !readBy.includes(currentUser._id);
    }).length;

    // Count unread team messages - optimize by fetching teams and messages in parallel
    const allTeams = await ctx.db.query("teams").collect();
    const userTeams = allTeams.filter((team) =>
      team.teammates.includes(currentUser._id)
    );

    // Fetch all team messages in parallel
    const allTeamMessages = await Promise.all(
      userTeams.map((team) =>
        ctx.db
          .query("groupMessages")
          .withIndex("byTeam", (q) => q.eq("teamId", team._id))
          .collect()
      )
    );

    // Count unread messages across all teams
    let unreadTeamCount = 0;
    for (const teamMessages of allTeamMessages) {
      const unreadTeamMessages = teamMessages.filter((msg) => {
        // Don't count messages sent by current user
        if (msg.senderId === currentUser._id) return false;
        const readBy = msg.readBy || [];
        return !readBy.includes(currentUser._id);
      });

      unreadTeamCount += unreadTeamMessages.length;
    }

    return unreadIndividualCount + unreadTeamCount;
  },
});
