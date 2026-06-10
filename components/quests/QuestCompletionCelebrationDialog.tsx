"use client";

import { useEffect, useRef } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuestVisual } from "@/components/quests/QuestVisual";

function fireQuestConfetti() {
  void import("canvas-confetti").then(({ default: confetti }) => {
    const zIndex = 10000;
    const burst = (scalar: number, delay: number) =>
      window.setTimeout(() => {
        confetti({
          particleCount: Math.floor(70 * scalar),
          spread: 80,
          startVelocity: 42,
          origin: { x: 0.2, y: 0.5 },
          zIndex,
          colors: ["#22c55e", "#eab308", "#38bdf8", "#a855f7", "#f97316", "#ec4899"],
        });
        confetti({
          particleCount: Math.floor(70 * scalar),
          spread: 80,
          startVelocity: 42,
          origin: { x: 0.8, y: 0.5 },
          zIndex,
          colors: ["#22c55e", "#eab308", "#38bdf8", "#a855f7", "#f97316", "#ec4899"],
        });
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
        className="overflow-hidden sm:max-w-sm"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Quest Complete</DialogTitle>
        {quest ? (
          <div className="relative flex flex-col items-center">
            {/* Top strip label */}
            <div className="w-full flex items-center justify-center pb-2">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/70">
                Quest Complete
              </span>
            </div>

            {/* Badge area */}
            <div className="flex flex-col items-center px-8 pb-2 pt-4">
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute rounded-full border border-primary/30"
                  style={{
                    width: 148,
                    height: 148,
                    animation: "quest-outer-ring 1.1s cubic-bezier(0.22,1,0.36,1) forwards",
                    opacity: 0,
                  }}
                />
                <div
                  className="absolute rounded-full border-2 border-primary/50"
                  style={{
                    width: 124,
                    height: 124,
                    animation: "quest-inner-ring 0.9s cubic-bezier(0.22,1,0.36,1) 0.08s forwards",
                    opacity: 0,
                  }}
                />
                <div
                  className="relative rounded-2xl p-4 bg-muted border border-border shadow-lg"
                  style={{
                    animation: "quest-badge-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.15s both",
                  }}
                >
                  <QuestVisual
                    iconImageUrl={quest.iconImageUrl}
                    iconSvg={quest.iconSvg}
                    size="xl"
                  />
                </div>
              </div>
            </div>

            {/* Quest name */}
            <div className="px-8 pt-4 text-center">
              <p className="text-lg font-bold leading-tight">{quest.questName}</p>
              {quest.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{quest.description}</p>
              )}
            </div>

            {/* XP reward */}
            <div
              className="mt-5 flex items-center gap-2 rounded-full px-5 py-2 bg-primary/10 border border-primary/25"
              style={{
                animation: "quest-xp-pop 0.65s cubic-bezier(0.34,1.56,0.64,1) 0.3s both",
              }}
            >
              <span className="text-2xl font-black tabular-nums text-primary">+{xp}</span>
              <span className="text-sm font-semibold text-primary/80 uppercase tracking-wider">XP</span>
            </div>

            {/* CTA */}
            <div className="w-full px-8 py-6 mt-2">
              <Button
                type="button"
                className="w-full font-semibold rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                Awesome!
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
