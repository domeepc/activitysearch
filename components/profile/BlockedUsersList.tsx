"use client";

import { FriendList } from "./FriendList";
import { Id } from "@/convex/_generated/dataModel";

interface BlockedUsersListProps {
  blockedUsers?: Array<{
    _id: Id<"users">;
    name: string;
    lastname: string;
    username: string;
    avatar: string;
  }>;
}

export function BlockedUsersList({ blockedUsers }: BlockedUsersListProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Blocked people can&apos;t message you or add you to teams. Open a profile to unblock.
      </p>
      <FriendList
        friends={blockedUsers}
        friendIds={blockedUsers?.map((u) => u._id) ?? []}
        emptyText="You haven't blocked anyone."
      />
    </div>
  );
}
