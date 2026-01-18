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
    <div className="border-y border-gray-300 p-4 shrink-0 bg-background">
      <div className="flex items-center gap-3">
        {/* Back button - only visible on mobile */}
        {isMobile && (
          <button
            onClick={handleBack}
            className="md:hidden p-1 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
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
          <h2 className="text-lg font-semibold">{displayName}</h2>
          {username && (
            <p className="text-sm text-muted-foreground">@{username}</p>
          )}
        </div>
      </div>
    </div>
  );
}
