"use client";

import { Id } from "@/convex/_generated/dataModel";

interface ActiveStatusProps {
  userId: Id<"users">;
  lastActive?: number;
}

interface StatusDotProps {
  lastActive?: number;
  className?: string;
}

export function StatusDot({ lastActive, className = "" }: StatusDotProps) {
  // Consider user active if lastActive is within last 2 minutes
  const isActive = lastActive
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
  // Consider user active if lastActive is within last 2 minutes
  const isActive = lastActive
    ? Date.now() - lastActive < 2 * 60 * 1000
    : false;

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
      <span>Last active {formatLastActive(lastActive)}</span>
    </div>
  );
}
