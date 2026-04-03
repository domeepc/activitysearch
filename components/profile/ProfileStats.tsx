"use client";

import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export interface ProfileProgressionDisplay {
  level: number;
  progressFraction: number;
  expIntoLevel: number;
  expForCurrentLevel: number;
  totalExp: number;
  loyaltyPoints?: number;
}

interface ProfileStatsProps {
  progression: ProfileProgressionDisplay | null | undefined;
  isLoading?: boolean;
}

export function ProfileStats({
  progression,
  isLoading = false,
}: ProfileStatsProps) {
  if (isLoading || progression === undefined) {
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

  if (!progression) {
    return null;
  }

  const pct = progression.progressFraction * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Level {progression.level}</Label>
        <span className="text-sm font-medium text-muted-foreground">
          {progression.expIntoLevel} / {progression.expForCurrentLevel} XP
        </span>
      </div>
      <Progress value={pct} className="h-3" />
      <p className="text-xs text-muted-foreground">
        {Math.round(pct)}% to level {progression.level + 1}
      </p>
      <p className="text-xs text-muted-foreground">
        Total experience: {progression.totalExp} XP
      </p>
      {progression.loyaltyPoints !== undefined && (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className="text-xs font-medium text-foreground">Loyalty points</p>
          <p className="text-lg font-semibold tabular-nums">
            {progression.loyaltyPoints}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Earned when you level up. Redeem toward activity discounts at
            checkout (where available).
          </p>
        </div>
      )}
    </div>
  );
}
