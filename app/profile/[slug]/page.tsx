"use client";

import { useEffect, use } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileView } from "@/components/profile/ProfileView";
import { RemoveFriendDialog } from "@/components/profile/dialogs/RemoveFriendDialog";
import { useState } from "react";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const user = useQuery(api.users.getUserBySlug, {
    slug: resolvedParams.slug,
  });
  const currentUser = useQuery(api.users.current);
  const addFriend = useMutation(api.users.addFriend);
  const removeFriend = useMutation(api.users.removeFriend);
  const friends = useQuery(
    api.users.getUsersByIds,
    user?.friends && user.friends.length > 0
      ? { userIds: user.friends }
      : "skip"
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
      />

      <RemoveFriendDialog
        open={showRemoveDialog}
        onOpenChange={setShowRemoveDialog}
        onConfirm={handleRemoveFriend}
        friendName={user.name}
        friendLastname={user.lastname}
      />
    </div>
  );
}
