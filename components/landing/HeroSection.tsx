"use client";

import { useRef, useCallback } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HeroSection() {
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (glowRef.current) {
        glowRef.current.style.left = `${x}px`;
        glowRef.current.style.top = `${y}px`;
      }
    },
    []
  );

  return (
    <section
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 pt-16"
      style={{
        backgroundImage:
          "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
      onMouseMove={handleMouseMove}
    >
      {/* cursor glow */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 h-[560px] w-[560px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.13) 0%, rgba(59,130,246,0.04) 45%, transparent 70%)",
          left: "50%",
          top: "50%",
        }}
      />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
        <Badge className="mb-6 rounded-full bg-blue-600 px-3 py-1 text-xs tracking-wide text-white">
          EASY TO EXPERIENCE
        </Badge>
        <h1 className="text-6xl font-bold leading-none tracking-tight text-zinc-900 md:text-8xl">
          Find activities{" "}
          <span className="text-blue-600">near you.</span>
        </h1>
        <p className="mt-6 max-w-lg text-base text-zinc-500">
          Discover sports and local activities, compare options, and book your
          next experience in a few taps.
        </p>
        <form
          action="/home"
          method="GET"
          className="mt-8 w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-3 shadow-md"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              name="q"
              placeholder="What are you looking for?"
              className="h-11 rounded-xl border-zinc-200"
            />
            <Button type="submit" className="h-11 rounded-xl px-6">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </form>
        <p className="mt-6 text-sm text-zinc-400">
          ★ 4.9 · 2,000+ activities · Trusted by local communities
        </p>
      </div>
    </section>
  );
}
