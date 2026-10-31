"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { CheckCircle2, Circle, Trophy } from "lucide-react";
import { QuestVisual } from "@/components/quests/QuestVisual";
import { cn } from "@/lib/utils";

type QuestRow = {
  quest: Doc<"quests">;
  completed: boolean;
  completedAt?: number;
};

function XpPill({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
      +{amount} XP
    </span>
  );
}

function QuestRowCard({ quest, completed }: Omit<QuestRow, "completedAt">) {
  return (
    <li
      className={cn(
        "flex gap-3 rounded-2xl p-3.5 transition-colors",
        completed
          ? "border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
          : "border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      )}
    >
      <QuestVisual
        iconImageUrl={quest.iconImageUrl}
        iconSvg={quest.iconSvg}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "font-medium leading-tight",
              completed ? "text-emerald-900 dark:text-emerald-100" : "text-zinc-900 dark:text-zinc-50"
            )}
          >
            {quest.questName}
          </p>
          {completed ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
          ) : (
            <Circle className="size-4 shrink-0 text-zinc-300 mt-0.5" />
          )}
        </div>
        <p className="mt-1 line-clamp-3 text-xs text-zinc-500 dark:text-zinc-400">
          {quest.description}
        </p>
        <div className="mt-2">
          <XpPill amount={Number(quest.expAmount)} />
        </div>
      </div>
    </li>
  );
}

function SectionLabel({
  label,
  total,
  completed,
}: {
  label: string;
  total: number;
  completed: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{label}</h3>
      <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
        {completed} of {total} done
      </span>
    </div>
  );
}

export function MyQuestsSection() {
  const overview = useQuery(api.quests.myQuestsOverview, {});

  if (overview === undefined) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading quests…</p>;
  }

  const hasAny =
    overview.systemQuests.length > 0 || overview.activityQuests.length > 0;

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/60">
          <Trophy className="size-5" />
        </span>
        Complete quests to earn XP and level up. Join an activity to see its organiser&apos;s quests.
      </div>
    );
  }

  const groups = [
    ...(overview.systemQuests.length > 0
      ? [{ key: "journey", label: "Journey", rows: overview.systemQuests }]
      : []),
    ...overview.activityQuests.map((g) => ({
      key: String(g.activityId),
      label: g.activityName,
      rows: g.quests,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const done = group.rows.filter((r) => r.completed).length;
        return (
          <div key={group.key} className="flex flex-col gap-2.5">
            <SectionLabel label={group.label} total={group.rows.length} completed={done} />
            <div
              className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
              role="progressbar"
              aria-label={`${group.label} quests completed`}
              aria-valuenow={done}
              aria-valuemin={0}
              aria-valuemax={group.rows.length}
            >
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${(done / group.rows.length) * 100}%` }} />
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {group.rows.map((row) => (
                <QuestRowCard key={row.quest._id} quest={row.quest} completed={row.completed} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
