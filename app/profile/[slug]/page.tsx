"use client";

import { useEffect, use } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileView } from "@/components/profile/ProfileView";
import { RemoveFriendDialog } from "@/components/profile/dialogs/RemoveFriendDialog";
import { ConfirmDialog } from "@/components/chat/ConfirmDialog";
import { useState } from "react";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);

  const user = useQuery(api.users.getUserBySlug, {
    slug: resolvedParams.slug,
  });
  const currentUser = useQuery(api.users.current);
  const addFriend = useMutation(api.users.addFriend);
  const removeFriend = useMutation(api.users.removeFriend);
  const blockUser = useMutation(api.users.blockUser);
  const unblockUser = useMutation(api.users.unblockUser);
  const friends = useQuery(
    api.users.getUsersByIds,
    user?.friends && user.friends.length > 0
      ? { userIds: user.friends }
      : "skip"
  );
  const blockedUsers = useQuery(
    api.users.getBlockedUsers,
    currentUser?._id === user?._id ? {} : "skip"
  );

  // Redirect to sign-in if not authenticated or user not found
  useEffect(() => {
    if (currentUser === null || user === null) {
      window.location.replace("/sign-in");
    }
  }, [currentUser, user]);

  const handleAddFriend = async () => {
    if (!user?._id) return;
    try {
      await addFriend({ friendId: user._id });
    } catch (error) {
      console.error("Failed to add friend:", error);
    }
  };

  const handleRemoveFriend = async () => {
    if (!user?._id) return;
    try {
      await removeFriend({ friendId: user._id });
      setShowRemoveDialog(false);
    } catch (error) {
      console.error("Failed to remove friend:", error);
    }
  };

  const handleBlock = async () => {
    if (!user?._id) return;
    try {
      await blockUser({ userId: user._id });
      setShowBlockDialog(false);
    } catch (error) {
      console.error("Failed to block user:", error);
      alert(
        error instanceof Error ? error.message : "Failed to block user"
      );
    }
  };

  const handleUnblock = async () => {
    if (!user?._id) return;
    try {
      await unblockUser({ userId: user._id });
    } catch (error) {
      console.error("Failed to unblock user:", error);
      alert(
        error instanceof Error ? error.message : "Failed to unblock user"
      );
    }
  };

  // Loading state
  if (user === undefined || currentUser === undefined) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Skeleton className="h-32 w-32 rounded-full" />
            </div>
            <div className="grid gap-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not found state
  if (user === null || currentUser === null) {
    return null; // useEffect will handle redirect
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <ProfileView
        user={user}
        currentUser={currentUser}
        friends={friends}
        isLoading={false}
        onAddFriend={handleAddFriend}
        onRemoveFriend={() => setShowRemoveDialog(true)}
        onBlock={() => setShowBlockDialog(true)}
        onUnblock={handleUnblock}
        blockedUsers={blockedUsers?.map((u) => ({
          _id: u._id,
          name: u.name,
          lastname: u.lastname,
          username: u.username,
          slug: u.slug,
          avatar: u.avatar,
        }))}
      />

      <RemoveFriendDialog
        open={showRemoveDialog}
        onOpenChange={setShowRemoveDialog}
        onConfirm={handleRemoveFriend}
        friendName={user.name}
        friendLastname={user.lastname}
      />

      <ConfirmDialog
        open={showBlockDialog}
        onOpenChange={setShowBlockDialog}
        title="Block User"
        description={`Are you sure you want to block ${user.name} ${user.lastname}? They will be removed from your friends list and you won't be able to message each other.`}
        confirmText="Block"
        variant="destructive"
        onConfirm={handleBlock}
      />
    </div>
  );
}
