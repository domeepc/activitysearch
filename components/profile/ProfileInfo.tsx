"use client";

import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfileInfoProps {
  name: string;
  lastname: string;
  username?: string;
  description: string;
  contact?: string;
  isOwnProfile: boolean;
  isLoading?: boolean;
}

export function ProfileInfo({
  name,
  lastname,
  username,
  description,
  contact,
  isOwnProfile,
  isLoading = false,
}: ProfileInfoProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-48" />
        </div>
        {username && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-32" />
          </div>
        )}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
        {contact && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-48" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="space-y-2">
        <Label>Name</Label>
        <p className="text-sm text-muted-foreground">{name}</p>
      </div>

      <div className="space-y-2">
        <Label>Last Name</Label>
        <p className="text-sm text-muted-foreground">{lastname}</p>
      </div>

      {username && (
        <div className="space-y-2">
          <Label>Username</Label>
          <p className="text-sm text-muted-foreground">@{username}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label>{isOwnProfile ? "Description" : "About"}</Label>
        <p className="text-sm text-muted-foreground">
          {description || "No description provided"}
        </p>
      </div>

      {(isOwnProfile || contact) && (
        <div className="space-y-2">
          <Label>Contact</Label>
          <p className="text-sm text-muted-foreground">
            {contact || "No contact information"}
          </p>
        </div>
      )}
    </div>
  );
}
