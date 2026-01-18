"use client";

import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, UserMinus, Ban } from "lucide-react";
import Link from "next/link";

interface ProfileHeaderProps {
  isOwnProfile: boolean;
  userName: string;
  username: string;
  isFriend: boolean;
  isBlocked?: boolean;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  onDeleteAccount?: () => void;
  settingsUrl?: string;
}

export function ProfileHeader({
  isOwnProfile,
  userName,
  username,
  isFriend,
  isBlocked = false,
  onAddFriend,
  onRemoveFriend,
  onBlock,
  onUnblock,
  onDeleteAccount,
  settingsUrl,
}: ProfileHeaderProps) {
  return (
    <CardHeader>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <CardTitle>
            {isOwnProfile ? "Profile" : `${userName}'s Profile`}
          </CardTitle>
          <CardDescription>
            {isOwnProfile ? "Manage your profile information" : `@${username}`}
          </CardDescription>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isOwnProfile ? (
            <>
              {onDeleteAccount && (
                <Button
                  variant="destructive"
                  onClick={onDeleteAccount}
                  className="w-full md:w-auto"
                >
                  Delete Account
                </Button>
              )}
              {settingsUrl && (
                <Link href={settingsUrl}>
                  <Button className="w-full md:w-auto">Edit Profile</Button>
                </Link>
              )}
            </>
          ) : (
            <>
              {isBlocked ? (
                <>
                  {onUnblock && (
                    <Button
                      variant="outline"
                      onClick={onUnblock}
                      className="w-full md:w-auto"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Unblock
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled
                    className="w-full md:w-auto opacity-50 cursor-not-allowed"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    User is Blocked
                  </Button>
                </>
              ) : isFriend ? (
                <>
                  <Button
                    variant="outline"
                    onClick={onRemoveFriend}
                    className="w-full md:w-auto"
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Remove Friend
                  </Button>
                  {onBlock && (
                    <Button
                      variant="destructive"
                      onClick={onBlock}
                      className="w-full md:w-auto"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Block
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    onClick={onAddFriend}
                    className="w-full md:w-auto"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Friend
                  </Button>
                  {onBlock && (
                    <Button
                      variant="destructive"
                      onClick={onBlock}
                      className="w-full md:w-auto"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Block
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </CardHeader>
  );
}

