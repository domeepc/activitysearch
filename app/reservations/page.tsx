"use client";

import { useOrganizerReservations, useUnreadReservationCount, useMarkReservationsAsRead } from "@/lib/hooks/useReservations";
import { ReservationTable } from "@/components/reservations/ReservationTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, Filter } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { useOrganizer } from "@/lib/hooks/useOrganizer";
import { useRouter } from "next/navigation";

type StatusFilter = "all" | "active" | "cancelled";

export default function ReservationsPage() {
  const { isOrganizer } = useOrganizer();
  const { reservations, isLoading } = useOrganizerReservations();
  const { count: unreadCount } = useUnreadReservationCount();
  const { markReservationsAsRead } = useMarkReservationsAsRead();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const router = useRouter();
  const hasMarkedAsRead = useRef(false);

  // Mark reservations as read when page loads (only once)
  useEffect(() => {
    if (isOrganizer && !isLoading && !hasMarkedAsRead.current) {
      hasMarkedAsRead.current = true;
      markReservationsAsRead().catch(console.error);
    }
  }, [isOrganizer, isLoading, markReservationsAsRead]);

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

  if (!isOrganizer) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You must be an organizer to view reservations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Inbox className="h-5 w-5 sm:h-6 sm:w-6" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 h-4 w-4 sm:h-5 sm:w-5 rounded-full p-0 flex items-center justify-center text-[10px] sm:text-xs"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Reservations</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage activity reservations
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("all")}
          className="gap-1 sm:gap-2 text-xs sm:text-sm"
        >
          <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">All</span>
          <span className="sm:hidden">All</span>
          <span className="ml-1">({reservations.length})</span>
        </Button>
        <Button
          variant={statusFilter === "active" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("active")}
          className="text-xs sm:text-sm"
        >
          Active ({reservations.filter((r) => !r.cancelledAt).length})
        </Button>
        <Button
          variant={statusFilter === "cancelled" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("cancelled")}
          className="text-xs sm:text-sm"
        >
          Cancelled ({reservations.filter((r) => !!r.cancelledAt).length})
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Loading reservations...</p>
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
    </div>
  );
}
