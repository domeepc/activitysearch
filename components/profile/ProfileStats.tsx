"use client";

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
      <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800 p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  if (!progression) return null;

  const pct = progression.progressFraction * 100;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800 p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {progression.level}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Level
            </span>
          </div>
          <span className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
            {progression.expIntoLevel} / {progression.expForCurrentLevel} XP
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span>{Math.round(pct)}% to level {progression.level + 1}</span>
          <span>{progression.totalExp} XP total</span>
        </div>
      </div>

      {progression.loyaltyPoints !== undefined && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Loyalty Points
            </p>
            <p className="text-[11px] text-amber-700/70 mt-0.5">
              Redeem toward activity discounts at checkout.
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums text-amber-700">
            {progression.loyaltyPoints}
          </span>
        </div>
      )}
    </div>
  );
}
