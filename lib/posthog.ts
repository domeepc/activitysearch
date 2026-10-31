import type { PostHog } from "posthog-js";

// posthog-js is ~100 KB gzipped, so it is loaded on first use instead of in every page bundle.
let loading: Promise<PostHog | null> | null = null;

export function loadPostHog(): Promise<PostHog | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return Promise.resolve(null);

  loading ??= import("posthog-js").then(({ default: posthog }) => {
    const base = (process.env.NEXT_PUBLIC_POSTHOG_HOST || window.location.origin).replace(/\/$/, "");
    // Direct PostHog hosts are used as-is; anything else goes through the /ingest rewrite.
    const api_host = /\.posthog\.com$/i.test(new URL(base).hostname) ? base : `${base}/ingest`;
    posthog.init(key, { person_profiles: "identified_only", api_host });
    return posthog;
  });
  return loading;
}

export function capture(event: string, properties?: Record<string, unknown>) {
  void loadPostHog().then((posthog) => posthog?.capture(event, properties));
}
