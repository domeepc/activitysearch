"use client";

import { useOrganiserReservations, useMarkReservationsAsRead } from "@/lib/hooks/useReservations";
import { ReservationTable } from "@/components/reservations/ReservationTable";
import { StripeDashboard } from "@/components/reservations/StripeDashboard";
import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrganiserNav } from "@/components/organisation/OrganiserNav";
import { useOrganiser } from "@/lib/hooks/useOrganiser";

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
  const viewMode: ViewMode = useSearchParams().get("view") === "payments" ? "payments" : "reservations";
  const hasMarkedAsRead = useRef(false);

  // Mark reservations as read when page loads (only once)
  useEffect(() => {
    if (isOrganiser && !isLoading && !hasMarkedAsRead.current) {
      hasMarkedAsRead.current = true;
      markReservationsAsRead().catch(console.error);
    }
  }, [isOrganiser, isLoading, markReservationsAsRead]);

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

      {viewMode === "reservations" && (
        <ReservationTable reservations={reservations} isLoading={isLoading} />
      )}

      {/* Payments View */}
      {viewMode === "payments" && <StripeDashboard />}
    </div>
  );
}
