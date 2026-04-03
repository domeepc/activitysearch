"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { QuestVisual } from "@/components/quests/QuestVisual";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ActivityQuestsPublicSectionProps {
  activityId: Id<"activities">;
  isOrganiser: boolean;
}

export function ActivityQuestsPublicSection({
  activityId,
  isOrganiser,
}: ActivityQuestsPublicSectionProps) {
  const quests = useQuery(api.quests.listManualQuestsForActivity, {
    activityId,
  });
  const deleteQuest = useMutation(api.quests.deleteManualQuest);

  if (quests === undefined || quests.length === 0) {
    return null;
  }

  const scrollable = quests.length > 3;

  return (
    <>
      <Separator />
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Quests</h3>
        <p className="text-sm text-muted-foreground">
          Bonus challenges from the organiser. Complete them on the day — your
          organiser marks progress when you&apos;re on a reservation.
        </p>
        <ul
          className={
            scrollable
              ? "max-h-[min(26rem,55vh)] space-y-3 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-gutter:stable]"
              : "space-y-3"
          }
        >
          {quests.map((q) => (
            <li
              key={q._id}
              className="flex gap-3 rounded-lg border-2 border-border p-4"
            >
              <QuestVisual
                iconImageUrl={q.iconImageUrl}
                iconSvg={q.iconSvg}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium leading-tight">{q.questName}</p>
                  {isOrganiser && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      aria-label={`Remove quest ${q.questName}`}
                      onClick={async () => {
                        try {
                          await deleteQuest({ questId: q._id });
                          toast.success("Quest removed");
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Delete failed"
                          );
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                {q.description ? (
                  <p className="text-sm text-muted-foreground">{q.description}</p>
                ) : null}
                <Badge variant="secondary" className="mt-1">
                  +{Number(q.expAmount)} XP
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
