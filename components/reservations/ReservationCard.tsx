"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Clock, Wallet } from "lucide-react";
import { format } from "date-fns";
import { PaymentButton } from "@/components/payments/PaymentButton";
import { PaymentDialog } from "@/components/payments/PaymentDialog";

interface ReservationCardProps {
  reservationId: Id<"reservations">;
}

export function ReservationCard({ reservationId }: ReservationCardProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const reservationData = useQuery(api.reservations.getReservationCardData, {
    reservationId,
  });

  if (!reservationData) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Loading reservation...
          </p>
        </CardContent>
      </Card>
    );
  }

  const { reservation, activity, paymentProgress, participants } =
    reservationData;

  if (!reservation || !activity) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Reservation not found</p>
        </CardContent>
      </Card>
    );
  }

  // Check if cancelled - prioritize cancelledAt over paymentStatus
  const isCancelled = !!reservation.cancelledAt;
  const status = isCancelled ? "cancelled" : (reservation.paymentStatus || "pending");

  // Parse time - it might be in "HH:MM" format or already a range
  let activityDate: Date;
  let timeRange: string;

  if (reservation.time.includes("-")) {
    // Already a range, use the start time for the date
    const startTime = reservation.time.split("-")[0].trim();
    activityDate = new Date(`${reservation.date}T${startTime}`);
    timeRange = reservation.time;
  } else {
    // Single time, calculate end time from duration
    activityDate = new Date(`${reservation.date}T${reservation.time}`);
    // Convert BigInt to number for duration
    const durationMinutes = activity.duration ? Number(activity.duration) : 60;
    const endTime = new Date(activityDate.getTime() + durationMinutes * 60000);
    const startTimeStr = format(activityDate, "h:mm a");
    const endTimeStr = format(endTime, "h:mm a");
    timeRange = `${startTimeStr} - ${endTimeStr}`;
  }

  const formattedDate = format(activityDate, "EEE, MMM d, yyyy");

  // Status badge text and variant
  const getStatusBadge = () => {
    switch (status) {
      case "on_hold":
        return { text: "Payment On Hold", variant: "secondary" as const };
      case "fulfilled":
        return { text: "Payment Fulfilled", variant: "default" as const };
      case "cancelled":
        return { text: "Cancelled", variant: "destructive" as const };
      default:
        return { text: "Payment Pending", variant: "outline" as const };
    }
  };

  const statusBadge = getStatusBadge();
  const progressPercentage =
    paymentProgress.totalAmount > 0
      ? (paymentProgress.collectedAmount / paymentProgress.totalAmount) * 100
      : 0;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Get deadline text
  const getDeadlineText = () => {
    if (status === "cancelled") {
      return "Refunded";
    }
    if (status === "fulfilled") {
      return "Payment released";
    }
    if (status === "on_hold") {
      return `Held until ${formattedDate}`;
    }
    if (reservation.paymentDeadline) {
      const deadlineDate = new Date(reservation.paymentDeadline);
      return `Pay by ${format(deadlineDate, "MMM d, yyyy")}`;
    }
    return `Pay by ${formattedDate}`;
  };

  return (
    <Card className="w-full md:w-full sm:w-3/4 lg:w-2/3 xl:w-1/3 overflow-hidden border-border border-2 shadow-xl">
      <CardHeader className="pb-3 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h3 className="text-base sm:text-lg font-semibold leading-tight">
            {activity.activityName}
          </h3>
          <Badge variant={statusBadge.variant} className="w-fit">
            {statusBadge.text}
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
          {activity.description}
        </p>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
        {/* Date and Time */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="wrap-break-word">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="wrap-break-word">{timeRange}</span>
          </div>
        </div>

        {/* Payment Progress Section */}
        <div className="rounded-lg border border-border bg-muted/50 p-3 sm:p-4 space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              Soldo collected
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-base sm:text-lg font-semibold wrap-break-word">
                {formatCurrency(paymentProgress.collectedAmount)} /{" "}
                {formatCurrency(paymentProgress.totalAmount)}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-muted-foreground">
              <span className="wrap-break-word">
                {paymentProgress.personsPaidFor} of{" "}
                {paymentProgress.totalParticipants} paid (
                {formatCurrency(paymentProgress.perPersonAmount)} each)
              </span>
            </div>
            <div className="text-xs text-muted-foreground wrap-break-word">
              {getDeadlineText()}
            </div>
          </div>
        </div>

        {/* Payment Button */}
        {paymentProgress.remainingAmount > 0 && status !== "cancelled" && (
          <div className="pt-2">
            <PaymentButton
              reservationId={reservationId}
              paymentStatus={status}
              amount={paymentProgress.perPersonAmount}
              remainingAmount={paymentProgress.remainingAmount}
              onPaymentClick={() => setPaymentDialogOpen(true)}
              disabled={status === "fulfilled"}
            />
          </div>
        )}

        {/* Participants */}
        {participants.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex -space-x-2">
              {participants.slice(0, 4).map((participant) => (
                <Avatar
                  key={participant._id}
                  className="h-7 w-7 sm:h-8 sm:w-8 border-2 border-background"
                >
                  <AvatarImage
                    src={participant.avatar}
                    alt={participant.name}
                  />
                  <AvatarFallback className="text-xs">
                    {participant.name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
              {participants.length > 4 && (
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                  +{participants.length - 4}
                </div>
              )}
            </div>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {participants.length} participant
              {participants.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </CardContent>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        reservationId={reservationId}
        amount={paymentProgress.totalAmount}
        perPersonAmount={paymentProgress.perPersonAmount}
        remainingPersons={paymentProgress.remainingPersons}
        activityName={activity.activityName}
        onSuccess={() => {
          // Payment successful, dialog will close automatically
          // Data will refresh automatically via Convex reactivity
        }}
      />
    </Card>
  );
}
