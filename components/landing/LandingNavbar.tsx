"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? "bg-white border-b border-zinc-200 shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="text-lg font-semibold text-zinc-900">
          ActivitySearch
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            Sign in
          </Link>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
