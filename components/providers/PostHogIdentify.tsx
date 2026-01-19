"use client";

import { useUser } from "@clerk/nextjs";
import { usePostHog } from "@posthog/react";
import { useEffect } from "react";

export function PostHogIdentify() {
  const { user } = useUser();
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog && user?.id) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
      });
    }
  }, [posthog, user?.id, user?.primaryEmailAddress?.emailAddress]);

  return null;
}
