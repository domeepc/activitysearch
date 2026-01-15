"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MessageBubble } from "./MessageBubble";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { useUpdatePresence } from "@/lib/hooks/usePresence";

interface ChatViewProps {
  type: "individual" | "team";
  individualUserId?: Id<"users">;
  teamId?: Id<"teams">;
  messages: Array<{
    _id: string;
    text: string;
    timestamp: number;
    isFromCurrentUser: boolean;
    senderName?: string;
    senderAvatar?: string;
    status?: "sent" | "delivered" | "read";
  }>;
  otherUser?: {
    name: string;
    lastname: string;
    username: string;
    avatar: string;
  };
  teamName?: string;
  teamIcon?: string;
}

export function ChatView({
  type,
  individualUserId,
  teamId,
  messages,
  otherUser,
  teamName,
  teamIcon,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendMessage = useMutation(api.messages.sendMessage);
  const sendTeamMessage = useMutation(api.teams.sendTeamMessage);
  const markConversationAsRead = useMutation(
    api.messages.markConversationAsRead
  );
  const markTeamConversationAsRead = useMutation(
    api.teams.markTeamConversationAsRead
  );
  const { updatePresence } = useUpdatePresence();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read when viewing
  useEffect(() => {
    const markAsRead = async () => {
      try {
        if (type === "individual" && individualUserId) {
          await markConversationAsRead({ otherUserId: individualUserId });
        } else if (type === "team" && teamId) {
          await markTeamConversationAsRead({ teamId });
        }
      } catch (error) {
        console.error("Failed to mark messages as read:", error);
      }
    };

    if (messages.length > 0) {
      markAsRead();
    }
  }, [
    type,
    individualUserId,
    teamId,
    messages.length,
    markConversationAsRead,
    markTeamConversationAsRead,
  ]);

  const handleSend = async (text: string) => {
    try {
      // Update presence when sending a message to show user is active
      updatePresence("online");
      
      if (type === "individual" && individualUserId) {
        await sendMessage({
          receiverId: individualUserId,
          text,
        });
      } else if (type === "team" && teamId) {
        await sendTeamMessage({
          teamId,
          text,
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const displayName =
    type === "individual" && otherUser
      ? `${otherUser.name} ${otherUser.lastname}`
      : teamName || "Team Chat";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatHeader
        displayName={displayName}
        username={type === "individual" ? otherUser?.username : undefined}
        teamId={type === "team" ? teamId : undefined}
        teamIcon={type === "team" ? teamIcon : undefined}
        isTeam={type === "team"}
      />

      {/* Messages - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gray-200">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div>
            {messages.map((message, index) => (
              <MessageBubble
                key={message._id}
                text={message.text}
                timestamp={message.timestamp}
                isFromCurrentUser={message.isFromCurrentUser}
                senderName={message.senderName}
                senderAvatar={message.senderAvatar}
                showSenderName={type === "team"}
                status={message.status}
                previousTimestamp={
                  index > 0 ? messages[index - 1].timestamp : undefined
                }
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} />
    </div>
  );
}
