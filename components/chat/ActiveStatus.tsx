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
  const { presence } = usePresence(userId?.toString());
  
  // Determine if user is active
  const isActive = presence
    ? presence.status === "online"
    : lastActive
    ? Date.now() - lastActive < 2 * 60 * 1000
    : false;

  return (
    <div
      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
        isActive ? "bg-green-500" : "bg-gray-400"
      } ${className}`}
    />
  );
}

export function ActiveStatus({ userId, lastActive }: ActiveStatusProps) {
  // Use Ably presence for real-time status
  const { presence } = usePresence(userId.toString());
  
  // Determine if user is active (use Ably presence or fallback to lastActive)
  const isActive = presence
    ? presence.status === "online"
    : lastActive
    ? Date.now() - lastActive < 2 * 60 * 1000
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
