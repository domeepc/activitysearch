"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ marginBottom: "1rem" }}>Something went wrong</h1>
          <p style={{ marginBottom: "1.5rem", color: "#666" }}>
            An unexpected error occurred. We have been notified.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "1rem",
              cursor: "pointer",
              backgroundColor: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "0.25rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
