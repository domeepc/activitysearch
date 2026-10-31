"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery as useConvexQuery } from "convex/react";
import { toast } from "sonner";

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
  const [submitting, setSubmitting] = useState(false);
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
    if (selectedFriends.size === 0 || !team || submitting) return;
    setSubmitting(true);
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
      toast.error(error instanceof Error ? error.message : "Failed to invite friends");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {currentTeam?.teamName ?? "team"}</DialogTitle>
          <DialogDescription>Friends you pick are added to the chat straight away.</DialogDescription>
        </DialogHeader>
        {currentTeam && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {currentTeam.teammates.slice(0, 5).map((teammate) => (
                <Avatar key={teammate._id} className="size-7 border-2 border-white dark:border-zinc-900">
                  <AvatarImage src={teammate.avatar} alt="" />
                  <AvatarFallback className="text-[10px] font-bold">
                    {teammate.name[0]}
                    {teammate.lastname[0]}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {currentTeam.teammates.length} in the team now
            </span>
          </div>
        )}
        {availableFriends.length === 0 ? (
          <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
            Everyone you&apos;re friends with is already here. Add more friends from the Messages list.
          </p>
        ) : (
          <ul className="-mx-2 flex max-h-72 flex-col overflow-y-auto">
            {availableFriends.map((friend) => (
              <li key={friend._id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                  <Avatar className="size-9">
                    <AvatarImage src={friend.avatar} alt="" />
                    <AvatarFallback className="text-xs font-bold">
                      {friend.name[0]}
                      {friend.lastname[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm font-semibold">
                      {friend.name} {friend.lastname}
                    </b>
                    <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">@{friend.username}</span>
                  </span>
                  <Checkbox
                    checked={selectedFriends.has(friend._id)}
                    onCheckedChange={() => handleToggleFriend(friend._id)}
                    aria-label={`Invite ${friend.name}`}
                    className="size-5 rounded-md"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
        <Button
          onClick={handleInvite}
          disabled={selectedFriends.size === 0 || submitting}
          className="h-11 bg-blue-600 font-semibold text-white hover:bg-blue-700"
        >
          {submitting
            ? "Inviting…"
            : selectedFriends.size > 0
              ? `Invite ${selectedFriends.size} ${selectedFriends.size === 1 ? "friend" : "friends"}`
              : "Pick friends to invite"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
