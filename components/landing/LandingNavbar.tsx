"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
        scrolled ? "bg-background border-b border-border shadow-sm" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/full-logo.svg"
            alt="ActivitySearch"
            width={120}
            height={30}
            className="hidden md:block"
            priority
          />
          <Image
            src="/mobile-logo.svg"
            alt="ActivitySearch"
            width={32}
            height={32}
            className="block md:hidden"
            priority
          />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/sign-up">Sign up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
