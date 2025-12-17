"use client";

import { Card, CardContent } from "@/components/ui/card";
import { UserAvatarSection } from "./UserAvatarSection";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileInfo } from "./ProfileInfo";
import { ProfileStats } from "./ProfileStats";
import { FriendList } from "./FriendList";
import { EmailVerificationSection } from "./EmailVerificationSection";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useEmailVerification } from "@/lib/hooks/useEmailVerification";
import { EmailVerificationDialog } from "./dialogs/EmailVerificationDialog";
import { Label } from "../ui/label";

interface ProfileViewProps {
  user:
    | {
        _id: Id<"users">;
        name: string;
        lastname: string;
        username: string;
        slug: string;
        email: string;
        description: string;
        contact: string;
        avatar: string;
        totalExp: bigint;
        friends: Id<"users">[];
      }
    | null
    | undefined;
  currentUser:
    | {
        _id: Id<"users">;
        friends: Id<"users">[];
      }
    | null
    | undefined;
  friends?: Array<{
    _id: Id<"users">;
    username: string;
    slug: string;
  }>;
  isLoading?: boolean;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
  onDeleteAccount?: () => void;
}

export function ProfileView({
  user,
  currentUser,
  friends,
  isLoading = false,
  onAddFriend,
  onRemoveFriend,
  onDeleteAccount,
}: ProfileViewProps) {
  const { user: clerkUser } = useUser();

  // Get current email from user or clerkUser for display
  const currentEmail =
    user?.email || clerkUser?.primaryEmailAddress?.emailAddress || "";

  // All hooks must be called before any early returns
  const {
    verificationCode,
    setVerificationCode,
    verifying,
    verificationError,
    resendCooldown,
    showDialog: showEmailDialog,
    setShowDialog: setShowEmailDialog,
    handleVerifyEmail,
    handleResendVerificationEmail,
    getEmailVerificationStatus,
  } = useEmailVerification(currentEmail);

  const verificationStatus = getEmailVerificationStatus();

  if (isLoading || !user) {
    return null;
  }

  const isOwnProfile = currentUser?._id === user._id;
  const isFriend = currentUser?.friends.includes(user._id);
  const settingsUrl = isOwnProfile
    ? `/profile/${user.slug}/settings`
    : undefined;

  return (
    <Card>
      <ProfileHeader
        isOwnProfile={isOwnProfile}
        userName={user.name}
        username={user.username}
        isFriend={isFriend || false}
        onAddFriend={onAddFriend}
        onRemoveFriend={onRemoveFriend}
        onDeleteAccount={onDeleteAccount}
        settingsUrl={settingsUrl}
      />
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <UserAvatarSection
            currentAvatar={user.avatar || "https://via.placeholder.com/128"}
            userName={`${user.name} ${user.lastname}`}
            disabled={true}
          />
        </div>

        {/* Profile Info */}
        <ProfileInfo
          name={user.name}
          lastname={user.lastname}
          username={isOwnProfile ? user.username : undefined}
          description={user.description}
          contact={user.contact}
          isOwnProfile={isOwnProfile}
          isLoading={isLoading}
        />

        {/* Email Section - Only show for own profile */}

        {isOwnProfile && currentEmail && (
          <div className="space-y-2">
            <Label>Email</Label>
            <EmailVerificationSection
              email={currentEmail}
              verificationStatus={verificationStatus}
              onVerifyClick={() => setShowEmailDialog(true)}
            />
          </div>
        )}

        {/* Experience Points */}
        <ProfileStats exp={Number(user.totalExp || 0)} isLoading={isLoading} />

        {/* Friends */}
        <FriendList
          friends={friends}
          friendIds={user.friends}
          isLoading={isLoading}
        />
      </CardContent>

      {/* Email Verification Dialog */}
      {isOwnProfile && (
        <EmailVerificationDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          verificationCode={verificationCode}
          onVerificationCodeChange={setVerificationCode}
          verifying={verifying}
          verificationError={verificationError}
          resendCooldown={resendCooldown}
          onVerify={handleVerifyEmail}
          onResend={handleResendVerificationEmail}
        />
      )}
    </Card>
  );
}
