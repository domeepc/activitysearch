"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateTeamDialogProps) {
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Set<Id<"users">>>(
    new Set()
  );
  const [submitting, setSubmitting] = useState(false);
  const createTeam = useMutation(api.teams.createTeam);
  const currentUser = useQuery(api.users.current);

  const friends = useQuery(
    api.users.getUsersByIds,
    currentUser?.friends && currentUser.friends.length > 0
      ? { userIds: currentUser.friends }
      : "skip"
  );

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

  const handleSubmit = async () => {
    if (!teamName.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createTeam({
        teamName: teamName.trim(),
        teamDescription: teamDescription.trim() || undefined,
        friendIds: Array.from(selectedFriends),
      });
      setTeamName("");
      setTeamDescription("");
      setSelectedFriends(new Set());
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create team");
    } finally {
      setSubmitting(false);
    }
  };

  const hasFriendIds = (currentUser?.friends?.length ?? 0) > 0;
  const friendsLoading =
    currentUser === undefined || (hasFriendIds && friends === undefined);
  const count = selectedFriends.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New team</DialogTitle>
          <DialogDescription>
            A team is a group chat you can reserve activities for and split the cost.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="teamName">Team name</Label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Weekend Crew"
              className="h-11"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="teamDescription">
              Description <span className="font-normal text-zinc-500">(optional)</span>
            </Label>
            <Textarea
              id="teamDescription"
              className="resize-none"
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              placeholder="What's this team for?"
              rows={2}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 flex w-full justify-between text-sm font-medium">
              Add friends
              {count > 0 && <span className="font-normal text-zinc-600 dark:text-zinc-400">{count} selected</span>}
            </legend>
            {friendsLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                <Spinner className="size-4" /> Loading friends…
              </div>
            ) : !hasFriendIds ? (
              <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
                You haven&apos;t added any friends yet. You can create the team now and invite people later.
              </p>
            ) : (
              <ul className="-mx-2 flex max-h-56 flex-col overflow-y-auto">
                {(friends ?? []).map((friend) => {
                  const checked = selectedFriends.has(friend._id);
                  return (
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
                          checked={checked}
                          onCheckedChange={() => handleToggleFriend(friend._id)}
                          aria-label={`Add ${friend.name}`}
                          className="size-5 rounded-md"
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
          <Button
            type="submit"
            disabled={!teamName.trim() || submitting}
            className="h-11 bg-blue-600 font-semibold text-white hover:bg-blue-700"
          >
            {submitting ? "Creating…" : count > 0 ? `Create team · ${count + 1} people` : "Create team"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
