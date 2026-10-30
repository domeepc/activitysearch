"use client";

import { useOrganiserReservations, useMarkReservationsAsRead } from "@/lib/hooks/useReservations";
import { ReservationTable } from "@/components/reservations/ReservationTable";
import { PaymentSection } from "@/components/reservations/PaymentSection";
import { Inbox, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrganiserNav } from "@/components/organisation/OrganiserNav";
import { useOrganiser } from "@/lib/hooks/useOrganiser";
import { Spinner } from "@/components/ui/spinner";

type StatusFilter = "all" | "active" | "cancelled";
type ViewMode = "reservations" | "payments";

export default function ReservationsPage() {
  return (
    <Suspense fallback={null}>
      <ReservationsContent />
    </Suspense>
  );
}

function ReservationsContent() {
  const { isOrganiser } = useOrganiser();
  const { reservations, isLoading } = useOrganiserReservations();
  const { markReservationsAsRead } = useMarkReservationsAsRead();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const viewMode: ViewMode = useSearchParams().get("view") === "payments" ? "payments" : "reservations";
  const hasMarkedAsRead = useRef(false);

  // Mark reservations as read when page loads (only once)
  useEffect(() => {
    if (isOrganiser && !isLoading && !hasMarkedAsRead.current) {
      hasMarkedAsRead.current = true;
      markReservationsAsRead().catch(console.error);
    }
  }, [isOrganiser, isLoading, markReservationsAsRead]);

  // Filter reservations by status
  const filteredReservations = useMemo(() => {
    if (statusFilter === "all") {
      return reservations;
    }
    if (statusFilter === "active") {
      return reservations.filter((r) => !r.cancelledAt);
    }
    if (statusFilter === "cancelled") {
      return reservations.filter((r) => !!r.cancelledAt);
    }
    return reservations;
  }, [reservations, statusFilter]);

  if (!isOrganiser) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You must be an organiser to view reservations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
      <OrganiserNav />
      <header>
        <p className="text-sm text-muted-foreground">Organiser dashboard</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {viewMode === "payments" ? "Payments & payouts" : "Reservations"}
        </h1>
      </header>

      {/* Reservations View */}
      {viewMode === "reservations" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "all" as const, label: "All", count: reservations.length },
              { key: "active" as const, label: "Active", count: reservations.filter((r) => !r.cancelledAt).length },
              { key: "cancelled" as const, label: "Cancelled", count: reservations.filter((r) => !!r.cancelledAt).length },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === key
                    ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-50"
                )}
              >
                {key === "all" && <Filter className="h-3 w-3" />}
                {label} ({count})
              </button>
            ))}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <ReservationTable reservations={filteredReservations} />
          )}

          {/* Empty state */}
          {!isLoading && filteredReservations.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>
                {statusFilter === "all"
                  ? "No reservations found"
                  : `No ${statusFilter} reservations found`}
              </p>
            </div>
          )}
        </>
      )}

      {/* Payments View */}
      {viewMode === "payments" && <PaymentSection />}
    </div>
  );
}
