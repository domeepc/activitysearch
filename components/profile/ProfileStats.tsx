"use client";

import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfileStatsProps {
  exp: number;
  isLoading?: boolean;
}

export function ProfileStats({ exp, isLoading = false }: ProfileStatsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  const progressPercentage = (exp / 1000) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Experience Points</Label>
        <span className="text-sm font-medium text-muted-foreground">
          {exp} / 1000 XP
        </span>
      </div>
      <Progress value={progressPercentage} className="h-3" />
      <p className="text-xs text-muted-foreground">
        {Math.round(progressPercentage)}% to next level
      </p>
    </div>
  );
}

