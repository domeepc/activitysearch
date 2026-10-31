import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { LandingPage } from "../components/landing/LandingPage";

// Signed-in visitors are redirected to /home in proxy.ts, so this page stays static,
// re-rendered at most every 5 minutes, so new activities, quests and reviews show up quickly.
export const revalidate = 3600;

async function loadShowcase() {
  try {
    // Convex's client validates the deployment URL; the custom fetch only adds caching
    // (convex/nextjs fetchQuery is always no-store, which would make this page dynamic)
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
      fetch: (input, init) => fetch(input, { ...init, next: { revalidate } }),
    });
    return await client.query(api.landing.showcase, {});
  } catch (error) {
    console.error("Landing showcase unavailable, showing sample content:", error);
    return null;
  }
}

export default async function Page() {
  return <LandingPage showcase={await loadShowcase()} />;
}
