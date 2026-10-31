"use client";

import { CalendarDays, Phone } from "lucide-react";
import { format } from "date-fns";

interface ProfileInfoProps {
  description: string;
  contact?: string;
  joinedAt?: number;
  isOwnProfile: boolean;
  children?: React.ReactNode;
}

/** "About" card: bio, contact and member-since. */
export function ProfileInfo({ description, contact, joinedAt, isOwnProfile, children }: ProfileInfoProps) {
  return (
    <section aria-labelledby="about-h" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 id="about-h" className="text-[15px] font-bold">About</h2>
      <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
        {description || (
          <span className="text-zinc-500">{isOwnProfile ? "Add a short bio in settings so friends know what you're into." : "No bio yet."}</span>
        )}
      </p>
      <div className="flex flex-col gap-2 text-[13px] text-zinc-700 dark:text-zinc-300">
        {contact ? (
          <span className="flex items-center gap-2">
            <Phone className="size-[15px] text-zinc-500" aria-hidden="true" />
            {contact}
          </span>
        ) : null}
        {joinedAt ? (
          <span className="flex items-center gap-2">
            <CalendarDays className="size-[15px] text-zinc-500" aria-hidden="true" />
            Joined {format(joinedAt, "MMMM yyyy")}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
