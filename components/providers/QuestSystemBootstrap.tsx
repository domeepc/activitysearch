"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/** Ensures built-in system quests exist (idempotent). Runs once per session when signed in. */
export function QuestSystemBootstrap() {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.quests.ensureSystemQuests);
  const ran = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || ran.current) return;
    ran.current = true;
    ensure({}).catch(() => {
      ran.current = false;
    });
  }, [isAuthenticated, ensure]);

  return null;
}
