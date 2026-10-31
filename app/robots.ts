import type { MetadataRoute } from "next";

// Only the marketing and legal pages are public; everything else needs a login.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/home",
        "/activities",
        "/chat",
        "/dashboard",
        "/my-organisation",
        "/profile",
        "/reservations",
        "/sso-callback",
        "/api",
        "/ingest",
        "/monitoring",
      ],
    },
  };
}
