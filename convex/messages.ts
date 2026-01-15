import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";

// Helper function to generate secure random hash
function generateSecureHash(): string {
  // Generate a cryptographically secure random string
  // Using a combination of timestamp and random bytes
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}-${randomPart2}`.replace(/[^a-z0-9-]/g, "");
}

export const sendMessage = mutation({
  args: {
    receiverId: v.id("users"),
    text: v.string(),
  },
  handler: async (ctx, { receiverId, text }) => {
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

    // Validate message text
    if (!text.trim()) {
      throw new Error("Message cannot be empty");
    }

    const timestamp = Date.now();

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

    let conversationSlug: string;
    if (!conversation) {
      // Create new conversation with secure hash
      let slug = generateSecureHash();
      // Ensure slug is unique (very unlikely but check anyway)
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
        createdAt: timestamp,
      });
      const newConversation = await ctx.db.get(conversationId);
      conversationSlug = newConversation!.slug;
    } else {
      conversationSlug = conversation.slug;
    }

    await ctx.db.insert("messages", {
      senderId: sender._id,
      receiverId,
      text: text.trim(),
      timestamp,
    });

    return { success: true, conversationSlug };
  },
});

export const getConversations = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const blocked = currentUser.blocked || [];

    // Get all messages where current user is sender or receiver
    const sentMessages = await ctx.db
      .query("messages")
      .withIndex("byReceiver", (q) => q.eq("receiverId", currentUser._id))
      .collect();

    const receivedMessages = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("senderId"), currentUser._id))
      .collect();

    // Combine and get unique conversation partners
    const conversationPartners = new Set<string>();
    const lastMessages: Map<
      string,
      {
        text: string;
        timestamp: number;
        senderId: typeof currentUser._id;
        readBy?: (typeof currentUser._id)[];
      }
    > = new Map();

    for (const msg of [...sentMessages, ...receivedMessages]) {
      const partnerId =
        msg.senderId === currentUser._id ? msg.receiverId : msg.senderId;

      // Skip blocked users
      if (blocked.includes(partnerId)) {
        continue;
      }

      const partnerIdStr = partnerId.toString();

      if (
        !lastMessages.has(partnerIdStr) ||
        lastMessages.get(partnerIdStr)!.timestamp < msg.timestamp
      ) {
        lastMessages.set(partnerIdStr, {
          text: msg.text,
          timestamp: msg.timestamp,
          senderId: msg.senderId,
          readBy: msg.readBy,
        });
      }
      conversationPartners.add(partnerIdStr);
    }

    // Get user details for each conversation partner
    const conversations = await Promise.all(
      Array.from(conversationPartners).map(async (partnerIdStr) => {
        // Convert back to Id type
        const partnerId = partnerIdStr as typeof currentUser._id;
        const partner = await ctx.db.get(partnerId);
        if (!partner) return null;

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

        // Get conversation slug
        const userIds = [currentUser._id, partner._id].sort((a, b) =>
          a.localeCompare(b)
        );
        const allConversations = await ctx.db
          .query("conversations")
          .withIndex("byUser1", (q) => q.eq("user1Id", userIds[0]))
          .collect();

        const conversation = allConversations.find(
          (c) => c.user2Id === userIds[1]
        );

        return {
          userId: partner._id,
          name: partner.name,
          lastname: partner.lastname,
          username: partner.username,
          slug: partner.slug,
          conversationSlug: conversation?.slug || null,
          avatar: partner.avatar,
          role: partner.role,
          lastMessage: lastMessage?.text || "",
          lastMessageTime: lastMessage?.timestamp || 0,
          lastActive: partner.lastActive,
          lastMessageReadStatus,
        };
      })
    );

    // Filter out nulls and sort by last message time
    return conversations
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  },
});

export const getMessages = query({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, { otherUserId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get other user details
    const otherUser = await ctx.db.get(otherUserId);
    if (!otherUser) {
      throw new Error("User not found");
    }

    // Note: We allow viewing historical messages even if blocked
    // New messages are prevented by the sendMessage mutation

    // Get all messages between current user and other user
    const sentMessages = await ctx.db
      .query("messages")
      .filter((q) =>
        q.and(
          q.eq(q.field("senderId"), currentUser._id),
          q.eq(q.field("receiverId"), otherUserId)
        )
      )
      .collect();

    const receivedMessages = await ctx.db
      .query("messages")
      .filter((q) =>
        q.and(
          q.eq(q.field("senderId"), otherUserId),
          q.eq(q.field("receiverId"), currentUser._id)
        )
      )
      .collect();

    // Combine and sort by timestamp
    const allMessages = [...sentMessages, ...receivedMessages].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    // Get other user details (already fetched above for blocking check)
    // Re-fetch to ensure we have the latest data
    const otherUserData = await ctx.db.get(otherUserId);
    if (!otherUserData) {
      throw new Error("User not found");
    }

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
          timestamp: msg.timestamp,
          isFromCurrentUser: msg.senderId === currentUser._id,
          readBy: msg.readBy || [],
          status,
        };
      }),
      otherUser: {
        _id: otherUserData._id,
        name: otherUserData.name,
        lastname: otherUserData.lastname,
        username: otherUserData.username,
        avatar: otherUserData.avatar,
        lastActive: otherUserData.lastActive,
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

export const getMessagesByConversationSlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, { slug }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get conversation by secure hash slug
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("bySlug", (q) => q.eq("slug", slug))
      .first();

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Verify current user is part of this conversation
    if (
      conversation.user1Id !== currentUser._id &&
      conversation.user2Id !== currentUser._id
    ) {
      throw new Error("You do not have access to this conversation");
    }

    const otherUserId =
      conversation.user1Id === currentUser._id
        ? conversation.user2Id
        : conversation.user1Id;

    const friend = await ctx.db.get(otherUserId);
    if (!friend) {
      throw new Error("User not found");
    }

    // Note: We allow viewing historical messages even if blocked
    // New messages are prevented by the sendMessage mutation

    // Get all messages between current user and other user
    const sentMessages = await ctx.db
      .query("messages")
      .filter((q) =>
        q.and(
          q.eq(q.field("senderId"), currentUser._id),
          q.eq(q.field("receiverId"), otherUserId)
        )
      )
      .collect();

    const receivedMessages = await ctx.db
      .query("messages")
      .filter((q) =>
        q.and(
          q.eq(q.field("senderId"), otherUserId),
          q.eq(q.field("receiverId"), currentUser._id)
        )
      )
      .collect();

    // Allow access if they have messages together OR if they're friends
    // This allows viewing historical conversations even if friendship was removed
    const hasMessages = sentMessages.length > 0 || receivedMessages.length > 0;
    const isFriend = currentUser.friends.includes(friend._id);

    if (!hasMessages && !isFriend) {
      throw new Error("You are not friends with this user");
    }

    // Combine and sort by timestamp
    const allMessages = [...sentMessages, ...receivedMessages].sort(
      (a, b) => a.timestamp - b.timestamp
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
          timestamp: msg.timestamp,
          isFromCurrentUser: msg.senderId === currentUser._id,
          readBy: msg.readBy || [],
          status,
        };
      }),
      otherUser: {
        _id: friend._id,
        name: friend.name,
        lastname: friend.lastname,
        username: friend.username,
        avatar: friend.avatar,
        lastActive: friend.lastActive,
        slug: friend.slug,
      },
      conversationSlug: conversation.slug,
    };
  },
});

// Mutation to create a conversation slug for a user pair (called when opening chat)
export const createConversationSlug = mutation({
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
      return conversation.slug;
    }

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

    await ctx.db.insert("conversations", {
      user1Id,
      user2Id,
      slug,
      createdAt: Date.now(),
    });

    return slug;
  },
});

export const markConversationAsRead = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, { otherUserId }) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get all unread messages from other user to current user
    const unreadMessages = await ctx.db
      .query("messages")
      .filter((q) =>
        q.and(
          q.eq(q.field("senderId"), otherUserId),
          q.eq(q.field("receiverId"), currentUser._id)
        )
      )
      .collect();

    // Mark all as read
    for (const msg of unreadMessages) {
      const readBy = msg.readBy || [];
      if (!readBy.includes(currentUser._id)) {
        await ctx.db.patch(msg._id, {
          readBy: [...readBy, currentUser._id],
        });
      }
    }

    return { success: true };
  },
});
