"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/chat/ActiveStatus";
import { Id } from "@/convex/_generated/dataModel";

export interface ProfileFriend {
  _id: Id<"users">;
  username: string;
  name?: string;
  lastname?: string;
  avatar?: string;
}

interface FriendListProps {
  friends: ProfileFriend[] | undefined;
  friendIds: Id<"users">[];
  emptyText?: string;
  showPresence?: boolean;
}

export function FriendList({ friends, friendIds, emptyText = "No friends yet", showPresence = false }: FriendListProps) {
  if (friends === undefined && friendIds.length > 0) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!friends || friends.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-600 dark:text-zinc-400">{emptyText}</p>;
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {friends.map((friend) => {
        const fullName = [friend.name, friend.lastname].filter(Boolean).join(" ") || `@${friend.username}`;
        return (
          <li key={friend._id}>
            <Link
              href={`/profile/${friend._id}`}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
            >
              <span className="relative shrink-0">
                <Avatar className="size-10">
                  <AvatarImage src={friend.avatar} alt="" />
                  <AvatarFallback name={fullName} />
                </Avatar>
                {showPresence && <StatusDot userId={friend._id} />}
              </span>
              <span className="min-w-0">
                <b className="block truncate text-sm font-semibold">{fullName}</b>
                <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">@{friend.username}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
