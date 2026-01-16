"use client";

import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  useAcceptQueueReservation,
  useDeclineQueueReservation,
} from "@/lib/hooks/useReservations";
import { Clock, AlertCircle, Check, X } from "lucide-react";
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
      return format(new Date(dateStr + "T00:00:00"), "MMM dd, yyyy");
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
      onDecline?.();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to decline reservation"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Queue Notification</DialogTitle>
          <DialogDescription>
            A slot has become available! You can now reserve this activity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Activity Info */}
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium">Activity: </span>
              <span className="text-sm">
                {notification.activity?.activityName || "Unknown Activity"}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium">Date: </span>
              <span className="text-sm">{formatDate(notification.date)}</span>
            </div>
            <div>
              <span className="text-sm font-medium">Teams: </span>
              <span className="text-sm">
                {notification.teams.map((t) => t.teamName).join(", ")}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium">Participants: </span>
              <span className="text-sm">{Number(notification.userCount)}</span>
            </div>
          </div>

          {/* Time Slot Selection */}
          <div className="space-y-2">
            <Label>
              <Clock className="inline h-4 w-4 mr-2" />
              Select Time Slot <span className="text-destructive">*</span>
            </Label>
            {availableTimeSlots.length === 0 ? (
              <div className="p-3 border rounded-md bg-destructive/10 text-sm text-destructive">
                No time slots available
              </div>
            ) : (
              <NativeSelect
                value={selectedTime}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedTime(e.target.value)
                }
                className="w-full"
              >
                <NativeSelectOption value="">
                  Select a time slot
                </NativeSelectOption>
                {availableTimeSlots.map((time) => (
                  <NativeSelectOption key={time} value={time}>
                    {time}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="p-3 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground">
              You have been notified because a reservation was cancelled. If you
              decline, the next team in the queue will be notified.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={isAccepting || isDeclining}
          >
            <X className="h-4 w-4 mr-2" />
            Decline
          </Button>
          <Button
            onClick={handleAccept}
            disabled={
              isAccepting ||
              isDeclining ||
              !selectedTime ||
              availableTimeSlots.length === 0
            }
          >
            <Check className="h-4 w-4 mr-2" />
            {isAccepting ? "Accepting..." : "Accept & Reserve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
