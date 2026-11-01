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
    <nav aria-label="Organiser" className="grid w-full grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 sm:flex sm:w-fit dark:bg-zinc-800">
      {tabs.map(({ href, label, icon: Icon, active, badge }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-9 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[13px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm",
            active
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
          <span className="truncate">{label}</span>
          {badge > 0 ? (
            <span className="min-w-5 shrink-0 rounded-full bg-blue-600 px-2 text-center text-[11px] font-bold leading-5 text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
