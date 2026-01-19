"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  const router = useRouter();
  const [showKickMember, setShowKickMember] = useState(false);
  const [memberToKick, setMemberToKick] = useState<{
    userId: Id<"users">;
    name: string;
  } | null>(null);

  const isCurrentUserCreator = currentUserId === createdBy;

  const handleMemberClick = (userId: Id<"users">) => {
    router.push(`/profile/${userId}`);
    onOpenChange(false);
  };

  const handleKickClick = (
    e: React.MouseEvent,
    userId: Id<"users">,
    name: string
  ) => {
    e.stopPropagation();
    setMemberToKick({ userId, name });
    setShowKickMember(true);
  };

  const handleKickConfirm = async () => {
    if (memberToKick && onKickMember) {
      await onKickMember(teamId, memberToKick.userId);
      setMemberToKick(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Team Members - {teamName}</DialogTitle>
            <DialogDescription>View all members of this team</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {teammates.map((teammate) => {
              // Only creator is admin - no other admins
              const isCreator = teammate._id === createdBy;
              const isCurrentUser = teammate._id === currentUserId;
              const canKick = isCurrentUserCreator && !isCreator;

              return (
                <div
                  key={teammate._id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent"
                >
                  <div
                    onClick={() => handleMemberClick(teammate._id)}
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={teammate.avatar} alt={teammate.name} />
                      <AvatarFallback>
                        {teammate.name[0]}
                        {teammate.lastname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {teammate.name} {teammate.lastname}
                          {isCurrentUser && " (You)"}
                        </p>
                        {isCreator && (
                          <Badge variant="default" className="text-xs">
                            Creator
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        @{teammate.username}
                      </p>
                    </div>
                  </div>
                  {canKick && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-red-100 cursor-pointer"
                      title={`Kick ${teammate.name} ${teammate.lastname} from team`}
                      onClick={(e) =>
                        handleKickClick(
                          e,
                          teammate._id,
                          `${teammate.name} ${teammate.lastname}`
                        )
                      }
                    >
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {memberToKick && (
        <ConfirmDialog
          open={showKickMember}
          onOpenChange={setShowKickMember}
          title="Kick Member"
          description={`Are you sure you want to kick "${memberToKick.name}" from "${teamName}"? They will no longer be able to access this team.`}
          confirmText="Kick"
          variant="destructive"
          onConfirm={handleKickConfirm}
        />
      )}
    </>
  );
}
