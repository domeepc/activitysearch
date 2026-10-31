"use client";

import { Id } from "@/convex/_generated/dataModel";
import { capture } from "@/lib/posthog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAcceptQueueReservation,
  useDeclineQueueReservation,
} from "@/lib/hooks/useReservations";
import { AlertCircle, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface QueueNotification {
  _id: Id<"reservationQueue">;
  activityId: Id<"activities">;
  date: string;
  teamIds: Id<"teams">[];
  userCount: bigint;
  createdAt: number;
  notifiedAt?: number;
  activity: {
    _id: Id<"activities">;
    activityName: string;
    address: string;
    availableTimeSlots: string[];
  } | null;
  teams: Array<{
    _id: Id<"teams">;
    teamName: string;
    slug: string;
  }>;
}

interface QueueNotificationDialogProps {
  notification: QueueNotification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept?: () => void;
  onDecline?: () => void;
}

export function QueueNotificationDialog({
  notification,
  open,
  onOpenChange,
  onAccept,
  onDecline,
}: QueueNotificationDialogProps) {
  const [selectedTime, setSelectedTime] = useState<string>("");
  const { acceptQueueReservation, isPending: isAccepting } =
    useAcceptQueueReservation();
  const { declineQueueReservation, isPending: isDeclining } =
    useDeclineQueueReservation();
  const [error, setError] = useState<string | null>(null);

  if (!notification) return null;

  const availableTimeSlots = notification.activity?.availableTimeSlots ?? [];

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + "T00:00:00"), "EEE, d MMM");
    } catch {
      return dateStr;
    }
  };

  const handleAccept = async () => {
    if (!selectedTime) {
      setError("Please select a time slot");
      return;
    }

    if (!availableTimeSlots.includes(selectedTime)) {
      setError("Selected time is not available");
      return;
    }

    setError(null);
    try {
      await acceptQueueReservation(notification._id, selectedTime);
      capture("queue_reservation_accepted", {
        activity_id: String(notification.activityId),
        activity_name: notification.activity?.activityName,
        date: notification.date,
        time: selectedTime,
      });
      onAccept?.();
      onOpenChange(false);
      setSelectedTime("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to accept reservation"
      );
    }
  };

  const handleDecline = async () => {
    setError(null);
    try {
      await declineQueueReservation(notification._id);
      capture("queue_reservation_declined", {
        activity_id: String(notification.activityId),
        activity_name: notification.activity?.activityName,
        date: notification.date,
      });
      onDecline?.();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to decline reservation"
      );
    }
  };

  const teamNames = notification.teams.map((t) => t.teamName).join(", ");
  const busy = isAccepting || isDeclining;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          <Sparkles className="size-3.5" aria-hidden="true" />
          From the queue
        </span>
        <DialogHeader>
          <DialogTitle>A spot opened up</DialogTitle>
          <DialogDescription>
            Your team was first in line. Pick a time and accept to reserve it — if you pass, the next team is offered the spot.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <b className="text-sm text-zinc-900 dark:text-zinc-50">
            {notification.activity?.activityName || "Activity"}
          </b>
          <span className="text-[13px] text-zinc-600 dark:text-zinc-400">
            {formatDate(notification.date)} · {teamNames} · {Number(notification.userCount)} people
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span id="queue-time-label" className="text-sm font-medium">
            Pick a time
          </span>
          {availableTimeSlots.length === 0 ? (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              No time slots are left on this day.
            </p>
          ) : (
            <div role="radiogroup" aria-labelledby="queue-time-label" className="flex flex-wrap gap-2">
              {availableTimeSlots.map((time) => (
                <button
                  key={time}
                  type="button"
                  role="radio"
                  aria-checked={selectedTime === time}
                  onClick={() => {
                    setSelectedTime(time);
                    setError(null);
                  }}
                  className={cn(
                    "h-9 rounded-xl border px-4 text-sm font-medium tabular-nums transition-colors",
                    selectedTime === time
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
                  )}
                >
                  {time}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={handleDecline} disabled={busy}>
            {isDeclining ? "Passing…" : "Pass"}
          </Button>
          <Button
            className="h-11 flex-[2] bg-blue-600 font-semibold text-white hover:bg-blue-700"
            onClick={handleAccept}
            disabled={busy || !selectedTime || availableTimeSlots.length === 0}
          >
            {isAccepting ? "Reserving…" : "Accept spot"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
