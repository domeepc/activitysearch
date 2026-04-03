"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, Wallet, X, AlertCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PaymentButton } from "@/components/payments/PaymentButton";
import { PaymentDialog } from "@/components/payments/PaymentDialog";
import { ReviewDialog } from "@/components/reservations/ReviewDialog";
import { useCancelReservation } from "@/lib/hooks/useReservations";
import { cn } from "@/lib/utils";

interface ReservationCardProps {
  reservationId: Id<"reservations">;
}

export function ReservationCard({ reservationId }: ReservationCardProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [loyaltyPointsInput, setLoyaltyPointsInput] = useState("");
  const [loyaltyRedeeming, setLoyaltyRedeeming] = useState(false);
  const { cancelReservation, isPending } = useCancelReservation();
  const reservationData = useQuery(api.reservations.getReservationCardData, {
    reservationId,
  });
  const loyaltyBalance = useQuery(api.loyalty.getMyLoyaltyBalance, {});
  const redeemLoyalty = useMutation(api.loyalty.redeemLoyaltyPointsForReservation);

  if (reservationData === undefined) {
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

  if (reservationData === null) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Reservation not found</p>
        </CardContent>
      </Card>
    );
  }

  const { isTeamCreator, reservation, activity, paymentProgress, participants, canLeaveReview } =
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
        return { text: "Payment Fulfilled", variant: "default" as const, className: "bg-green-500" as const };
      case "cancelled":
        return { text: "Cancelled", variant: "destructive" as const };
      default:
        return { text: "Payment Pending", variant: "outline" as const };
    }
  };

  const statusBadge = getStatusBadge();
  const pp = paymentProgress as typeof paymentProgress & {
    listPrice?: number;
    loyaltyDiscountTotal?: number;
  };
  const listPrice =
    typeof pp.listPrice === "number" ? pp.listPrice : paymentProgress.totalAmount;
  const loyaltyDiscountTotal =
    typeof pp.loyaltyDiscountTotal === "number" ? pp.loyaltyDiscountTotal : 0;

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

  const handleCancelConfirm = async () => {
    if (!cancellationReason.trim()) return;
    try {
      const result = await cancelReservation(reservationId, cancellationReason.trim());
      setCancelDialogOpen(false);
      setCancellationReason("");
      toast.success("Reservation cancelled.");
      if (result.autoAssigned) {
        toast.info("The first team in queue has been assigned the freed slot.");
      } else if (result.queueNotified) {
        toast.info("The first team in queue has been notified.");
      }
    } catch (error) {
      console.error("Failed to cancel reservation:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel reservation"
      );
    }
  };

  return (
    <Card className="w-full md:w-full sm:w-3/4 lg:w-2/3 xl:w-1/3 overflow-hidden border-border border-2 shadow-xl">
      <CardHeader className="pb-3 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h3 className="text-base sm:text-lg font-semibold leading-tight">
            {activity.activityName}
          </h3>
          <Badge variant={statusBadge.variant} className={cn(statusBadge.className, "w-fit")}>
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
              Saldo collected
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
            {loyaltyDiscountTotal > 0 && (
              <p className="text-xs font-medium text-green-700 dark:text-green-400">
                Loyalty discount applied: −{formatCurrency(loyaltyDiscountTotal)}{" "}
                (list {formatCurrency(listPrice)})
              </p>
            )}
          </div>
        </div>

        {status === "pending" &&
          paymentProgress.collectedAmount === 0 &&
          loyaltyDiscountTotal === 0 &&
          loyaltyBalance !== undefined &&
          loyaltyBalance !== null && (
            <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
              <p className="text-xs font-medium">Use loyalty points</p>
              <p className="text-[11px] text-muted-foreground">
                Balance: {loyaltyBalance.balance} pts · 10 pts ≈ €1 off · max{" "}
                {formatCurrency(listPrice * 0.2)} off (20% of activity price).
                Apply before anyone pays on this reservation.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`loyalty-${reservationId}`} className="text-xs">
                    Points to spend
                  </Label>
                  <Input
                    id={`loyalty-${reservationId}`}
                    type="number"
                    min={10}
                    step={1}
                    value={loyaltyPointsInput}
                    onChange={(e) => setLoyaltyPointsInput(e.target.value)}
                    placeholder="e.g. 100"
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={
                    loyaltyRedeeming ||
                    !loyaltyPointsInput ||
                    Number(loyaltyPointsInput) < 10
                  }
                  onClick={async () => {
                    const n = Math.floor(Number(loyaltyPointsInput));
                    if (n < 10) return;
                    setLoyaltyRedeeming(true);
                    try {
                      const r = await redeemLoyalty({
                        reservationId,
                        pointsToSpend: n,
                      });
                      setLoyaltyPointsInput("");
                      toast.success(
                        `Saved ${formatCurrency(r.discount)} with ${r.pointsUsed} points`
                      );
                    } catch (e) {
                      const msg =
                        e instanceof ConvexError
                          ? typeof e.data === "string"
                            ? e.data
                            : JSON.stringify(e.data)
                          : e instanceof Error
                            ? e.message
                            : "Could not redeem points";
                      toast.error(msg);
                    } finally {
                      setLoyaltyRedeeming(false);
                    }
                  }}
                >
                  {loyaltyRedeeming ? "Applying…" : "Apply discount"}
                </Button>
              </div>
            </div>
          )}

        {/* Payment Button */}
        {paymentProgress.remainingAmount > 0 && status !== "cancelled" && (
          <div className="pt-2">
            <PaymentButton
              paymentStatus={status}
              remainingAmount={paymentProgress.remainingAmount}
              onPaymentClick={() => setPaymentDialogOpen(true)}
              disabled={status === "fulfilled"}
            />
          </div>
        )}

        {/* Leave a review (fulfilled + paid, participant, not yet reviewed) */}
        {canLeaveReview && (
          <div className="pt-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => setReviewDialogOpen(true)}
            >
              <Star className="h-4 w-4 mr-2" />
              Leave a review
            </Button>
          </div>
        )}

        {/* Cancel Reservation (team creator only) */}
        {isTeamCreator && status !== "cancelled" && status !== "fulfilled" && (
          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => {
                setCancellationReason("");
                setCancelDialogOpen(true);
              }}
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Reservation
            </Button>
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

      {/* Review Dialog */}
      <ReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        activityId={activity._id}
        activityName={activity.activityName}
        onSuccess={() => { }}
      />

      {/* Cancel Reservation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Reservation</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this reservation. All
              payments will be refunded and the first team in the queue will be
              notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium">Activity: </span>
                <span className="text-sm">{activity.activityName}</span>
              </div>
              <div>
                <span className="text-sm font-medium">Date: </span>
                <span className="text-sm">
                  {formattedDate} at {timeRange}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancellationReason">
                Cancellation Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cancellationReason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter the reason for cancelling this reservation..."
                className="min-h-[100px]"
                required
              />
              {!cancellationReason.trim() && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Cancellation reason is required
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="border-border w-full sm:w-auto"
              onClick={() => {
                setCancelDialogOpen(false);
                setCancellationReason("");
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={isPending || !cancellationReason.trim()}
              className="w-full sm:w-auto"
            >
              {isPending ? "Cancelling..." : "Cancel Reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
