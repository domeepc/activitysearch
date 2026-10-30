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
      className={`${sticky ? "sticky top-(--app-navbar-height) z-40" : ""} border-b border-border px-3 py-2.5 md:px-5 md:py-3 shrink-0 bg-white dark:bg-zinc-900`}
    >
      <div className="flex items-center gap-2 md:gap-3">
        {/* Back button - only visible on mobile */}
        {isMobile && (
          <button
            onClick={handleBack}
            className="md:hidden flex size-10 items-center justify-center hover:bg-muted rounded-xl transition-colors"
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
        <div className="min-w-0">
          <h2 className="text-[15px] md:text-base font-semibold truncate text-zinc-900 dark:text-zinc-50">{displayName}</h2>
          {username ? (
            profileUserId ? (
              <Link
                href={`/profile/${profileUserId}`}
                className="block truncate text-[11px] md:text-sm text-muted-foreground underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300 hover:underline"
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
