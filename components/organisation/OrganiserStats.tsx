"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { CalendarClock, LayoutGrid, MessageSquareText, Star } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useOrganiserReservations } from "@/lib/hooks/useReservations";

/** Headline numbers for the organiser overview. */
export function OrganiserStats({ activityIDs }: { activityIDs: Id<"activities">[] }) {
  const activities = useQuery(
    api.activity.getActivitiesByIds,
    activityIDs.length > 0 ? { activityIds: activityIDs } : "skip"
  );
  const { reservations, isLoading } = useOrganiserReservations();

  const stats = useMemo(() => {
    const docs = activities ?? [];
    const reviews = docs.reduce((sum, a) => sum + Number(a.reviewCount ?? 0), 0);
    const weighted = docs.reduce((sum, a) => sum + (a.rating ?? 0) * Number(a.reviewCount ?? 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = reservations.filter((r) => !r.cancelledAt && r.date >= today).length;
    return {
      activities: activityIDs.length,
      upcoming,
      rating: reviews > 0 ? (weighted / reviews).toFixed(1) : "—",
      reviews,
    };
  }, [activities, reservations, activityIDs.length]);

  const cards = [
    { label: "Activities", value: stats.activities, icon: LayoutGrid },
    { label: "Upcoming reservations", value: isLoading ? "…" : stats.upcoming, icon: CalendarClock },
    { label: "Average rating", value: stats.rating, icon: Star },
    { label: "Reviews", value: stats.reviews, icon: MessageSquareText },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-5 shadow-sm dark:bg-zinc-900">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </dt>
          <dd className="text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
