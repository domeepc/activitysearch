"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { Search, Ban, UserPlus } from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingId, setPendingId] = useState<Id<"users"> | null>(null);
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
    setPendingId(userId);
    try {
      await addFriend({ friendId: userId });
      toast.success("Friend added");
      setSearchQuery("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add friend");
    } finally {
      setPendingId(null);
    }
  };

  const query = searchQuery.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearchQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a friend</DialogTitle>
          <DialogDescription>Find people by name or username.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <Input
            aria-label="Search people"
            placeholder="Search by name or @username"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 bg-zinc-50 pl-10 dark:bg-zinc-800/60"
            autoFocus
          />
        </div>
        <div className="-mx-2 min-h-[160px]">
          {query.length < 2 ? (
            <EmptyState icon={<UserPlus className="size-5" />} text="Type at least 2 characters to search" />
          ) : searchResults === undefined ? (
            <div className="flex justify-center py-10">
              <Spinner className="size-5 text-zinc-400" />
            </div>
          ) : availableUsers.length === 0 ? (
            <EmptyState icon={<Search className="size-5" />} text={`No one new matches “${query}”`} />
          ) : (
            <ul className="flex max-h-72 flex-col overflow-y-auto">
              {availableUsers.map((user) => {
                const blocked = user.isBlocked || user.hasBlockedYou;
                return (
                  <li key={user._id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                    <Link href={`/profile/${user._id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Avatar className="size-10">
                        <AvatarImage src={user.avatar} alt="" />
                        <AvatarFallback name={`${user.name} ${user.lastname}`} />
                      </Avatar>
                      <span className="min-w-0">
                        <b className="block truncate text-sm font-semibold">
                          {user.name} {user.lastname}
                        </b>
                        <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">
                          {user.isBlocked ? "Blocked" : user.hasBlockedYou ? "Unavailable" : `@${user.username}`}
                        </span>
                      </span>
                    </Link>
                    {blocked ? (
                      <Ban className="size-4 text-zinc-400" aria-label="Can't add" />
                    ) : (
                      <Button
                        size="sm"
                        className="bg-blue-600 text-white hover:bg-blue-700"
                        disabled={pendingId === user._id}
                        onClick={() => handleAddFriend(user._id)}
                      >
                        {pendingId === user._id ? "Adding…" : "Add"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
        {icon}
      </span>
      {text}
    </div>
  );
}
