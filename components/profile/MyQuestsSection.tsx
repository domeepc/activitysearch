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

function questListClassName(count: number) {
  return cn(
    "space-y-2",
    count > 3 &&
      "max-h-[min(14rem,55vh)] overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-gutter:stable]"
  );
}

function XpPill({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
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
          ? "bg-emerald-50 border border-emerald-100"
          : "bg-zinc-50 border border-zinc-100"
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
              completed ? "text-emerald-900" : "text-zinc-900"
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
        <p className="mt-1 line-clamp-3 text-xs text-zinc-500">
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
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <span className="text-xs text-zinc-400">
        {completed}/{total}
      </span>
    </div>
  );
}

export function MyQuestsSection() {
  const overview = useQuery(api.quests.myQuestsOverview, {});

  if (overview === undefined) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-zinc-400" />
          <h3 className="text-base font-semibold text-zinc-900">Quests</h3>
        </div>
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  const hasAny =
    overview.systemQuests.length > 0 || overview.activityQuests.length > 0;

  if (!hasAny) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-zinc-400" />
          <h3 className="text-base font-semibold text-zinc-900">Quests</h3>
        </div>
        <p className="text-sm text-zinc-400">
          Complete quests to earn XP and level up. Join an activity to see
          organiser quests.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="text-base font-semibold text-zinc-900">Quests</h3>
      </div>

      {overview.systemQuests.length > 0 && (
        <div className="space-y-2">
          <SectionLabel
            label="Journey"
            total={overview.systemQuests.length}
            completed={overview.systemQuests.filter((r) => r.completed).length}
          />
          <ul className={questListClassName(overview.systemQuests.length)}>
            {overview.systemQuests.map((row) => (
              <QuestRowCard
                key={row.quest._id}
                quest={row.quest}
                completed={row.completed}
              />
            ))}
          </ul>
        </div>
      )}

      {overview.activityQuests.map((group) => (
        <div key={group.activityId} className="space-y-2">
          <SectionLabel
            label={group.activityName}
            total={group.quests.length}
            completed={group.quests.filter((r) => r.completed).length}
          />
          <ul className={questListClassName(group.quests.length)}>
            {group.quests.map((row) => (
              <QuestRowCard
                key={row.quest._id}
                quest={row.quest}
                completed={row.completed}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
