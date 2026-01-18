"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Ban } from "lucide-react";

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddFriendDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddFriendDialogProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const addFriend = useMutation(api.users.addFriend);
  const currentUser = useQuery(api.users.current);

  // Search for users
  const searchResults = useQuery(
    api.users.searchUsers,
    searchQuery.trim().length >= 2 ? { query: searchQuery } : "skip"
  );

  // Get current user's friends to filter out already-friended users
  const friends = useQuery(
    api.users.getUsersByIds,
    currentUser?.friends && currentUser.friends.length > 0
      ? { userIds: currentUser.friends }
      : "skip"
  );

  // Memoize friendIds to prevent unnecessary re-renders
  const friendIds = useMemo(
    () => new Set(friends?.map((f) => f._id.toString()) || []),
    [friends]
  );

  // Filter out users who are already friends
  // Keep blocked users in the list but mark them as blocked (isBlocked comes from searchResults)
  const availableUsers = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.filter((user) => !friendIds.has(user._id.toString()));
  }, [searchResults, friendIds]);

  const handleAddFriend = async (userId: Id<"users">) => {
    try {
      await addFriend({ friendId: userId });
      setSearchQuery("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add friend:", error);
      alert(error instanceof Error ? error.message : "Failed to add friend");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
          <DialogDescription>
            Search for users by name or username to add as a friend
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Search Users</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-2">
            {searchQuery.trim().length < 2 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Type at least 2 characters to search
              </p>
            ) : searchResults === undefined ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Searching...
              </p>
            ) : availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No users found or all results are already your friends
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
                {availableUsers.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => router.push(`/profile/${user.slug}`)}
                    className="flex items-center gap-3 p-2 hover:bg-accent rounded-md cursor-pointer"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>
                        {user.name[0]}
                        {user.lastname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {user.name} {user.lastname}
                        </p>
                        {user.isBlocked && (
                          <Badge variant="destructive" className="text-xs">
                            <Ban className="h-3 w-3 mr-1" />
                            Blocked
                          </Badge>
                        )}
                        {user.hasBlockedYou && (
                          <Badge variant="destructive" className="text-xs">
                            <Ban className="h-3 w-3 mr-1" />
                            Blocked You
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        @{user.username}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddFriend(user._id);
                      }}
                      disabled={user.isBlocked || user.hasBlockedYou}
                      title={
                        user.isBlocked
                          ? "Cannot add blocked user. Unblock them first."
                          : user.hasBlockedYou
                          ? "This user has blocked you"
                          : "Add friend"
                      }
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
