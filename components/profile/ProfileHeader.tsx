"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Ban, Check, MessageCircle, MoreHorizontal, Pencil, UserMinus, UserPlus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProfileHeaderProps {
  userId: Id<"users">;
  name: string;
  lastname: string;
  username: string;
  avatar?: string;
  level?: number;
  friendCount: number;
  isOwnProfile: boolean;
  isFriend: boolean;
  isBlocked?: boolean;
  hasBlockedYou?: boolean;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  settingsUrl?: string;
}

export function ProfileHeader({
  userId,
  name,
  lastname,
  username,
  avatar,
  level,
  friendCount,
  isOwnProfile,
  isFriend,
  isBlocked = false,
  hasBlockedYou = false,
  onAddFriend,
  onRemoveFriend,
  onBlock,
  onUnblock,
  settingsUrl,
}: ProfileHeaderProps) {
  const router = useRouter();
  const getOrCreateConversationId = useMutation(api.messages.getOrCreateConversationId);
  const [opening, setOpening] = useState(false);
  const fullName = `${name} ${lastname}`.trim();

  const openChat = async () => {
    setOpening(true);
    try {
      const conversationId = await getOrCreateConversationId({ otherUserId: userId });
      router.push(`/chat/${conversationId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the chat");
      setOpening(false);
    }
  };

  return (
    <section aria-label="Profile" className="overflow-hidden rounded-[22px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative h-28 sm:h-36" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(110deg,#1e3a8a_0%,#1d4ed8_40%,#2563eb_70%,#60a5fa_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.25),transparent_45%)]" />
      </div>
      <div className="relative flex flex-wrap items-end gap-x-4 gap-y-3 px-5 pb-5 sm:px-6">
        <Avatar className="-mt-12 size-24 border-4 border-white text-3xl shadow-sm sm:size-[104px] dark:border-zinc-900">
          <AvatarImage src={avatar} alt="" />
          <AvatarFallback className="bg-blue-100 text-3xl font-bold text-blue-900">
            {name[0]}
            {lastname[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-[200px] flex-1 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{fullName}</h1>
            {level !== undefined && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                Level {level}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            @{username} · {friendCount} {friendCount === 1 ? "friend" : "friends"}
          </p>
        </div>

        <div className="flex gap-2 pb-1">
          {isOwnProfile ? (
            settingsUrl && (
              <Button asChild variant="outline" className="h-10">
                <Link href={settingsUrl}>
                  <Pencil /> Edit profile
                </Link>
              </Button>
            )
          ) : isBlocked ? (
            <Button variant="outline" className="h-10" onClick={onUnblock}>
              <Ban /> Unblock
            </Button>
          ) : (
            <>
              {isFriend ? (
                <>
                  <Button className="h-10 bg-blue-600 font-semibold text-white hover:bg-blue-700" onClick={openChat} disabled={opening}>
                    <MessageCircle /> {opening ? "Opening…" : "Message"}
                  </Button>
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 text-sm dark:border-zinc-700">
                    <Check className="size-4 text-green-600" /> Friends
                  </span>
                </>
              ) : (
                <Button
                  className="h-10 bg-blue-600 font-semibold text-white hover:bg-blue-700"
                  onClick={onAddFriend}
                  disabled={hasBlockedYou}
                >
                  <UserPlus /> Add friend
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-10" aria-label="More actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isFriend && (
                    <DropdownMenuItem onSelect={onRemoveFriend}>
                      <UserMinus /> Remove friend
                    </DropdownMenuItem>
                  )}
                  {onBlock && (
                    <DropdownMenuItem variant="destructive" onSelect={onBlock}>
                      <Ban /> Block {name}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
