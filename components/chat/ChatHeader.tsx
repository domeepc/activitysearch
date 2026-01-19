"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TeamIconSection } from "./TeamIconSection";
import { Id } from "@/convex/_generated/dataModel";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

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
  const router = useRouter();
  const isMobile = useIsMobile();

  const handleBack = () => {
    router.push("/chat");
  };

  return (
    <div className="border-y border-gray-300 p-2 md:p-4 shrink-0 bg-background">
      <div className="flex items-center gap-2 md:gap-3">
        {/* Back button - only visible on mobile */}
        {isMobile && (
          <button
            onClick={handleBack}
            className="md:hidden p-1 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {isTeam && teamId && (
          <TeamIconSection
            teamId={teamId}
            currentIcon={teamIcon}
            teamName={displayName}
          />
        )}
        <div>
          <h2 className="text-base md:text-lg font-semibold">{displayName}</h2>
          {username && (
            <p className="text-xs md:text-sm text-muted-foreground">@{username}</p>
          )}
        </div>
      </div>
    </div>
  );
}
