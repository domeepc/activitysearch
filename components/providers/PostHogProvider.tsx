"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "@posthog/react";
import { useEffect, type ReactNode } from "react";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key) {
      const base =
        process.env.NEXT_PUBLIC_POSTHOG_HOST ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const isPostHogHost = /\.posthog\.com$/i.test(new URL(base || "https://x").hostname);
      const api_host = base
        ? isPostHogHost
          ? base.replace(/\/$/, "")
          : `${base.replace(/\/$/, "")}/ingest`
        : undefined;
      posthog.init(key, {
        person_profiles: "identified_only",
        ...(api_host && { api_host }),
      });
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
