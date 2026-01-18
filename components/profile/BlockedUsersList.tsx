"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";

interface BlockedUsersListProps {
  blockedUsers?: Array<{
    _id: Id<"users">;
    name: string;
    lastname: string;
    username: string;
    slug: string;
    avatar: string;
  }>;
  isLoading?: boolean;
}

export function BlockedUsersList({
  blockedUsers,
  isLoading = false,
}: BlockedUsersListProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Blocked Users</Label>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!blockedUsers || blockedUsers.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Blocked Users</Label>
        <div className="text-sm text-muted-foreground">
          No blocked users
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Blocked Users ({blockedUsers.length})</Label>
      <div className="space-y-2">
        {blockedUsers.map((user) => (
          <div
            key={user._id.toString()}
            onClick={() => router.push(`/profile/${user.slug}`)}
            className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>
                {user.name[0]}
                {user.lastname[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.name} {user.lastname}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{user.username}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
