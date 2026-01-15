"use client";

import { Id } from "@/convex/_generated/dataModel";
import { usePresence } from "@/lib/hooks/usePresence";

interface ActiveStatusProps {
  userId: Id<"users">;
  lastActive?: number; // Fallback for historical data
}

interface StatusDotProps {
  userId?: Id<"users">;
  lastActive?: number; // Fallback for historical data
  className?: string;
}

export function StatusDot({ userId, lastActive, className = "" }: StatusDotProps) {
  // Use Ably presence if userId is provided, otherwise fallback to lastActive
  const { presence, isLoading } = usePresence(userId?.toString());
  
  // Determine if user is active
  // If presence is loading, don't show status yet
  // If presence exists and status is online, show green
  // Otherwise fallback to lastActive timestamp check
  const hasPresence = presence !== null && presence !== undefined;
  const isOnlineFromPresence = hasPresence && presence.status === "online";
  // Consider user active if they were active within the last 30 seconds
  const isActiveFromLastActive = lastActive ? Date.now() - lastActive < 30 * 1000 : false;
  
  // If loading takes too long, fall back to lastActive check
  // This prevents the dot from staying gray when Ably is slow to connect
  const isActive = isLoading && !lastActive
    ? false // Don't show status while loading if no lastActive fallback
    : isLoading && lastActive
    ? isActiveFromLastActive // Use lastActive while loading
    : hasPresence
    ? isOnlineFromPresence
    : isActiveFromLastActive;

  // Debug logging (remove in production)
  if (userId && typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log(`StatusDot for ${userId}:`, {
      isLoading,
      hasPresence,
      presence,
      presenceStatus: presence?.status,
      isOnlineFromPresence,
      isActiveFromLastActive,
      isActive,
      lastActive,
    });
  }

  // Force green color with inline style to ensure it shows
  const bgColor = isActive ? "#22c55e" : "#9ca3af"; // green-500 : gray-400

  return (
    <div
      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${className}`}
      style={{
        backgroundColor: bgColor,
        zIndex: 10, // Ensure it's above the avatar
      }}
      data-active={isActive}
      data-presence-status={presence?.status || "none"}
      data-is-loading={isLoading}
    />
  );
}

export function ActiveStatus({ userId, lastActive }: ActiveStatusProps) {
  // Use Ably presence for real-time status
  const { presence } = usePresence(userId.toString());
  
  // Determine if user is active (use Ably presence or fallback to lastActive)
  // Consider user active if they were active within the last 30 seconds
  const isActive = presence
    ? presence.status === "online" || (presence.lastSeen && Date.now() - presence.lastSeen < 30 * 1000)
    : lastActive
    ? Date.now() - lastActive < 30 * 1000
    : false;
  
  // Use presence lastSeen or fallback to lastActive
  const lastSeenTimestamp = presence?.lastSeen || lastActive;

  // Format last active time
  const formatLastActive = (timestamp?: number) => {
    if (!timestamp) return "Never";
    
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  };

  if (isActive) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span>Active now</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="h-2 w-2 rounded-full bg-gray-400" />
      <span>Last active {formatLastActive(lastSeenTimestamp)}</span>
    </div>
  );
}
