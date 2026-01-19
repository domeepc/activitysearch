"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MessageBubble } from "./MessageBubble";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { useUpdatePresence } from "@/lib/hooks/usePresence";
import { useEncryptionWithUser } from "@/lib/hooks/useEncryption";
import { extractErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import { Lock } from "lucide-react";

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
    encrypted?: boolean;
    encryptionVersion?: "symmetric" | "asymmetric";
    messageType?: "text" | "reservation_card";
    reservationCardData?: {
      reservationId: Id<"reservations">;
    };
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const sendMessage = useMutation(api.messages.sendMessage);
  const sendTeamMessage = useMutation(api.teams.sendTeamMessage);
  const markConversationAsRead = useMutation(
    api.messages.markConversationAsRead
  );
  const markTeamConversationAsRead = useMutation(
    api.teams.markTeamConversationAsRead
  );
  const migrateMessageToEncrypted = useMutation(
    api.messages.migrateMessageToEncrypted
  );
  const migrateTeamMessageToEncrypted = useMutation(
    api.teams.migrateTeamMessageToEncrypted
  );
  const { updatePresence } = useUpdatePresence();

  // Get current user for encryption
  const currentUser = useQuery(api.users.current);
  const currentUserId = currentUser?._id;

  // Initialize encryption
  const {
    encryptMessage,
    decryptMessage,
    isEncryptionReady,
    isEncryptionAvailable,
  } = useEncryptionWithUser({
    currentUserId,
    otherUserId: individualUserId,
    teamId,
  });

  // Decrypt messages
  const [decryptedMessages, setDecryptedMessages] = useState<
    Array<{
      _id: string;
      text: string;
      timestamp: number;
      isFromCurrentUser: boolean;
      senderName?: string;
      senderAvatar?: string;
      status?: "sent" | "delivered" | "read";
      decryptionError?: boolean;
      encryptionVersion?: "symmetric" | "asymmetric";
      messageType?: "text" | "reservation_card";
      reservationCardData?: {
        reservationId: Id<"reservations">;
      };
    }>
  >([]);

  // Decrypt messages when they change and migrate unencrypted messages
  useEffect(() => {
    const decryptAllMessages = async () => {
      if (!isEncryptionReady && isEncryptionAvailable) {
        // Encryption not ready yet, show encrypted placeholder
        setDecryptedMessages(
          messages.map((msg) => ({
            ...msg,
            text: msg.encrypted ? "Decrypting..." : msg.text,
          }))
        );
        return;
      }

      const decrypted = await Promise.all(
        messages.map(async (msg) => {
          // Skip decryption for reservation card messages
          if (msg.messageType === "reservation_card") {
            return {
              ...msg,
              text: msg.text,
              decryptionError: false,
            };
          }

          if (msg.encrypted && isEncryptionAvailable) {
            try {
              // Use encryptionVersion from message, default to symmetric for backward compatibility
              const encryptionVersion = msg.encryptionVersion || "symmetric";
              const decryptedText = await decryptMessage(msg.text, true, encryptionVersion);
              return {
                ...msg,
                text: decryptedText,
                decryptionError: false,
                encryptionVersion,
              };
            } catch (error) {
              // Log as warning since we're handling it gracefully in the UI
              // Only log detailed info in development
              if (process.env.NODE_ENV === "development") {
                console.warn("Failed to decrypt message (handled gracefully):", {
                  messageId: msg._id,
                  error: error instanceof Error ? error.message : "Unknown error",
                  isFromCurrentUser: msg.isFromCurrentUser,
                  encryptionVersion: msg.encryptionVersion,
                });
              }
              return {
                ...msg,
                text: "Unable to decrypt this message",
                decryptionError: true,
              };
            }
          } else {
            // Message is not encrypted - migrate it if encryption is available
            if (isEncryptionAvailable && isEncryptionReady && !msg.encrypted) {
              try {
                // Encrypt the message
                const encryptedText = await encryptMessage(msg.text);

                // Migrate to encrypted in background (don't wait for it)
                if (type === "individual" && individualUserId) {
                  migrateMessageToEncrypted({
                    messageId: msg._id as Id<"messages">,
                    encryptedText,
                  }).catch(() => {
                    // Best-effort migration; fail silently
                  });
                } else if (type === "team" && teamId) {
                  migrateTeamMessageToEncrypted({
                    messageId: msg._id as Id<"groupMessages">,
                    encryptedText,
                  }).catch(() => {
                    // Best-effort migration; fail silently
                  });
                }
              } catch {
                // Continue with unencrypted text
              }
            }

            return {
              ...msg,
              text: msg.text,
              decryptionError: false,
            };
          }
        })
      );

      setDecryptedMessages(decrypted);
    };

    decryptAllMessages();
  }, [
    messages,
    isEncryptionReady,
    isEncryptionAvailable,
    decryptMessage,
    encryptMessage,
    type,
    individualUserId,
    teamId,
    migrateMessageToEncrypted,
    migrateTeamMessageToEncrypted,
  ]);

  const scrollToBottom = () => {
    // Use a combination of requestAnimationFrame and setTimeout to ensure DOM has updated
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        } else if (messagesContainerRef.current) {
          // Fallback: scroll the container directly
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    });
  };

  useEffect(() => {
    // Scroll when messages or decryptedMessages change
    if (decryptedMessages.length > 0) {
      scrollToBottom();
    }
  }, [messages, decryptedMessages]);

  // Mark messages as read when viewing
  useEffect(() => {
    const markAsRead = async () => {
      try {
        if (type === "individual" && individualUserId) {
          await markConversationAsRead({ otherUserId: individualUserId });
        } else if (type === "team" && teamId) {
          await markTeamConversationAsRead({ teamId });
        }
        // Update presence when messages are read
        updatePresence("online");
      } catch {
        // Best-effort; fail silently
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
    updatePresence,
  ]);

  const handleSend = async (text: string) => {
    try {
      // Encrypt message if encryption is available and ready
      const messageText = text;
      let encryptedText: string | undefined;

      let encryptionVersion: "symmetric" | "asymmetric" | undefined = undefined;
      if (isEncryptionAvailable && isEncryptionReady) {
        try {
          // Use asymmetric encryption by default
          encryptedText = await encryptMessage(text, "asymmetric");
          encryptionVersion = "asymmetric";
        } catch {
          // Fallback to unencrypted if encryption fails
        }
      }

      if (type === "individual" && individualUserId) {
        await sendMessage({
          receiverId: individualUserId,
          ...(encryptedText ? { encryptedText, encryptionVersion } : { text: messageText }),
        });
      } else if (type === "team" && teamId) {
        await sendTeamMessage({
          teamId,
          ...(encryptedText ? { encryptedText, encryptionVersion } : { text: messageText }),
        });
      }
      // Update presence when message is sent
      updatePresence("online");
      // Scroll to bottom after sending message
      setTimeout(() => {
        scrollToBottom();
      }, 200);
    } catch (error) {
      toast.error(extractErrorMessage(error));
      throw error;
    }
  };

  const displayName =
    type === "individual" && otherUser
      ? `${otherUser.name} ${otherUser.lastname}`
      : teamName || "Team Chat";

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <ChatHeader
        displayName={displayName}
        username={type === "individual" ? otherUser?.username : undefined}
        teamId={type === "team" ? teamId : undefined}
        teamIcon={type === "team" ? teamIcon : undefined}
        isTeam={type === "team"}
      />

      {/* Messages - Scrollable */}

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 min-h-0 bg-gray-200 relative">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div>
            {decryptedMessages.map((message, index) => (
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
                  index > 0 ? decryptedMessages[index - 1].timestamp : undefined
                }
                decryptionError={message.decryptionError}
                messageType={message.messageType}
                reservationCardData={message.reservationCardData}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}


      </div>


      {/* Message Input Section with E2E Encryption Badge */}
      <div className="relative shrink-0">

        {isEncryptionAvailable && (
          <div className="absolute -top-1/2 left-1/2 transform -translate-x-1/2 cursor-default select-none flex items-center gap-1.5 text-xs text-muted-foreground/60 bg-background/80 px-2 py-1 rounded-full backdrop-blur-sm">
            <Lock className="h-3 w-3" />
            <span>End-to-end encrypted</span>
          </div>
        )}
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}
