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
      className={`${sticky ? "sticky top-(--app-navbar-height) z-40" : ""} border-b border-zinc-100 px-4 py-2 md:px-5 md:py-2.5 shrink-0 bg-white`}
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
          <h2 className="text-sm font-semibold truncate text-zinc-900">{displayName}</h2>
          {username ? (
            profileUserId ? (
              <Link
                href={`/profile/${profileUserId}`}
                className="block truncate text-xs text-zinc-400 underline-offset-2 hover:text-zinc-700 hover:underline"
              >
                @{username}
              </Link>
            ) : (
              <p className="truncate text-xs text-zinc-400">
                @{username}
              </p>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
