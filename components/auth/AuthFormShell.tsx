"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type AuthVariant = "signin" | "signup" | "organiser";

const PANEL_COPY: Record<
  AuthVariant,
  { title: React.ReactNode; perks: string[] }
> = {
  signin: {
    title: (
      <>
        Your crew is <span className="font-display font-normal italic text-blue-400">waiting</span>.
      </>
    ),
    perks: [
      "Pick up your reservations and team chats",
      "Pay your share in a couple of taps",
      "Keep your quest streak going",
    ],
  },
  signup: {
    title: (
      <>
        Plan less. <span className="font-display font-normal italic text-blue-400">Play more.</span>
      </>
    ),
    perks: [
      "Find activities near you on a live map",
      "Reserve as a team and split the bill",
      "Earn XP and loyalty points every time you go",
    ],
  },
  organiser: {
    title: (
      <>
        Fill every slot, <span className="font-display font-normal italic text-blue-400">get paid</span> on time.
      </>
    ),
    perks: [
      "Publish activities on the map in minutes",
      "Teams pay their shares; payouts through Stripe Connect",
      "Create quests to bring people back",
    ],
  },
};

const PANEL_PHOTOS = [
  "/images/outdoor-pursuit.jpg",
  "/images/team_sports.jpg",
  "/images/high-energy.jpg",
];

interface AuthFormShellProps {
  children: React.ReactNode;
  variant?: AuthVariant;
  cardClassName?: string;
  containerClassName?: string;
}

export function AuthFormShell({
  children,
  variant = "signup",
  cardClassName,
  containerClassName,
}: AuthFormShellProps) {
  const copy = PANEL_COPY[variant];

  return (
    // Desktop: exactly one screen tall; the form column scrolls on its own, so the
    // page-level scroll lock (NoScrollWrapper) can never cut anything off.
    <div className="auth-shell flex min-h-screen bg-background lg:h-screen lg:min-h-0 lg:overflow-hidden">
      {/* Brand panel — desktop only; sign-in mirrors it to the right */}
      <aside
        className={cn(
          "relative m-3 hidden shrink-0 flex-col justify-between gap-8 overflow-hidden rounded-3xl bg-zinc-950 p-10 text-zinc-50 lg:flex lg:w-[42%] xl:p-12",
          variant === "signin" && "lg:order-last"
        )}
      >
        <Link href="/" aria-label="ActivitySearch home" className="relative z-10 self-start">
          <Image src="/full-logo-dark.svg" alt="ActivitySearch" width={132} height={32} priority />
        </Link>

        <div className="relative z-10 flex flex-col gap-6">
          <h2 className="text-[clamp(2.25rem,3.4vw,3rem)] font-bold leading-[1.02] tracking-[-0.045em]">
            {copy.title}
          </h2>
          <ul className="flex flex-col gap-3 text-[15px] text-zinc-300">
            {copy.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-[18px] shrink-0 text-blue-400" strokeWidth={2.5} aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden="true" className="relative z-10 grid grid-cols-3 items-end gap-2.5">
          {PANEL_PHOTOS.map((src, i) => (
            <div
              key={src}
              className={cn(
                "relative overflow-hidden rounded-2xl bg-zinc-800",
                i === 1 ? "h-36 xl:h-44" : i === 0 ? "h-28 xl:h-36" : "h-24 xl:h-28"
              )}
            >
              <Image src={src} alt="" fill sizes="14vw" className="object-cover" />
            </div>
          ))}
        </div>
      </aside>

      {/* Form panel */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center overflow-y-auto bg-background px-5 py-10 sm:px-8",
          containerClassName
        )}
      >
        <Link href="/" aria-label="ActivitySearch home" className="mb-8 flex w-full max-w-[400px] lg:hidden">
          <Image src="/full-logo.svg" alt="ActivitySearch" width={132} height={32} className="dark:hidden" priority />
          <Image src="/full-logo-dark.svg" alt="ActivitySearch" width={132} height={32} className="hidden dark:block" priority />
        </Link>

        <div className={cn("my-auto w-full max-w-[400px]", cardClassName)}>
          <Card className="gap-5 border-0 bg-transparent p-0 shadow-none">{children}</Card>
        </div>
      </div>
    </div>
  );
}

export const authFormStyles = {
  header: "space-y-1.5 px-0",
  title: "text-[30px] font-bold leading-tight tracking-[-0.03em]",
  description: "text-[15px] text-muted-foreground",
  content: "space-y-4 px-0",
  footer: "flex flex-col items-start space-y-2.5 px-0",
  sectionTitle: "text-xs uppercase tracking-widest text-muted-foreground",
  error: "rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive",
};
