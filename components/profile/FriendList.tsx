"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Friends ({friends?.length ?? friendIds.length})</Label>
      {friends && friends.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {friends.map((friend) => (
            <Badge
              key={friend._id}
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => router.push(`/profile/${friend._id}`)}
            >
              @{friend.username}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No friends yet</p>
      )}
    </div>
  );
}

