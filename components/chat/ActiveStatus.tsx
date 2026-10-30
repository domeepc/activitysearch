"use client";

import { Id } from "@/convex/_generated/dataModel";
import { usePresence } from "@/lib/hooks/usePresence";

interface StatusDotProps {
  userId?: Id<"users">;
  className?: string;
}

export function StatusDot({ userId, className = "" }: StatusDotProps) {
  const { presence } = usePresence(userId);
  const isActive = presence?.status === "online";

  return (
    <div
      className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-white dark:border-zinc-950 ${
        isActive ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"
      } ${className}`}
    />
  );
}

function formatLastSeen(timestamp: number | null | undefined, now: number) {
  if (!timestamp) return "Never";

  const minutes = Math.floor((now - timestamp) / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function ActiveStatus({ userId }: { userId: Id<"users"> }) {
  const { presence, now } = usePresence(userId);

  if (presence?.status === "online") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="size-2 rounded-full bg-green-500" />
        <span>Active now</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="size-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
      <span>Last active {formatLastSeen(presence?.lastSeen, now)}</span>
    </div>
  );
}
