"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ChatLinkPrompt } from "./ChatLinkPrompt";
import { SecurityCodeDialog } from "./SecurityCodeDialog";
import { useChatHeaderState } from "./ChatHeaderState";
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
    senderProfileUserId?: Id<"users">;
    status?: "sent" | "delivered" | "read";
    encrypted?: boolean;
    encryptionVersion?: "symmetric" | "asymmetric" | "teamKey";
    messageType?: "text" | "reservation_card";
    reservationCardData?: {
      reservationId: Id<"reservations">;
    };
  }>;
  otherUser?: {
    _id: Id<"users">;
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
  const { setHeaderData, clearHeaderData } = useChatHeaderState();

  // Get current user for encryption
  const currentUser = useQuery(api.users.current);
  const currentUserId = currentUser?._id;

  // Initialize encryption
  const {
    encryptMessage,
    decryptMessage,
    isEncryptionReady,
    isEncryptionAvailable,
    encryptionError,
    keyStatus,
    ownPublicKey,
    otherPublicKeyJWK,
    linkCode,
    linkFailed,
    requestNewLink,
    startFresh,
  } = useEncryptionWithUser({
    currentUserId,
    otherUserId: individualUserId,
    teamId,
  });

  const canEncrypt = isEncryptionAvailable && isEncryptionReady;
  const [securityCodeOpen, setSecurityCodeOpen] = useState(false);
  const keyChanges =
    useQuery(api.users.getKeyChanges, individualUserId ? { otherUserId: individualUserId } : "skip") ?? [];
  const sendVersion = type === "team" ? "teamKey" : "asymmetric";

  // Decrypt messages
  const [decryptedMessages, setDecryptedMessages] = useState<
    Array<{
      _id: string;
      text: string;
      timestamp: number;
      isFromCurrentUser: boolean;
      senderName?: string;
      senderAvatar?: string;
      senderProfileUserId?: Id<"users">;
      status?: "sent" | "delivered" | "read";
      decryptionError?: boolean;
      encryptionVersion?: "symmetric" | "asymmetric" | "teamKey";
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
            // Server only lets authors migrate their own messages
            if (canEncrypt && !msg.encrypted && msg.isFromCurrentUser) {
              try {
                // Encrypt the message
                const encryptedText = await encryptMessage(msg.text, sendVersion);

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
    canEncrypt,
    sendVersion,
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
  ]);

  const handleSend = async (text: string) => {
    if (keyStatus === "needsLink") {
      toast.error("Link this browser to read and send encrypted messages");
      throw new Error("Encryption key locked");
    }
    try {
      // Encrypt message if encryption is available and ready
      const messageText = text;
      let encryptedText: string | undefined;

      if (canEncrypt) {
        try {
          // Use asymmetric encryption by default
          encryptedText = await encryptMessage(text, sendVersion);
        } catch {
          // Fallback to unencrypted if encryption fails
        }
      }

      if (type === "individual" && individualUserId) {
        await sendMessage({
          receiverId: individualUserId,
          ...(encryptedText ? { encryptedText, encryptionVersion: "asymmetric" as const } : { text: messageText }),
        });
      } else if (type === "team" && teamId) {
        await sendTeamMessage({
          teamId,
          ...(encryptedText ? { encryptedText, encryptionVersion: "teamKey" as const } : { text: messageText }),
        });
      }
      // Scroll to bottom after sending message
      setTimeout(() => {
        scrollToBottom();
      }, 200);
    } catch (error) {
      toast.error(extractErrorMessage(error));
      throw error;
    }
  };

  const keyChangeNotices = (after: number, upTo: number) =>
    keyChanges
      .filter((k) => k.changedAt > after && k.changedAt <= upTo)
      .map((k) => (
        <button
          key={`${k.userId}-${k.changedAt}`}
          type="button"
          onClick={() => setSecurityCodeOpen(true)}
          className="mx-auto w-fit rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300"
        >
          {k.userId === currentUserId ? "Your" : `${otherUser?.name ?? "Their"}'s`} security code changed. Tap
          to verify.
        </button>
      ));

  const displayName =
    type === "individual" && otherUser
      ? `${otherUser.name} ${otherUser.lastname}`
      : teamName || "Team Chat";

  useEffect(() => {
    setHeaderData({
      displayName,
      username: type === "individual" ? otherUser?.username : undefined,
      profileUserId:
        type === "individual" ? otherUser?._id : undefined,
      teamId: type === "team" ? teamId : undefined,
      teamIcon: type === "team" ? teamIcon : undefined,
      isTeam: type === "team",
    });

    return () => {
      clearHeaderData();
    };
  }, [
    clearHeaderData,
    displayName,
    otherUser?.username,
    otherUser?._id,
    setHeaderData,
    teamIcon,
    teamId,
    type,
  ]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
      {/* Messages - Scrollable */}

      <div ref={messagesContainerRef} className="relative min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-4 py-4 sm:px-5 dark:bg-zinc-950">
        {canEncrypt && type === "individual" && (
          <button
            type="button"
            onClick={() => setSecurityCodeOpen(true)}
            className="mx-auto mb-4 flex w-fit select-none items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
          >
            <Lock className="h-3 w-3" aria-hidden="true" />
            Messages are end-to-end encrypted. Tap to verify.
          </button>
        )}
        {canEncrypt && type === "team" && (
          <p className="mx-auto mb-4 flex w-fit select-none items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Messages are end-to-end encrypted
          </p>
        )}
        {type === "individual" && otherUser && currentUserId && (
          <SecurityCodeDialog
            open={securityCodeOpen}
            onOpenChange={setSecurityCodeOpen}
            contactName={otherUser.name}
            ownUserId={currentUserId}
            ownPublicKey={ownPublicKey}
            otherUserId={otherUser._id}
            otherPublicKeyJWK={otherPublicKeyJWK}
          />
        )}
        {isEncryptionAvailable && keyStatus === "needsLink" && (
          <ChatLinkPrompt
            linkCode={linkCode}
            linkFailed={linkFailed}
            onRetry={requestNewLink}
            onStartFresh={startFresh}
          />
        )}
        {!canEncrypt && encryptionError && (
          <p className="mx-auto mb-4 w-fit rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            Not encrypted yet: {encryptionError}
          </p>
        )}
        {messages.length === 0 ? (
          <div className="flex h-[80%] flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">No messages yet</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Say hi — or plan your next activity together.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {decryptedMessages.map((message, index) => (
              <Fragment key={message._id}>
              {/* None before the first message: the conversation hadn't started yet */}
              {index > 0 && keyChangeNotices(decryptedMessages[index - 1].timestamp, message.timestamp)}
              <MessageBubble
                text={message.text}
                timestamp={message.timestamp}
                isFromCurrentUser={message.isFromCurrentUser}
                senderName={message.senderName}
                senderAvatar={message.senderAvatar}
                senderProfileUserId={message.senderProfileUserId}
                showSenderName={type === "team"}
                status={message.status}
                previousTimestamp={
                  index > 0 ? decryptedMessages[index - 1].timestamp : undefined
                }
                decryptionError={message.decryptionError}
                messageType={message.messageType}
                reservationCardData={message.reservationCardData}
              />
              </Fragment>
            ))}
            {decryptedMessages.length > 0 &&
              keyChangeNotices(decryptedMessages[decryptedMessages.length - 1].timestamp, Infinity)}
            <div ref={messagesEndRef} />
          </div>
        )}


      </div>


      <div className="relative shrink-0">
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}
