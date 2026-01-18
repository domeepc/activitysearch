"use client";

import { useEffect, use } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileView } from "@/components/profile/ProfileView";
import { RemoveFriendDialog } from "@/components/profile/dialogs/RemoveFriendDialog";
import { ConfirmDialog } from "@/components/chat/ConfirmDialog";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Convex document IDs are 32 base-32 chars; treat other segments as username
function looksLikeConvexId(s: string): boolean {
  return /^[a-z0-9]{32}$/.test(s);
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);

  const byId = useQuery(
    api.users.getUserById,
    looksLikeConvexId(resolvedParams.userId)
      ? { userId: resolvedParams.userId as Id<"users"> }
      : "skip"
  );
  const byUsername = useQuery(
    api.users.getUserByUsername,
    !looksLikeConvexId(resolvedParams.userId)
      ? { username: resolvedParams.userId }
      : "skip"
  );
  const user = byId ?? byUsername;
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.current);
  const addFriend = useMutation(api.users.addFriend);
  const removeFriend = useMutation(api.users.removeFriend);
  const blockUser = useMutation(api.users.blockUser);
  const unblockUser = useMutation(api.users.unblockUser);
  const friends = useQuery(
    api.users.getUsersByIds,
    currentUser && user?.friends && user.friends.length > 0
      ? { userIds: user.friends }
      : "skip"
  );
  const blockedUsers = useQuery(
    api.users.getBlockedUsers,
    isAuthenticated && currentUser?._id === user?._id ? {} : "skip"
  );

  // Redirect to sign-in if not authenticated or user not found
  useEffect(() => {
    if (currentUser === null || user === null) {
      window.location.replace("/sign-in");
    }
  }, [currentUser, user]);

  // Canonicalize URL when resolved by username (e.g. /profile/domepc -> /profile/<id>)
  useEffect(() => {
    if (user && resolvedParams.userId !== user._id) {
      router.replace(`/profile/${user._id}`);
    }
  }, [user, resolvedParams.userId, router]);

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
        <Card className="border-border border-2 shadow-xl">
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

  // Check if the user has blocked the current user
  const hasBlockedYou = user.blocked?.includes(currentUser._id) ?? false;

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
        hasBlockedYou={hasBlockedYou}
        blockedUsers={blockedUsers?.map((u) => ({
          _id: u._id,
          name: u.name,
          lastname: u.lastname,
          username: u.username,
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
