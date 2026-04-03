"use client";

import { useEffect, useRef } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuestVisual } from "@/components/quests/QuestVisual";
import { cn } from "@/lib/utils";

function fireQuestConfetti() {
  void import("canvas-confetti").then(({ default: confetti }) => {
    const zIndex = 10000;
    const burst = (scalar: number) => {
      confetti({
        particleCount: Math.floor(55 * scalar),
        spread: 62,
        startVelocity: 38,
        origin: { x: 0.25, y: 0.55 },
        zIndex,
        colors: ["#22c55e", "#eab308", "#38bdf8", "#a855f7", "#f97316"],
      });
      confetti({
        particleCount: Math.floor(55 * scalar),
        spread: 62,
        startVelocity: 38,
        origin: { x: 0.75, y: 0.55 },
        zIndex,
        colors: ["#22c55e", "#eab308", "#38bdf8", "#a855f7", "#f97316"],
      });
    };
    burst(1);
    window.setTimeout(() => burst(0.65), 180);
  });
}

function QuestSuccessRings({ className }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none text-primary", className)}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden
    >
      <circle
        cx="100"
        cy="100"
        r="78"
        stroke="currentColor"
        strokeWidth="1.5"
        className="origin-center opacity-0 [animation:quest-ring-pop_0.9s_cubic-bezier(0.22,1,0.36,1)_0.05s_forwards]"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <circle
        cx="100"
        cy="100"
        r="62"
        stroke="currentColor"
        strokeWidth="2"
        className="origin-center opacity-0 [animation:quest-ring-pop_0.85s_cubic-bezier(0.22,1,0.36,1)_0.12s_forwards]"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <path
        d="M68 102 L88 122 L132 78"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-0 [animation:quest-check-reveal_0.55s_cubic-bezier(0.22,1,0.36,1)_0.35s_forwards]"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
      />
    </svg>
  );
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
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && quest && !prevOpenRef.current) {
      fireQuestConfetti();
    }
    prevOpenRef.current = open;
  }, [open, quest]);

  const xp = quest ? Number(quest.expAmount) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={quest?._id ?? "idle"}
        className="overflow-hidden border-primary/20 sm:max-w-md"
        showCloseButton
      >
        {quest ? (
          <>
            <div className="relative mx-auto flex w-full max-w-[220px] flex-col items-center gap-4 py-2">
              <div className="relative flex size-[200px] items-center justify-center">
                <QuestSuccessRings className="absolute size-[200px] opacity-40" />
                <div className="relative z-[1] rounded-xl border border-primary/15 bg-muted/40 p-3 shadow-sm ring-2 ring-primary/10">
                  <QuestVisual
                    iconImageUrl={quest.iconImageUrl}
                    iconSvg={quest.iconSvg}
                    size="xl"
                  />
                </div>
              </div>
            </div>
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle className="text-xl font-semibold">
                Quest complete
              </DialogTitle>
              <DialogDescription asChild>
                <p className="text-base text-foreground">
                  <span className="font-medium text-foreground">
                    {quest.questName}
                  </span>
                </p>
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-1">
              <p
                className="text-3xl font-bold tabular-nums tracking-tight text-primary [animation:quest-xp-pop_0.65s_cubic-bezier(0.34,1.56,0.64,1)_0.2s_both]"
              >
                +{xp} XP
              </p>
              <p className="text-sm text-muted-foreground">
                Added to your profile
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Nice
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
