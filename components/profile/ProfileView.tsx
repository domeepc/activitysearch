"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { progressionFromTotalExp } from "@/lib/gamification/levels";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileInfo } from "./ProfileInfo";
import { ProfileStats, type ProfileProgressionDisplay } from "./ProfileStats";
import { MyQuestsSection } from "./MyQuestsSection";
import { FriendList, type ProfileFriend } from "./FriendList";
import { BlockedUsersList } from "./BlockedUsersList";
import { EmailVerificationSection } from "./EmailVerificationSection";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useEmailVerification } from "@/lib/hooks/useEmailVerification";
import { EmailVerificationDialog } from "./dialogs/EmailVerificationDialog";
import { Ban } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
        _creationTime?: number;
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
  friends?: ProfileFriend[];
  isLoading?: boolean;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
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

  const [tab, setTab] = useState<"quests" | "friends" | "blocked">("quests");
  const questOverview = useQuery(
    api.quests.myQuestsOverview,
    currentUser && user && currentUser._id === user._id ? {} : "skip"
  );

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

  const friendCount = friends?.length ?? user.friends.length;
  const questsCompleted =
    isOwnProfile && questOverview
      ? questOverview.systemQuests.filter((r) => r.completed).length +
        questOverview.activityQuests.reduce((s, g) => s + g.quests.filter((r) => r.completed).length, 0)
      : undefined;
  const tabs = [
    ...(isOwnProfile ? [{ key: "quests" as const, label: "Quests" }] : []),
    { key: "friends" as const, label: `Friends · ${friendCount}` },
    ...(isOwnProfile ? [{ key: "blocked" as const, label: "Blocked" }] : []),
  ];
  const activeTab = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  return (
    <div className="flex flex-col gap-5">
      <ProfileHeader
        userId={user._id}
        name={user.name}
        lastname={user.lastname}
        username={user.username}
        avatar={user.avatar}
        level={progressionDisplay?.level}
        friendCount={friendCount}
        isOwnProfile={isOwnProfile}
        isFriend={isFriend || false}
        isBlocked={isBlocked}
        hasBlockedYou={hasBlockedYou}
        onAddFriend={onAddFriend}
        onRemoveFriend={onRemoveFriend}
        onBlock={onBlock}
        onUnblock={onUnblock}
        settingsUrl={settingsUrl}
      />

      {!isOwnProfile && (isBlocked || hasBlockedYou) && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
          <Ban className="size-4 shrink-0" />
          {isBlocked
            ? `You blocked ${user.name}. Unblock to message or add them again.`
            : `${user.name} isn't accepting messages or friend requests from you.`}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 lg:max-w-[360px]">
          <ProfileStats
            progression={progressionDisplay}
            questsCompleted={questsCompleted}
            isLoading={isOwnProfile ? progressionQuery === undefined : false}
          />
          <ProfileInfo
            description={user.description}
            contact={user.contact}
            joinedAt={user._creationTime}
            isOwnProfile={isOwnProfile}
          >
            {isOwnProfile && currentEmail ? (
              <div className="mt-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <EmailVerificationSection
                  email={currentEmail}
                  verificationStatus={verificationStatus}
                  onVerifyClick={() => setShowEmailDialog(true)}
                />
              </div>
            ) : null}
          </ProfileInfo>
        </aside>

        <section className="min-w-0 flex-[999_1_520px] overflow-hidden rounded-[18px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div role="tablist" aria-label="Profile sections" className="flex gap-1 border-b border-zinc-200 px-3 pt-2 dark:border-zinc-800">
            {tabs.map((t) => (
              <button
                key={t.key}
                id={`tab-${t.key}`}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                aria-controls={`panel-${t.key}`}
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px h-11 border-b-2 px-3 text-sm transition-colors",
                  activeTab === t.key
                    ? "border-blue-600 font-semibold text-zinc-900 dark:text-zinc-50"
                    : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="p-4 sm:p-5">
            {activeTab === "quests" ? (
              <MyQuestsSection />
            ) : activeTab === "blocked" ? (
              <BlockedUsersList blockedUsers={blockedUsers} />
            ) : (
              <FriendList
                friends={friends}
                friendIds={user.friends}
                showPresence={isOwnProfile}
                emptyText={isOwnProfile ? "Add friends from Messages to plan activities together." : `${user.name} hasn't added any friends yet.`}
              />
            )}
          </div>
        </section>
      </div>

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
    </div>
  );
}
