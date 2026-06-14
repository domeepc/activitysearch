"use client";

import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus, Ban, Settings } from "lucide-react";
import Link from "next/link";

interface ProfileHeaderProps {
  isOwnProfile: boolean;
  userName: string;
  username: string;
  isFriend: boolean;
  isBlocked?: boolean;
  hasBlockedYou?: boolean;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  onDeleteAccount?: () => void;
  settingsUrl?: string;
}

export function ProfileHeader({
  isOwnProfile,
  userName,
  username,
  isFriend,
  isBlocked = false,
  hasBlockedYou = false,
  onAddFriend,
  onRemoveFriend,
  onBlock,
  onUnblock,
  settingsUrl,
}: ProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {isOwnProfile ? "My Profile" : userName}
        </h2>
        <p className="text-sm text-zinc-400 dark:text-zinc-500">@{username}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {isOwnProfile ? (
          settingsUrl && (
            <Button asChild size="sm" variant="outline" className="rounded-full border-zinc-200 dark:border-zinc-700">
              <Link href={settingsUrl}>
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Edit Profile
              </Link>
            </Button>
          )
        ) : isBlocked ? (
          <>
            {onUnblock && (
              <Button size="sm" variant="outline" onClick={onUnblock} className="rounded-full border-zinc-200 dark:border-zinc-700">
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                Unblock
              </Button>
            )}
            <Button size="sm" variant="outline" disabled className="rounded-full opacity-50">
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Blocked
            </Button>
          </>
        ) : isFriend ? (
          <>
            <Button size="sm" variant="outline" onClick={onRemoveFriend} className="rounded-full border-zinc-200 dark:border-zinc-700">
              <UserMinus className="mr-1.5 h-3.5 w-3.5" />
              Remove Friend
            </Button>
            {onBlock && (
              <Button size="sm" variant="destructive" onClick={onBlock} className="rounded-full">
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                Block
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              size="sm"
              onClick={onAddFriend}
              disabled={hasBlockedYou}
              className="rounded-full"
              title={hasBlockedYou ? "This user has blocked you" : "Add friend"}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Add Friend
            </Button>
            {onBlock && (
              <Button size="sm" variant="destructive" onClick={onBlock} className="rounded-full">
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                Block
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
