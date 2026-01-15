"use client";

import { useEffect, use } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChatView } from "@/components/chat/ChatView";

export default function IndividualChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  // Use secure hash conversation slug
  const messagesData = useQuery(api.messages.getMessagesByConversationSlug, {
    slug,
  });
  const markConversationAsRead = useMutation(
    api.messages.markConversationAsRead
  );

  // Mark messages as read when viewing
  useEffect(() => {
    const markAsRead = async () => {
      if (messagesData?.otherUser) {
        try {
          await markConversationAsRead({
            otherUserId: messagesData.otherUser._id,
          });
        } catch (error) {
          console.error("Failed to mark messages as read:", error);
        }
      }
    };

    if (messagesData && messagesData.messages.length > 0) {
      markAsRead();
    }
  }, [messagesData, markConversationAsRead]);

  if (messagesData === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading...</p>
      </div>
    );
  }

  if (messagesData === null || !messagesData.otherUser) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">Conversation not found</p>
          <p className="text-sm">
            You may not have access to this conversation.
          </p>
        </div>
      </div>
    );
  }

  const messages = messagesData.messages.map((msg) => ({
    _id: msg._id.toString(),
    text: msg.text,
    timestamp: msg.timestamp,
    isFromCurrentUser: msg.isFromCurrentUser,
    status: (msg.status || undefined) as
      | "sent"
      | "delivered"
      | "read"
      | undefined,
  }));

  return (
    <ChatView
      type="individual"
      individualUserId={messagesData.otherUser._id}
      messages={messages}
      otherUser={messagesData.otherUser}
    />
  );
}
