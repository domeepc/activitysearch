"use client";

import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Id } from "@/convex/_generated/dataModel";

interface Friend {
  _id: Id<"users">;
  username: string;
}

interface FriendListProps {
  friends: Friend[] | undefined;
  friendIds: Id<"users">[];
  isLoading?: boolean;
}

export function FriendList({
  friends,
  friendIds,
  isLoading = false,
}: FriendListProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>
    );
  }

  const count = friends?.length ?? friendIds.length;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Friends ({count})
      </p>
      {friends && friends.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {friends.map((friend) => (
            <button
              key={friend._id}
              onClick={() => router.push(`/profile/${friend._id}`)}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              @{friend.username}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">No friends yet</p>
      )}
    </div>
  );
}
