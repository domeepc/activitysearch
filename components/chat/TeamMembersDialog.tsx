"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { UserMinus } from "lucide-react";

interface TeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  teamId: Id<"teams">;
  teammates: Array<{
    _id: Id<"users">;
    name: string;
    lastname: string;
    username: string;
    avatar: string;
  }>;
  admins: Id<"users">[];
  createdBy: Id<"users">;
  currentUserId: Id<"users">;
  onKickMember?: (teamId: Id<"teams">, userId: Id<"users">) => Promise<void>;
}

export function TeamMembersDialog({
  open,
  onOpenChange,
  teamName,
  teamId,
  teammates,
  createdBy,
  currentUserId,
  onKickMember,
}: TeamMembersDialogProps) {
  const [showKickMember, setShowKickMember] = useState(false);
  const [memberToKick, setMemberToKick] = useState<{
    userId: Id<"users">;
    name: string;
  } | null>(null);

  const isCurrentUserCreator = currentUserId === createdBy;

  const handleKickConfirm = async () => {
    if (memberToKick && onKickMember) {
      await onKickMember(teamId, memberToKick.userId);
      setMemberToKick(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{teamName}</DialogTitle>
            <DialogDescription>
              {teammates.length} {teammates.length === 1 ? "member" : "members"}
            </DialogDescription>
          </DialogHeader>
          <ul className="-mx-2 flex max-h-96 flex-col overflow-y-auto">
            {teammates.map((teammate) => {
              // Only the creator is an admin.
              const isCreator = teammate._id === createdBy;
              const isCurrentUser = teammate._id === currentUserId;
              const canKick = isCurrentUserCreator && !isCreator;
              const fullName = `${teammate.name} ${teammate.lastname}`;

              return (
                <li
                  key={teammate._id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <Link
                    href={`/profile/${teammate._id}`}
                    onClick={() => onOpenChange(false)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="size-10">
                      <AvatarImage src={teammate.avatar} alt="" />
                      <AvatarFallback className="text-xs font-bold">
                        {teammate.name[0]}
                        {teammate.lastname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <b className="truncate text-sm font-semibold">
                          {fullName}
                          {isCurrentUser && <span className="font-normal text-zinc-500"> (you)</span>}
                        </b>
                        {isCreator && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            Admin
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">@{teammate.username}</span>
                    </span>
                  </Link>
                  {canKick && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      aria-label={`Remove ${fullName} from team`}
                      onClick={() => {
                        setMemberToKick({ userId: teammate._id, name: fullName });
                        setShowKickMember(true);
                      }}
                    >
                      <UserMinus />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>

      {memberToKick && (
        <ConfirmDialog
          open={showKickMember}
          onOpenChange={setShowKickMember}
          title="Remove from team?"
          description={`${memberToKick.name} will lose access to ${teamName} and its chat.`}
          confirmText="Remove"
          variant="destructive"
          onConfirm={handleKickConfirm}
        />
      )}
    </>
  );
}
