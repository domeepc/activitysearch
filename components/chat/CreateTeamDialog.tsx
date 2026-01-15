"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

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
    if (!teamName.trim()) return;

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
      console.error("Failed to create team:", error);
      alert(error instanceof Error ? error.message : "Failed to create team");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Create a group chat with your friends
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="teamName">Team Name</Label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teamDescription">Description (optional)</Label>
            <Textarea
              id="teamDescription"
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              placeholder="Enter team description"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Select Friends</Label>
            {friends === undefined ? (
              <p className="text-sm text-muted-foreground">Loading friends...</p>
            ) : friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You don't have any friends yet. Add friends to create a team.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
                {friends.map((friend) => (
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!teamName.trim()}>
            Create Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
