"use client";

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
  questsCompleted?: number;
  isLoading?: boolean;
}

const nf = new Intl.NumberFormat("en-IE");

/** "Journey" card: level ring, XP to next level and headline counters. */
export function ProfileStats({ progression, questsCompleted, isLoading = false }: ProfileStatsProps) {
  if (isLoading || progression === undefined) {
    return (
      <section className="flex flex-col gap-3.5 rounded-[18px] border border-zinc-200 bg-white p-4.5 dark:border-zinc-800 dark:bg-zinc-900">
        <Skeleton className="h-4 w-20" />
        <div className="flex items-center gap-3.5">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-8 flex-1" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
      </section>
    );
  }

  if (!progression) return null;

  const pct = Math.round(progression.progressFraction * 100);
  const toNext = Math.max(0, progression.expForCurrentLevel - progression.expIntoLevel);
  const stats = [
    { label: "Total XP", value: nf.format(progression.totalExp) },
    progression.loyaltyPoints !== undefined && { label: "Points", value: nf.format(progression.loyaltyPoints) },
    questsCompleted !== undefined && { label: "Quests", value: nf.format(questsCompleted) },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <section aria-labelledby="journey-h" className="flex flex-col gap-3.5 rounded-[18px] border border-zinc-200 bg-white p-4.5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 id="journey-h" className="text-[15px] font-bold">Journey</h2>
      <div className="flex items-center gap-3.5">
        <span
          role="img"
          aria-label={`Level ${progression.level}, ${pct}% to level ${progression.level + 1}`}
          className="inline-flex size-16 shrink-0 items-center justify-center rounded-full dark:[--ring-track:#3f3f46]"
          style={{ background: `conic-gradient(#2563eb 0 ${pct}%, var(--ring-track, #e4e4e7) ${pct}% 100%)` }}
        >
          <span className="inline-flex size-[50px] items-center justify-center rounded-full bg-white text-lg font-bold dark:bg-zinc-900">
            {progression.level}
          </span>
        </span>
        <span className="flex-1">
          <b className="block text-sm tabular-nums">
            {nf.format(progression.expIntoLevel)} / {nf.format(progression.expForCurrentLevel)} XP
          </b>
          <span className="text-[13px] text-zinc-600 dark:text-zinc-400">
            {nf.format(toNext)} XP to level {progression.level + 1}
          </span>
        </span>
      </div>
      <dl className="grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-zinc-50 px-1 py-2.5 dark:bg-zinc-800/60">
            <dt className="text-[11px] text-zinc-600 dark:text-zinc-400">{s.label}</dt>
            <dd className="mt-0.5 text-[17px] font-bold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      {progression.loyaltyPoints !== undefined && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">Spend points on your next reservation — 10 points = €1 off.</p>
      )}
    </section>
  );
}
