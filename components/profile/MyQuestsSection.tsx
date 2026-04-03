"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { QuestVisual } from "@/components/quests/QuestVisual";
import { cn } from "@/lib/utils";

type QuestRow = {
  quest: Doc<"quests">;
  completed: boolean;
  completedAt?: number;
};

function questListClassName(count: number) {
  return cn(
    "space-y-3",
    count > 3 &&
    "max-h-[min(14rem,55vh)] overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-gutter:stable]"
  );
}

function QuestRowCard({ quest, completed }: Omit<QuestRow, "completedAt">) {
  return (
    <li
      className={cn(
        "flex gap-3 rounded-lg border-2 border-border p-3",
        completed && "border-primary/25 bg-primary/1"
      )}
    >
      <QuestVisual
        iconImageUrl={quest.iconImageUrl}
        iconSvg={quest.iconSvg}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-tight">{quest.questName}</p>
          {completed ? (
            <CheckCircle2 className="size-5 shrink-0 text-green-600" />
          ) : (
            <Circle className="size-5 shrink-0 text-muted-foreground" />
          )}
        </div>
        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
          {quest.description}
        </p>
        <Badge variant="secondary" className="mt-2">
          +{Number(quest.expAmount)} XP
        </Badge>
      </div>
    </li>
  );
}

export function MyQuestsSection() {
  const overview = useQuery(api.quests.myQuestsOverview, {});

  if (overview === undefined) {
    return (
      <Card className="border-border border-2">
        <CardHeader>
          <CardTitle className="text-lg">Quests</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  const hasAny =
    overview.systemQuests.length > 0 || overview.activityQuests.length > 0;

  if (!hasAny) {
    return (
      <Card className="border-border border-2">
        <CardHeader>
          <CardTitle className="text-lg">Quests</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Complete quests to earn XP and level up. Join an activity to see
          organiser quests.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border border-2">
      <CardHeader>
        <CardTitle className="text-lg">Quests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {overview.systemQuests.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Journey
            </h4>
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
          <div key={group.activityId} className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">
              {group.activityName}
            </h4>
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
      </CardContent>
    </Card>
  );
}
