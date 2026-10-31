"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuestVisual } from "@/components/quests/QuestVisual";

const CONFETTI_COLORS = ["#2563eb", "#38bdf8", "#a78bfa", "#fbbf24", "#f97316"];

function fireQuestConfetti() {
  // Respect "reduce motion": the popup still opens, just without the bursts
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  void import("canvas-confetti").then(({ default: confetti }) => {
    const burst = (scalar: number, delay: number) =>
      window.setTimeout(() => {
        for (const x of [0.2, 0.8]) {
          confetti({
            particleCount: Math.floor(70 * scalar),
            spread: 80,
            startVelocity: 42,
            origin: { x, y: 0.5 },
            zIndex: 10000,
            colors: CONFETTI_COLORS,
          });
        }
      }, delay);
    burst(1, 0);
    burst(0.7, 200);
    burst(0.4, 420);
  });
}

export function QuestCompletionCelebrationDialog({
  quest,
  open,
  onOpenChange,
}: {
  quest: Doc<"quests"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Live: already includes this quest's XP by the time the popup shows
  const progression = useQuery(api.users.getProgression, open ? {} : "skip");
  const me = useQuery(api.users.current, open ? {} : "skip");

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && quest && !prevOpenRef.current) fireQuestConfetti();
    prevOpenRef.current = open;
  }, [open, quest]);

  const xp = quest ? Number(quest.expAmount) : 0;
  const expInto = progression ? Number(progression.expIntoLevel) : 0;
  const expForLevel = progression ? Number(progression.expForCurrentLevel) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={quest?._id ?? "idle"} className="gap-0 overflow-hidden p-0 sm:max-w-sm" showCloseButton={false}>
        {quest ? (
          <>
            {/* Header band; the badge overlaps its bottom edge */}
            <div className="relative h-28 bg-gradient-to-br from-blue-600 via-blue-500 to-violet-500">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(255,255,255,0.2),transparent_40%)]"
              />
              <p className="relative flex items-center justify-center gap-1.5 pt-5 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Quest complete
              </p>
            </div>

            <div className="flex flex-col items-center px-7 pb-7">
              <div
                className="-mt-12 rounded-3xl bg-background p-3 shadow-xl ring-4 ring-background"
                style={{ animation: "quest-badge-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}
              >
                <div className="rounded-2xl bg-blue-50 p-2 dark:bg-blue-950/60">
                  <QuestVisual iconImageUrl={quest.iconImageUrl} iconSvg={quest.iconSvg} size="xl" />
                </div>
              </div>

              <DialogTitle className="mt-5 text-center text-xl font-bold tracking-tight">{quest.questName}</DialogTitle>
              {quest.description ? (
                <DialogDescription className="mt-1.5 line-clamp-3 text-center text-sm">{quest.description}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">You completed a quest and earned {xp} XP.</DialogDescription>
              )}

              <p
                className="mt-5 flex items-baseline gap-1.5 text-blue-600 dark:text-blue-400"
                style={{ animation: "quest-xp-pop 0.65s cubic-bezier(0.34,1.56,0.64,1) 0.3s both" }}
              >
                <span className="text-4xl font-black tabular-nums tracking-tight">+{xp}</span>
                <span className="text-sm font-bold uppercase tracking-wider">XP</span>
              </p>

              {progression && expForLevel > 0 && (
                <div className="mt-5 w-full rounded-2xl bg-muted/60 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">Level {progression.level}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {expInto} / {expForLevel} XP
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Progress to level ${progression.level + 1}`}
                    aria-valuemin={0}
                    aria-valuemax={expForLevel}
                    aria-valuenow={expInto}
                    className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-background"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-500 transition-[width] duration-1000 ease-out motion-reduce:transition-none"
                      style={{ width: `${Math.round(progression.progressFraction * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {expForLevel - expInto} XP to level {progression.level + 1}
                  </p>
                </div>
              )}

              <div className="mt-6 flex w-full flex-col gap-2">
                <Button type="button" className="h-11 w-full rounded-xl font-semibold" onClick={() => onOpenChange(false)}>
                  Nice!
                </Button>
                {me && (
                  <Button asChild variant="ghost" className="h-10 w-full rounded-xl text-muted-foreground">
                    <Link href={`/profile/${me._id}`} onClick={() => onOpenChange(false)}>
                      See my quests
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <DialogTitle className="sr-only">Quest complete</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}
