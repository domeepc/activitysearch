"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChatView } from "@/components/chat/ChatView";
import { Id } from "@/convex/_generated/dataModel";
import { Spinner } from "@/components/ui/spinner";

export default function IndividualChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const conversationId = resolvedParams.slug as Id<"conversations">;
  const router = useRouter();

  // Use conversation ID directly
  const messagesData = useQuery(api.messages.getMessagesByConversationId, {
    conversationId,
  });

  // Redirect to chat list if conversation not found (e.g., friend was removed)
  useEffect(() => {
    if (messagesData === null) {
      router.push("/chat");
    }
  }, [messagesData, router]);

  if (messagesData === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (messagesData === null || !messagesData.otherUser) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">Conversation not found</p>
          <p className="text-sm">Redirecting...</p>
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
    encrypted: msg.encrypted || false,
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
