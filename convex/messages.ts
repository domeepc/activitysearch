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

    // Get all messages where current user is receiver (using index)
    const receivedMessages = await ctx.db
      .query("messages")
      .withIndex("byReceiver", (q) => q.eq("receiverId", currentUser._id))
      .collect();

    // Get messages where current user is sender (no index available, must use filter)
    // Note: This could be optimized with a senderId index in the schema
    const sentMessages = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("senderId"), currentUser._id))
      .collect();

    // Process messages efficiently: track only the last message per conversation
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

    // Process all messages once, keeping only the most recent per conversation
    for (const msg of [...sentMessages, ...receivedMessages]) {
      const partnerId =
        msg.senderId === currentUser._id ? msg.receiverId : msg.senderId;

      // Skip blocked users early to avoid unnecessary processing
      if (blocked.includes(partnerId)) {
        continue;
      }

      const partnerIdStr = partnerId.toString();
      conversationPartners.add(partnerIdStr);

      // Update last message if this one is more recent
      const existing = lastMessages.get(partnerIdStr);
      if (!existing || existing.timestamp < msg.timestamp) {
        lastMessages.set(partnerIdStr, {
          text: msg.text,
          timestamp: msg.timestamp,
          senderId: msg.senderId,
          readBy: msg.readBy,
        });
      }
    }

    // Batch fetch all partner users at once
    const partnerIds = Array.from(conversationPartners).map(
      (idStr) => idStr as typeof currentUser._id
    );
    const partners = await Promise.all(
      partnerIds.map((id) => ctx.db.get(id))
    );
    const partnerMap = new Map(
      partners
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => [p._id.toString(), p])
    );

    // Batch fetch all conversations for current user
    const allUserConversations = await ctx.db
      .query("conversations")
      .withIndex("byUser1", (q) => q.eq("user1Id", currentUser._id))
      .collect();
    const user2Conversations = await ctx.db
      .query("conversations")
      .withIndex("byUser2", (q) => q.eq("user2Id", currentUser._id))
      .collect();
    
    // Create a map of conversation slugs by partner ID
    const conversationMap = new Map<string, string>();
    for (const conv of [...allUserConversations, ...user2Conversations]) {
      const otherUserId =
        conv.user1Id === currentUser._id ? conv.user2Id : conv.user1Id;
      conversationMap.set(otherUserId.toString(), conv.slug);
    }

    // Build conversations array
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

        return {
          userId: partner._id,
          name: partner.name,
          lastname: partner.lastname,
          username: partner.username,
          slug: partner.slug,
          conversationSlug: conversationMap.get(partnerIdStr) || null,
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
        lastActive: friend.lastActive, // Kept for fallback if Ably is unavailable
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
