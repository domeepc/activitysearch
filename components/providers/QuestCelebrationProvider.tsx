"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { QuestCompletionCelebrationDialog } from "@/components/quests/QuestCompletionCelebrationDialog";
import { toast } from "sonner";

const CLOSE_MS = 240;

export function QuestCelebrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useConvexAuth();
  // The server remembers which completions were celebrated, so a popup shows once, on any tab or device
  const pending = useQuery(api.quests.pendingQuestCelebrations, isAuthenticated ? {} : "skip");
  const markCelebrated = useMutation(api.quests.markQuestCelebrated);

  const shownRef = useRef(new Set<string>());
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
      shownRef.current.clear();
      queueRef.current = [];
      queueMicrotask(() => {
        setDialogOpen(false);
        setActiveQuest(null);
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    for (const quest of pending ?? []) {
      // Until the server confirms, the query still lists it; don't queue it twice
      if (shownRef.current.has(quest._id)) continue;
      shownRef.current.add(quest._id);
      toast.success(`Quest complete: ${quest.questName}`, {
        description: `+${Number(quest.expAmount)} XP earned`,
      });
      queueMicrotask(() => enqueue(quest));
      markCelebrated({ questId: quest._id }).catch(() => shownRef.current.delete(quest._id));
    }
  }, [pending, enqueue, markCelebrated]);

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
