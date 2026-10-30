"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CreditCard, Inbox, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadReservationCount } from "@/lib/hooks/useReservations";

/** Shared tab bar for the organiser area: Overview · Reservations · Payments. */
export function OrganiserNav() {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const { count: unread } = useUnreadReservationCount();

  const tabs = [
    { href: "/my-organisation", label: "Overview", icon: LayoutDashboard, active: pathname === "/my-organisation", badge: 0 },
    { href: "/reservations", label: "Reservations", icon: Inbox, active: pathname === "/reservations" && view !== "payments", badge: unread },
    { href: "/reservations?view=payments", label: "Payments", icon: CreditCard, active: pathname === "/reservations" && view === "payments", badge: 0 },
  ];

  return (
    <nav aria-label="Organiser" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
      {tabs.map(({ href, label, icon: Icon, active, badge }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
            active
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
          {badge > 0 ? (
            <span className="min-w-5 rounded-full bg-blue-600 px-1.5 text-center text-[11px] font-bold leading-5 text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
