"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ReservationCard } from "@/components/reservations/ReservationCard";
import { Id } from "@/convex/_generated/dataModel";

import { Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  text: string;
  timestamp: number;
  isFromCurrentUser: boolean;
  senderName?: string;
  senderAvatar?: string;
  /** Team chat: link avatar + name to this user profile. */
  senderProfileUserId?: Id<"users">;
  showSenderName?: boolean;
  status?: "sent" | "delivered" | "read";
  previousTimestamp?: number;
  isEncrypted?: boolean;
  decryptionError?: boolean;
  messageType?: "text" | "reservation_card";
  reservationCardData?: {
    reservationId: Id<"reservations">;
  };
}

function formatTimeAgo(timestamp: number): string {
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
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    // Otherwise show date and time
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function senderProfileHref(userId: Id<"users">) {
  return `/profile/${userId}`;
}

function SenderAvatar({ name, avatar, href }: { name?: string; avatar?: string; href: string | null }) {
  const avatarEl = (
    <Avatar className="size-7">
      <AvatarImage src={avatar} alt={name} />
      <AvatarFallback className="text-xs font-bold">
        {name
          ?.split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "?"}
      </AvatarFallback>
    </Avatar>
  );
  if (!href) return <span className="shrink-0">{avatarEl}</span>;
  return (
    <Link
      href={href}
      className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`View ${name ?? "profile"}`}
    >
      {avatarEl}
    </Link>
  );
}

function DateDivider({ timestamp }: { timestamp: number }) {
  return (
    <div className="my-2 flex select-none justify-center">
      <span className="rounded-full bg-zinc-200/70 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        {new Date(timestamp).toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </span>
    </div>
  );
}

export function MessageBubble({
  text,
  timestamp,
  isFromCurrentUser,
  senderName,
  senderAvatar,
  senderProfileUserId,
  showSenderName = false,
  status,
  previousTimestamp,
  decryptionError,
  messageType = "text",
  reservationCardData,
}: MessageBubbleProps) {
  const timeAgo = formatTimeAgo(timestamp);
  const profileHref =
    !isFromCurrentUser && showSenderName && senderProfileUserId
      ? senderProfileHref(senderProfileUserId)
      : null;

  // Show date divider if this message is more than 30 minutes after previous
  const showDateDivider = previousTimestamp
    ? timestamp - previousTimestamp > 30 * 60 * 1000
    : true;

  if (messageType === "reservation_card" && reservationCardData) {
    const who = isFromCurrentUser ? "You" : senderName?.split(" ")[0] || "Someone";
    return (
      <>
        {showDateDivider && <DateDivider timestamp={timestamp} />}
        <div className="flex flex-col items-center gap-2 py-1 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {who} reserved an activity for the team · {timeAgo}
          </span>
          <ReservationCard reservationId={reservationCardData.reservationId} />
        </div>
      </>
    );
  }

  const showMeta = !isFromCurrentUser && showSenderName;

  return (
    <>
      {showDateDivider && <DateDivider timestamp={timestamp} />}
      <div
        className={cn(
          "flex max-w-[85%] items-end gap-2 sm:max-w-[70%] animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
          isFromCurrentUser ? "flex-row-reverse self-end" : "self-start"
        )}
      >
        {showMeta && <SenderAvatar name={senderName} avatar={senderAvatar} href={profileHref} />}
        <div className={cn("flex min-w-0 flex-col gap-1", isFromCurrentUser ? "items-end" : "items-start")}>
          {showMeta && senderName ? (
            profileHref ? (
              <Link
                href={profileHref}
                className="px-1 text-xs text-zinc-600 underline-offset-2 hover:text-foreground hover:underline dark:text-zinc-400"
              >
                {senderName}
              </Link>
            ) : (
              <span className="px-1 text-xs text-zinc-600 dark:text-zinc-400">{senderName}</span>
            )
          ) : null}
          <div
            className={cn(
              "rounded-2xl px-4 py-3",
              isFromCurrentUser
                ? "rounded-br-md bg-blue-600 text-white"
                : "rounded-bl-md border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50",
              decryptionError && "opacity-75"
            )}
          >
            <p
              className={cn(
                "whitespace-pre-wrap text-sm leading-relaxed wrap-break-word",
                decryptionError && "italic text-muted-foreground"
              )}
            >
              {text}
            </p>
          </div>
          <div className="flex items-center gap-1 px-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span>{timeAgo}</span>
            {isFromCurrentUser && status && (
              <>
                <span aria-hidden="true">·</span>
                {status === "read" ? (
                  <CheckCheck className="size-3 text-blue-600 dark:text-blue-400" aria-label="Read" />
                ) : status === "delivered" ? (
                  <CheckCheck className="size-3" aria-label="Delivered" />
                ) : (
                  <Check className="size-3" aria-label="Sent" />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
