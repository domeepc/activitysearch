"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery as useConvexQuery } from "convex/react";

interface TeamInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamSlug: string;
  onSuccess?: () => void;
}

export function TeamInviteDialog({
  open,
  onOpenChange,
  teamSlug,
  onSuccess,
}: TeamInviteDialogProps) {
  const [selectedFriends, setSelectedFriends] = useState<Set<Id<"users">>>(
    new Set()
  );
  const inviteFriend = useMutation(api.teams.inviteFriendToTeam);
  const currentUser = useConvexQuery(api.users.current);
  const team = useConvexQuery(api.teams.getTeamBySlug, { slug: teamSlug });

  const currentTeam = team;

  const friends = useConvexQuery(
    api.users.getUsersByIds,
    currentUser?.friends && currentUser.friends.length > 0
      ? { userIds: currentUser.friends }
      : "skip"
  );

  // Filter out friends who are already in the team
  const availableFriends =
    friends?.filter(
      (friend) => !currentTeam?.teammates.some((t) => t._id === friend._id)
    ) || [];

  const handleToggleFriend = (friendId: Id<"users">) => {
    setSelectedFriends((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const handleInvite = async () => {
    if (selectedFriends.size === 0 || !team) return;

    try {
      await Promise.all(
        Array.from(selectedFriends).map((friendId) =>
          inviteFriend({ teamId: team._id, friendId })
        )
      );
      setSelectedFriends(new Set());
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to invite friends:", error);
      alert(
        error instanceof Error ? error.message : "Failed to invite friends"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Friends to Team</DialogTitle>
          <DialogDescription>
            Select friends to add to this team
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {currentTeam && (
            <div className="space-y-2">
              <Label>Current Members</Label>
              <div className="flex flex-wrap gap-2">
                {currentTeam.teammates.map((teammate) => (
                  <div
                    key={teammate._id}
                    className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={teammate.avatar} alt={teammate.name} />
                      <AvatarFallback>
                        {teammate.name[0]}
                        {teammate.lastname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {teammate.name} {teammate.lastname}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Select Friends to Invite</Label>
            {availableFriends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All your friends are already in this team, or you don&apos;t
                have any friends yet.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
                {availableFriends.map((friend) => (
                  <div
                    key={friend._id}
                    className="flex items-center gap-3 p-2 hover:bg-accent rounded-md cursor-pointer"
                    onClick={() => handleToggleFriend(friend._id)}
                  >
                    <Checkbox
                      checked={selectedFriends.has(friend._id)}
                      onCheckedChange={() => handleToggleFriend(friend._id)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={friend.avatar} alt={friend.name} />
                      <AvatarFallback>
                        {friend.name[0]}
                        {friend.lastname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {friend.name} {friend.lastname}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{friend.username}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={selectedFriends.size === 0}>
            Invite {selectedFriends.size > 0 && `(${selectedFriends.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
