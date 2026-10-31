import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts"],
    // stripe.ts throws on import without a key; tests never call Stripe.
    env: { STRIPE_SECRET_KEY: "sk_test_dummy" },
  },
});
