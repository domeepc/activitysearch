"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TeamIconSection } from "./TeamIconSection";
import { Id } from "@/convex/_generated/dataModel";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

interface ChatHeaderProps {
  displayName: string;
  username?: string;
  profileUserId?: Id<"users">;
  teamId?: Id<"teams">;
  teamIcon?: string;
  isTeam?: boolean;
  sticky?: boolean;
}

export function ChatHeader({
  displayName,
  username,
  profileUserId,
  teamId,
  teamIcon,
  isTeam = false,
  sticky = true,
}: ChatHeaderProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const handleBack = () => {
    router.push("/chat");
  };

  return (
    <div
      className={`${sticky ? "sticky top-(--app-navbar-height) z-40" : ""} border-b border-border px-4 py-1.5 md:px-8 md:py-4 shrink-0 bg-background`}
    >
      <div className="flex items-center gap-2 md:gap-3">
        {/* Back button - only visible on mobile */}
        {isMobile && (
          <button
            onClick={handleBack}
            className="md:hidden p-1 hover:bg-muted rounded-full transition-colors"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        )}
        {isTeam && teamId && (
          <TeamIconSection
            teamId={teamId}
            currentIcon={teamIcon}
            teamName={displayName}
          />
        )}
        <div className="min-w-0">
          <h2 className="text-sm md:text-lg font-semibold truncate">{displayName}</h2>
          {username ? (
            profileUserId ? (
              <Link
                href={`/profile/${profileUserId}`}
                className="block truncate text-[11px] md:text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                @{username}
              </Link>
            ) : (
              <p className="truncate text-[11px] md:text-sm text-muted-foreground">
                @{username}
              </p>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
