"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, Check, MoreHorizontal, Star, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PaymentDialog } from "@/components/payments/PaymentDialog";
import { ReviewDialog } from "@/components/reservations/ReviewDialog";
import { useCancelReservation } from "@/lib/hooks/useReservations";
import { cn, formatPrice } from "@/lib/utils";

type Status = "pending" | "on_hold" | "fulfilled" | "cancelled";

const STATUS_STYLES: Record<Status, { label: string; chip: string; bar: string }> = {
  pending: {
    label: "Pending",
    chip: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
    bar: "bg-orange-500",
  },
  on_hold: {
    label: "On hold",
    chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    bar: "bg-green-600",
  },
  fulfilled: {
    label: "Done",
    chip: "bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300",
    bar: "bg-green-600",
  },
  cancelled: {
    label: "Cancelled",
    chip: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    bar: "bg-zinc-400",
  },
};

function errorMessage(e: unknown, fallback: string) {
  if (e instanceof ConvexError) {
    return typeof e.data === "string" ? e.data : JSON.stringify(e.data);
  }
  return e instanceof Error ? e.message : fallback;
}

interface ReservationCardProps {
  reservationId: Id<"reservations">;
}

export function ReservationCard({ reservationId }: ReservationCardProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
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
      <div className="w-full max-w-[420px] animate-pulse rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex gap-3">
          <div className="size-16 shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-3 w-16 rounded-full bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-3/4 rounded-full bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-3 w-1/2 rounded-full bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  if (reservationData === null || !reservationData.reservation || !reservationData.activity) {
    return (
      <div className="w-full max-w-[420px] rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-muted-foreground dark:border-zinc-700">
        This reservation is no longer available.
      </div>
    );
  }

  const {
    isTeamCreator,
    hasPaid,
    reservation,
    activity,
    teams,
    paymentProgress,
    participants,
    canLeaveReview,
  } = reservationData;

  const status: Status = reservation.cancelledAt
    ? "cancelled"
    : (reservation.paymentStatus ?? "pending");
  const style = STATUS_STYLES[status];

  // Time is either "HH:MM" or already a "HH:MM-HH:MM" range.
  const startTime = reservation.time.split("-")[0].trim();
  const activityDate = new Date(`${reservation.date}T${startTime}`);
  const dateLabel = format(activityDate, "EEE, d MMM");
  let timeLabel = reservation.time.replace(/\s*-\s*/, "–");
  if (!reservation.time.includes("-")) {
    const minutes = activity.duration ? Number(activity.duration) : 60;
    const end = new Date(activityDate.getTime() + minutes * 60000);
    timeLabel = `${format(activityDate, "HH:mm")}–${format(end, "HH:mm")}`;
  }

  const loyaltyDiscountTotal = paymentProgress.loyaltyDiscountTotal ?? 0;
  const listPrice = paymentProgress.listPrice ?? paymentProgress.totalAmount;
  const pct =
    status === "cancelled"
      ? 0
      : paymentProgress.totalAmount > 0
        ? Math.min(100, (paymentProgress.collectedAmount / paymentProgress.totalAmount) * 100)
        : 0;

  const paidLabel =
    status === "cancelled"
      ? "Refunded"
      : status === "fulfilled"
        ? "Paid out"
        : `${paymentProgress.personsPaidFor} of ${paymentProgress.totalParticipants} paid`;
  const amountLabel =
    status === "fulfilled" || status === "cancelled"
      ? formatPrice(status === "cancelled" ? paymentProgress.collectedAmount : paymentProgress.totalAmount)
      : `${formatPrice(paymentProgress.collectedAmount)} / ${formatPrice(paymentProgress.totalAmount)}`;

  let note: string;
  if (status === "cancelled") {
    note = reservation.cancellationReason
      ? `Cancelled · ${reservation.cancellationReason}`
      : "Cancelled · everyone was refunded";
  } else if (status === "fulfilled") {
    note = canLeaveReview ? "How was it? Your review helps others" : "Thanks for going — see you next time";
  } else if (status === "on_hold") {
    note = "Held until the activity, then paid out";
  } else if (reservation.paymentDeadline) {
    note = `Everyone must pay by ${format(new Date(reservation.paymentDeadline), "EEE, d MMM · HH:mm")}`;
  } else {
    note = `Everyone must pay by ${dateLabel}`;
  }

  const loyaltyPoints = loyaltyBalance ? Number(loyaltyBalance.balance) : 0;
  const canPay = status === "pending" && paymentProgress.remainingAmount > 0 && !hasPaid;
  const canRedeem =
    status === "pending" &&
    paymentProgress.collectedAmount === 0 &&
    loyaltyDiscountTotal === 0 &&
    loyaltyPoints >= 10;
  const canCancel = isTeamCreator && (status === "pending" || status === "on_hold");
  const teamName = teams[0]?.teamName;
  const image = activity.images?.[0];

  const handleRedeem = async () => {
    const n = Math.floor(Number(loyaltyPointsInput));
    if (n < 10) return;
    setLoyaltyRedeeming(true);
    try {
      const r = await redeemLoyalty({ reservationId, pointsToSpend: n });
      setLoyaltyPointsInput("");
      setLoyaltyOpen(false);
      toast.success(`Saved ${formatPrice(r.discount)} with ${r.pointsUsed} points`);
    } catch (e) {
      toast.error(errorMessage(e, "Could not redeem points"));
    } finally {
      setLoyaltyRedeeming(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancellationReason.trim()) return;
    try {
      const result = await cancelReservation(reservationId, cancellationReason.trim());
      setCancelDialogOpen(false);
      setCancellationReason("");
      toast.success("Reservation cancelled. Everyone who paid will be refunded.");
      if (result.autoAssigned) {
        toast.info("The first team in the queue got the freed spot.");
      } else if (result.queueNotified) {
        toast.info("The first team in the queue has been notified.");
      }
    } catch (error) {
      toast.error(errorMessage(error, "Failed to cancel reservation"));
    }
  };

  return (
    <article
      aria-label={`Reservation: ${activity.activityName}`}
      className={cn(
        "w-full max-w-[420px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_6px_20px_-10px_rgba(0,0,0,0.18)] dark:border-zinc-700 dark:bg-zinc-900",
        status === "cancelled" && "opacity-75"
      )}
    >
      <div className="flex gap-3 p-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-blue-100 dark:bg-zinc-800">
          {image && (
            <Image
              src={image}
              alt=""
              fill
              sizes="64px"
              className={cn("object-cover", status === "cancelled" && "grayscale")}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-2 self-start rounded-full px-2 py-1 text-[11px] font-semibold",
              style.chip
            )}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {style.label}
          </span>
          <h3 className="truncate text-[15px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {activity.activityName}
          </h3>
          <p className="text-[13px] text-zinc-600 dark:text-zinc-400">
            {dateLabel} · {timeLabel} · {paymentProgress.totalParticipants}{" "}
            {paymentProgress.totalParticipants === 1 ? "person" : "people"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
          <div className="flex justify-between text-[13px]">
            <span className="text-zinc-600 dark:text-zinc-400">{paidLabel}</span>
            <b className="tabular-nums text-zinc-900 dark:text-zinc-50">{amountLabel}</b>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
            role="progressbar"
            aria-label="Amount collected"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", pct >= 100 ? "bg-green-600" : style.bar)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p
            className={cn(
              "text-xs",
              status === "pending" ? "text-orange-800 dark:text-orange-300" : "text-zinc-600 dark:text-zinc-400"
            )}
          >
            {note}
          </p>
          {loyaltyDiscountTotal > 0 && (
            <p className="text-xs font-medium text-green-700 dark:text-green-400">
              Points discount −{formatPrice(loyaltyDiscountTotal)} (was {formatPrice(listPrice)})
            </p>
          )}
        </div>

        {canRedeem && (
          <div className="rounded-xl border border-dashed border-zinc-300 px-3 py-3 text-xs dark:border-zinc-700">
            {loyaltyOpen ? (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleRedeem();
                }}
              >
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor={`loyalty-${reservationId}`} className="text-xs">
                    Points to spend · you have {loyaltyPoints}
                  </Label>
                  <Input
                    id={`loyalty-${reservationId}`}
                    type="number"
                    inputMode="numeric"
                    min={10}
                    max={loyaltyPoints}
                    value={loyaltyPointsInput}
                    onChange={(e) => setLoyaltyPointsInput(e.target.value)}
                    placeholder="e.g. 100"
                    className="h-8 rounded-lg"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loyaltyRedeeming || Number(loyaltyPointsInput) < 10}
                >
                  {loyaltyRedeeming ? "Applying…" : "Apply"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Close points"
                  onClick={() => setLoyaltyOpen(false)}
                >
                  <X />
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex-1">
                  <b className="block text-[13px] text-zinc-900 dark:text-zinc-50">
                    Use {loyaltyPoints} points
                  </b>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    10 pts = €1 · up to {formatPrice(Math.round(listPrice * 0.2 * 100) / 100)} off · before anyone pays
                  </span>
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => setLoyaltyOpen(true)}>
                  Use
                </Button>
              </div>
            )}
          </div>
        )}

        {participants.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {participants.slice(0, 4).map((p) => (
                <Avatar key={p._id} className="size-[26px] border-2 border-white dark:border-zinc-900">
                  <AvatarImage src={p.avatar} alt={p.name} />
                  <AvatarFallback name={`${p.name} ${p.lastname}`} />
                </Avatar>
              ))}
              {participants.length > 4 && (
                <span className="flex size-[26px] items-center justify-center rounded-full border-2 border-white bg-zinc-100 text-[10px] font-bold text-zinc-600 dark:border-zinc-900 dark:bg-zinc-800 dark:text-zinc-300">
                  +{participants.length - 4}
                </span>
              )}
            </div>
            <span className="truncate text-xs text-zinc-600 dark:text-zinc-400">
              {teamName ? `${teamName} · ` : ""}
              {participants.length}
            </span>
          </div>
        )}

        {status !== "cancelled" && (
          <div className="flex gap-2">
            {canPay ? (
              <Button
                className="h-10 flex-1 bg-blue-600 font-semibold text-white hover:bg-blue-700"
                onClick={() => setPaymentDialogOpen(true)}
              >
                Pay your share · {formatPrice(Math.round(paymentProgress.perPersonAmount * 100) / 100)}
              </Button>
            ) : canLeaveReview ? (
              <Button className="h-10 flex-1 font-semibold" onClick={() => setReviewDialogOpen(true)}>
                <Star /> Leave a review
              </Button>
            ) : (
              <span className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-green-50 text-sm font-semibold text-green-700 dark:bg-green-950/50 dark:text-green-300">
                <Check className="size-3.5" strokeWidth={3} />
                {status === "pending" ? "You've paid" : "Fully paid"}
              </span>
            )}
            <Button asChild variant="outline" className="h-10 px-4">
              <Link href={`/activities/${activity._id}`}>Details</Link>
            </Button>
            {canCancel && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-10" aria-label="More actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isPending}
                    onSelect={() => {
                      setCancellationReason("");
                      setCancelDialogOpen(true);
                    }}
                  >
                    <X /> Cancel reservation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        reservationId={reservationId}
        amount={paymentProgress.totalAmount}
        perPersonAmount={paymentProgress.perPersonAmount}
        remainingPersons={paymentProgress.remainingPersons}
        activityName={activity.activityName}
        onSuccess={() => {}}
      />

      <ReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        activityId={activity._id}
        activityName={activity.activityName}
        activityImage={image}
        onSuccess={() => {}}
      />

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300">
            <AlertCircle className="size-5" />
          </span>
          <DialogHeader>
            <DialogTitle>Cancel this reservation?</DialogTitle>
            <DialogDescription>
              Everyone who paid gets a full refund, and the next team in the queue is offered the spot.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-zinc-50 p-3 text-[13px] dark:bg-zinc-800/60">
            <b className="text-zinc-900 dark:text-zinc-50">{activity.activityName}</b>
            <br />
            <span className="text-zinc-600 dark:text-zinc-400">
              {dateLabel} · {timeLabel}
              {paymentProgress.collectedAmount > 0 &&
                ` · ${formatPrice(paymentProgress.collectedAmount)} to refund`}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`cancel-reason-${reservationId}`}>Reason (shared with your team)</Label>
            <Textarea
              id={`cancel-reason-${reservationId}`}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="e.g. Weather forecast changed"
              rows={3}
              className="resize-none"
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setCancelDialogOpen(false)} disabled={isPending}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              className="h-10 font-semibold"
              onClick={handleCancelConfirm}
              disabled={isPending || !cancellationReason.trim()}
            >
              {isPending ? "Cancelling…" : "Cancel & refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
