"use client";

import { useEffect, use } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileView } from "@/components/profile/ProfileView";
import { RemoveFriendDialog } from "@/components/profile/dialogs/RemoveFriendDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
      toast.success(`You and ${user.name} are now friends`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add friend");
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
      toast.error(error instanceof Error ? error.message : "Failed to block user");
    }
  };

  const handleUnblock = async () => {
    if (!user?._id) return;
    try {
      await unblockUser({ userId: user._id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unblock user");
    }
  };

  // Loading state
  if (user === undefined || currentUser === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-6">
        <Skeleton className="h-[220px] w-full rounded-[22px]" />
        <div className="flex flex-wrap gap-5">
          <Skeleton className="h-64 flex-[1_1_300px] rounded-[18px] lg:max-w-[360px]" />
          <Skeleton className="h-64 flex-[999_1_520px] rounded-[18px]" />
        </div>
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
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
        title={`Block ${user.name}?`}
        description={`${user.name} ${user.lastname} will be removed from your friends and you won't be able to message each other.`}
        confirmText="Block"
        variant="destructive"
        onConfirm={handleBlock}
      />
    </div>
  );
}
