"use client";

import { TeamIconSection } from "./TeamIconSection";
import { Id } from "@/convex/_generated/dataModel";

interface ChatHeaderProps {
  displayName: string;
  username?: string;
  teamId?: Id<"teams">;
  teamIcon?: string;
  isTeam?: boolean;
}

export function ChatHeader({
  displayName,
  username,
  teamId,
  teamIcon,
  isTeam = false,
}: ChatHeaderProps) {
  return (
    <div className="border-b p-4 shrink-0 bg-background">
      <div className="flex items-center gap-3">
        {isTeam && teamId && (
          <TeamIconSection
            teamId={teamId}
            currentIcon={teamIcon}
            teamName={displayName}
          />
        )}
        <div>
          <h2 className="text-lg font-semibold">{displayName}</h2>
          {username && (
            <p className="text-sm text-muted-foreground">@{username}</p>
          )}
        </div>
      </div>
    </div>
  );
}
