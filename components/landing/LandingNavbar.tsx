"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
        "fixed inset-x-0 top-0 z-50 transition-colors duration-200",
        scrolled ? "border-b border-zinc-800 bg-zinc-950/85 backdrop-blur" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-6 px-4 md:px-10">
        <Link href="/" className="flex items-center" aria-label="ActivitySearch home">
          <Image
            src="/full-logo-dark.svg"
            alt="ActivitySearch"
            width={132}
            height={32}
            className="hidden md:block"
            priority
          />
          <Image
            src="/mobile-logo-dark.svg"
            alt="ActivitySearch"
            width={32}
            height={32}
            className="md:hidden"
            priority
          />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <a href="#explore" className="transition-colors hover:text-zinc-50">Explore</a>
          <a href="#quests" className="transition-colors hover:text-zinc-50">Quests</a>
          <Link href="/sign-up/organisator-sign-up" className="transition-colors hover:text-zinc-50">
            For organisers
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center px-4 text-sm text-zinc-50 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-10 items-center rounded-full bg-zinc-50 px-5 text-sm font-semibold text-zinc-950 transition-transform hover:bg-white active:scale-[0.97]"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
