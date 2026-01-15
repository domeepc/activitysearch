"use client";

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
import { Id } from "@/convex/_generated/dataModel";

interface TeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  teammates: Array<{
    _id: Id<"users">;
    name: string;
    lastname: string;
    username: string;
    slug: string;
    avatar: string;
  }>;
  admins: Id<"users">[];
  createdBy: Id<"users">;
  currentUserId: Id<"users">;
}

export function TeamMembersDialog({
  open,
  onOpenChange,
  teamName,
  teammates,
  createdBy,
  currentUserId,
}: TeamMembersDialogProps) {
  const router = useRouter();

  const handleMemberClick = (slug: string) => {
    router.push(`/profile/${slug}`);
    onOpenChange(false);
  };

  return (
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

            return (
              <div
                key={teammate._id}
                onClick={() => handleMemberClick(teammate.slug)}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
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
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
