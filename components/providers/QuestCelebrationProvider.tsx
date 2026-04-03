"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { QuestCompletionCelebrationDialog } from "@/components/quests/QuestCompletionCelebrationDialog";

type QuestEntry = {
  quest: Doc<"quests">;
  completed: boolean;
  completedAt?: number;
};

/** Completions in this window still get a one-time celebration on first app load (e.g. account signup). */
const RECENT_COMPLETION_BOOTSTRAP_MS = 30 * 60 * 1000;

function bootstrapCelebrationStorageKey(
  viewerId: Id<"users">,
  questId: string,
  completedAt: number
) {
  return `qc_celebrate_boot:${viewerId}:${questId}:${completedAt}`;
}

function flattenOverviewQuests(overview: {
  systemQuests: QuestEntry[];
  activityQuests: Array<{ quests: QuestEntry[] }>;
}): QuestEntry[] {
  const out = [...overview.systemQuests];
  for (const g of overview.activityQuests) {
    out.push(...g.quests);
  }
  return out;
}

const CLOSE_MS = 240;

export function QuestCelebrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useConvexAuth();
  const overview = useQuery(
    api.quests.myQuestsOverview,
    isAuthenticated ? {} : "skip"
  );

  const prevCompletedRef = useRef<Set<string> | null>(null);
  const queueRef = useRef<Doc<"quests">[]>([]);
  const dialogOpenRef = useRef(false);
  const activeQuestRef = useRef<Doc<"quests"> | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeQuest, setActiveQuest] = useState<Doc<"quests"> | null>(null);

  useEffect(() => {
    dialogOpenRef.current = dialogOpen;
  }, [dialogOpen]);
  useEffect(() => {
    activeQuestRef.current = activeQuest;
  }, [activeQuest]);

  const enqueue = useCallback((quest: Doc<"quests">) => {
    if (dialogOpenRef.current && activeQuestRef.current) {
      queueRef.current.push(quest);
      return;
    }
    setActiveQuest(quest);
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      prevCompletedRef.current = null;
      queueRef.current = [];
      queueMicrotask(() => {
        setDialogOpen(false);
        setActiveQuest(null);
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || overview === undefined) return;

    const entries = flattenOverviewQuests(overview);
    const completed = new Set(
      entries.filter((e) => e.completed).map((e) => e.quest._id.toString())
    );

    if (prevCompletedRef.current === null) {
      const now = Date.now();
      const viewerId = overview.viewerId;
      if (viewerId) {
        for (const e of entries) {
          if (!e.completed || e.completedAt === undefined) continue;
          if (now - e.completedAt > RECENT_COMPLETION_BOOTSTRAP_MS) continue;
          const key = bootstrapCelebrationStorageKey(
            viewerId,
            e.quest._id.toString(),
            e.completedAt
          );
          try {
            if (globalThis.sessionStorage?.getItem(key) === "1") continue;
          } catch {
            /* private mode */
          }
          queueMicrotask(() => {
            enqueue(e.quest);
          });
          try {
            globalThis.sessionStorage?.setItem(key, "1");
          } catch {
            /* ignore */
          }
        }
      }
      prevCompletedRef.current = completed;
      return;
    }

    const newlyCompleted: Doc<"quests">[] = [];
    for (const id of completed) {
      if (!prevCompletedRef.current.has(id)) {
        const row = entries.find(
          (e) => e.quest._id.toString() === id && e.completed
        );
        if (row) newlyCompleted.push(row.quest);
      }
    }

    prevCompletedRef.current = completed;

    for (const q of newlyCompleted) {
      queueMicrotask(() => {
        enqueue(q);
      });
    }
  }, [overview, isAuthenticated, enqueue]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setDialogOpen(true);
      return;
    }
    setDialogOpen(false);
    window.setTimeout(() => {
      const next = queueRef.current.shift();
      if (next) {
        setActiveQuest(next);
        setDialogOpen(true);
      } else {
        setActiveQuest(null);
      }
    }, CLOSE_MS);
  }, []);

  return (
    <>
      {children}
      <QuestCompletionCelebrationDialog
        quest={activeQuest}
        open={dialogOpen && activeQuest !== null}
        onOpenChange={handleOpenChange}
      />
    </>
  );
}
