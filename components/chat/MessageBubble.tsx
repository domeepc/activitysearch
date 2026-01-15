"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  text: string;
  timestamp: number;
  isFromCurrentUser: boolean;
  senderName?: string;
  senderAvatar?: string;
  showSenderName?: boolean;
  status?: "sent" | "delivered" | "read";
  previousTimestamp?: number;
}

function formatTimeAgo(timestamp: number, previousTimestamp?: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // If message is older than 30 minutes, show date and time
  if (minutes > 30) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    // Otherwise show date and time
    return date.toLocaleString([], { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

export function MessageBubble({
  text,
  timestamp,
  isFromCurrentUser,
  senderName,
  senderAvatar,
  showSenderName = false,
  status,
  previousTimestamp,
}: MessageBubbleProps) {
  const timeAgo = formatTimeAgo(timestamp, previousTimestamp);
  
  // Show date divider if this message is more than 30 minutes after previous
  const showDateDivider = previousTimestamp 
    ? (timestamp - previousTimestamp) > 30 * 60 * 1000
    : true; // Show for first message

  return (
    <>
      {showDateDivider && (
        <div className="flex items-center justify-center my-4">
          <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {new Date(timestamp).toLocaleDateString([], { 
              weekday: 'long',
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>
      )}
      <div
        className={cn(
          "flex gap-2 mb-4",
          isFromCurrentUser ? "flex-row-reverse" : "flex-row"
        )}
      >
      {!isFromCurrentUser && showSenderName && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={senderAvatar} alt={senderName} />
          <AvatarFallback>
            {senderName
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "flex flex-col max-w-[70%]",
          isFromCurrentUser ? "items-end" : "items-start"
        )}
      >
        {!isFromCurrentUser && showSenderName && senderName && (
          <span className="text-xs text-muted-foreground mb-1 px-2">
            {senderName}
          </span>
        )}
        <div
          className={cn(
            "rounded-lg px-4 py-2",
            isFromCurrentUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          <p className="text-sm whitespace-pre-wrap wrap-break-word">{text}</p>
        </div>
        <div className="flex items-center gap-1 mt-1 px-2">
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          {isFromCurrentUser && status && (
            <span className="text-muted-foreground">
              {status === "read" ? (
                <CheckCheck className="h-3 w-3 text-primary" />
              ) : status === "delivered" ? (
                <CheckCheck className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
