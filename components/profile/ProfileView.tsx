"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { progressionFromTotalExp } from "@/lib/gamification/levels";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatarSection } from "./UserAvatarSection";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileInfo } from "./ProfileInfo";
import { ProfileStats, type ProfileProgressionDisplay } from "./ProfileStats";
import { MyQuestsSection } from "./MyQuestsSection";
import { FriendList } from "./FriendList";
import { BlockedUsersList } from "./BlockedUsersList";
import { EmailVerificationSection } from "./EmailVerificationSection";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useEmailVerification } from "@/lib/hooks/useEmailVerification";
import { EmailVerificationDialog } from "./dialogs/EmailVerificationDialog";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Ban } from "lucide-react";

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
        loyaltyPoints?: bigint;
        friends: Id<"users">[];
      }
    | null
    | undefined;
  currentUser:
    | {
        _id: Id<"users">;
        friends: Id<"users">[];
        blocked?: Id<"users">[];
      }
    | null
    | undefined;
  friends?: Array<{
    _id: Id<"users">;
    username: string;
  }>;
  isLoading?: boolean;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  onDeleteAccount?: () => void;
  blockedUsers?: Array<{
    _id: Id<"users">;
    name: string;
    lastname: string;
    username: string;
    avatar: string;
  }>;
  hasBlockedYou?: boolean;
}

export function ProfileView({
  user,
  currentUser,
  friends,
  isLoading = false,
  onAddFriend,
  onRemoveFriend,
  onBlock,
  onUnblock,
  onDeleteAccount,
  blockedUsers,
  hasBlockedYou = false,
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

  const progressionQuery = useQuery(
    api.users.getProgression,
    currentUser && user && currentUser._id === user._id ? {} : "skip"
  );

  if (isLoading || !user) {
    return null;
  }

  const isOwnProfile = currentUser?._id === user._id;

  const progressionDisplay: ProfileProgressionDisplay | null | undefined =
    isOwnProfile
      ? progressionQuery === undefined
        ? undefined
        : progressionQuery === null
          ? null
          : {
              level: progressionQuery.level,
              progressFraction: progressionQuery.progressFraction,
              expIntoLevel: Number(progressionQuery.expIntoLevel),
              expForCurrentLevel: Number(progressionQuery.expForCurrentLevel),
              totalExp: Number(progressionQuery.totalExp),
              loyaltyPoints: Number(progressionQuery.loyaltyPoints),
            }
      : (() => {
          const p = progressionFromTotalExp(user.totalExp);
          return {
            level: p.level,
            progressFraction: p.progressFraction,
            expIntoLevel: Number(p.expIntoLevel),
            expForCurrentLevel: Number(p.expForCurrentLevel),
            totalExp: Number(user.totalExp),
          };
        })();
  const isFriend = currentUser?.friends.includes(user._id);
  const isBlocked = currentUser?.blocked?.includes(user._id) || false;
  const settingsUrl = isOwnProfile
    ? `/profile/${user._id}/settings`
    : undefined;

  return (
    <Card className="border-border border-2 shadow-xl">
      <ProfileHeader
        isOwnProfile={isOwnProfile}
        userName={user.name}
        username={user.username}
        isFriend={isFriend || false}
        isBlocked={isBlocked}
        hasBlockedYou={hasBlockedYou}
        onAddFriend={onAddFriend}
        onRemoveFriend={onRemoveFriend}
        onBlock={onBlock}
        onUnblock={onUnblock}
        onDeleteAccount={onDeleteAccount}
        settingsUrl={settingsUrl}
      />
      <CardContent className="space-y-6">
        {/* Blocked Status Badge */}
        {isBlocked && !isOwnProfile && (
          <div className="flex justify-center">
            <Badge variant="destructive" className="text-sm py-2 px-4">
              <Ban className="h-4 w-4 mr-2" />
              This user is blocked
            </Badge>
          </div>
        )}
        {/* Has Blocked You Badge */}
        {hasBlockedYou && !isOwnProfile && (
          <div className="flex justify-center">
            <Badge variant="destructive" className="text-sm py-2 px-4">
              <Ban className="h-4 w-4 mr-2" />
              This user has blocked you
            </Badge>
          </div>
        )}

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

        <ProfileStats
          progression={progressionDisplay}
          isLoading={isOwnProfile ? progressionQuery === undefined : false}
        />

        {isOwnProfile && <MyQuestsSection />}

        {/* Friends */}
        <FriendList
          friends={friends}
          friendIds={user.friends}
          isLoading={isLoading}
        />

        {/* Blocked Users - Only show on own profile */}
        {isOwnProfile && (
          <BlockedUsersList
            blockedUsers={blockedUsers}
            isLoading={isLoading}
          />
        )}
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
