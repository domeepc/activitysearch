"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { loadPostHog } from "@/lib/posthog";

/** Starts PostHog once the page is idle and identifies the signed-in user. */
export function PostHogProvider() {
  const { user } = useUser();
  const userId = user?.id;
  const email = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    const start = () => void loadPostHog();
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 2000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadPostHog().then((posthog) => posthog?.identify(userId, { email }));
  }, [userId, email]);

  return null;
}
