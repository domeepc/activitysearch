import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { LandingPage } from "../components/landing/LandingPage";

type Showcase = FunctionReturnType<typeof api.landing.showcase>;

// Signed-in visitors are redirected to /home in proxy.ts, so this page stays static,
// re-rendered at most hourly with fresh activities, quests and reviews.
export const revalidate = 3600;

// Convex's HTTP query API with a cacheable fetch: fetchQuery always uses no-store, which would make this page dynamic
async function loadShowcase(): Promise<Showcase | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "landing:showcase", args: {}, format: "json" }),
      next: { revalidate },
    });
    const body = await res.json();
    if (body.status !== "success") throw new Error(body.errorMessage ?? `HTTP ${res.status}`);
    return body.value as Showcase;
  } catch (error) {
    console.error("Landing showcase unavailable, showing sample content:", error);
    return null;
  }
}

export default async function Page() {
  return <LandingPage showcase={await loadShowcase()} />;
}
