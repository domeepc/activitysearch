"use client";

import { useState, useMemo } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePostHog } from "@posthog/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  useMyTeamsAsCreator,
  useCreateReservation,
  useReservations,
  useReservationStatus,
  useJoinQueue,
  useGetQueuePosition,
} from "@/lib/hooks/useReservations";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReservationDialogProps {
  activityId: Id<"activities">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReservationDialog({
  activityId,
  open,
  onOpenChange,
}: ReservationDialogProps) {
  const posthog = usePostHog();

  // Use open state and activityId as key to reset form when dialog opens
  const formKey = `${activityId}-${open}`;

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Handle dialog open change and reset form when closing
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedDate(undefined);
      setSelectedTime("");
      setSelectedTeamId("");
      setError(null);
      setCurrentStep(1);
    }
    onOpenChange(newOpen);
  };

  const { teams, isLoading: teamsLoading, hasTeams } = useMyTeamsAsCreator();
  const { createReservation, isPending } = useCreateReservation();
  const { joinQueue, isPending: isJoiningQueue } = useJoinQueue();
  const activity = useQuery(api.activity.getActivityById, { activityId });

  // Get available time slots from activity (memoized to avoid dependency issues)
  const availableTimeSlots = useMemo(
    () => activity?.availableTimeSlots ?? [],
    [activity?.availableTimeSlots]
  );

  // Get reservations for the activity to calculate status
  const { reservations } = useReservations(activityId);

  // Check if selected date is fulfilled
  const selectedDateStr = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : undefined;
  const { status: dateStatus } = useReservationStatus(
    activityId,
    selectedDateStr
  );

  // Check queue position if team is selected and date is fulfilled
  const { queuePosition } = useGetQueuePosition(
    activityId,
    selectedDateStr,
    selectedTeamId
      ? ([selectedTeamId as Id<"teams">] as Id<"teams">[])
      : undefined
  );

  const isDateFulfilled = dateStatus?.status === "full";

  // Calculate reservation status for each date in the visible month
  const getDateModifiers = useMemo(() => {
    return (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const reservationsForDate = reservations.filter(
        (r) => r.date === dateStr
      );
      const reservedCount = reservationsForDate.length;
      const totalSlots = availableTimeSlots.length;

      if (totalSlots === 0) return {};

      const percentage = (reservedCount / totalSlots) * 100;
      const modifiers: Record<string, boolean> = {};

      if (percentage === 100) {
        modifiers.reservation_full = true;
      } else if (percentage >= 50) {
        modifiers.reservation_limited = true;
      } else if (percentage > 0) {
        modifiers.reservation_available = true;
      }

      return modifiers;
    };
  }, [reservations, availableTimeSlots]);

  // Get today's date for disabling past dates (memoized to avoid recreating on every render)
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // Get available time slots (excluding already reserved ones and past times for selected date)
  const availableTimeSlotsForDate = useMemo(() => {
    if (!selectedDate) return availableTimeSlots;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const reservedTimes = reservations
      .filter((r) => r.date === dateStr)
      .map((r) => r.time);

    const now = new Date();
    const selectedDateStart = new Date(selectedDate);
    selectedDateStart.setHours(0, 0, 0, 0);

    // Check if selected date is today
    const isToday = selectedDateStart.getTime() === today.getTime();

    return availableTimeSlots.filter((time) => {
      // Filter out reserved times
      if (reservedTimes.includes(time)) return false;

      // Filter out past times if the date is today
      if (isToday) {
        const [hours, minutes] = time.split(":").map(Number);
        const timeDate = new Date(selectedDate);
        timeDate.setHours(hours, minutes, 0, 0);

        // If the time is in the past, filter it out
        if (timeDate <= now) return false;
      }

      return true;
    });
  }, [selectedDate, availableTimeSlots, reservations, today]);

  // Calculate total number of members in selected team
  const userCount = useMemo(() => {
    if (!selectedTeamId) return 0;

    const selectedTeam = teams.find((team) => team._id === selectedTeamId);
    if (!selectedTeam) return 0;

    return selectedTeam.teammates.length;
  }, [selectedTeamId, teams]);

  const progressPct = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedDate) {
      setError("Please select a date");
      return;
    }

    if (!selectedTeamId) {
      setError("Please select a team");
      return;
    }

    if (userCount === 0) {
      setError("Selected team has no members");
      return;
    }

    // Check if team has more members than activity allows
    if (
      activity &&
      activity.maxParticipants &&
      userCount > Number(activity.maxParticipants)
    ) {
      setError(
        `This team has ${userCount} members, but this activity only allows ${activity.maxParticipants} participants.`
      );
      return;
    }

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // If date is fulfilled, join queue instead
    if (isDateFulfilled) {
      try {
        const result = await joinQueue({
          activityId,
          date: dateStr,
          teamIds: [selectedTeamId as Id<"teams">],
          userCount,
        });
        if (result.success) {
          posthog?.capture("activity_queue_joined", {
            activity_id: String(activityId),
            date: dateStr,
            queue_position: result.position,
          });
          setError(null);
          toast.success(
            `Successfully joined the queue! Your position: ${result.position} of ${result.totalInQueue}`
          );
          onOpenChange(false);
        } else {
          setError(result.error ?? "Failed to join queue");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to join queue");
      }
      return;
    }

    // Normal reservation flow
    if (!selectedTime) {
      setError("Please select a time slot");
      return;
    }

    const result = await createReservation({
      activityId,
      date: dateStr,
      time: selectedTime,
      teamIds: [selectedTeamId as Id<"teams">],
      userCount,
    });

    if (result.success) {
      posthog?.capture("activity_reservation_created", {
        activity_id: String(activityId),
        date: dateStr,
        time: selectedTime,
      });
      onOpenChange(false);
    } else {
      setError(result.error || "Failed to create reservation");
    }
  };

  if (!hasTeams && !teamsLoading) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reserve Activity</DialogTitle>
            <DialogDescription>
              You need to be a team creator to make reservations.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any teams where you are the creator. Create a
              team first to make reservations.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full border-zinc-200 dark:border-zinc-700" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const selectedTeam = teams.find((team) => team._id === selectedTeamId);
  const isBusy = isPending || isJoiningQueue;

  const goToStep = (step: 1 | 2 | 3) => {
    setError(null);
    setCurrentStep(step);
  };

  const renderStepHeader = (step: 1 | 2 | 3, label: string, summary?: string) => {
    const done = currentStep > step;
    const active = currentStep === step;
    return (
      <button
        type="button"
        className="w-full flex items-center gap-3 py-3 text-left disabled:cursor-default"
        onClick={() => done && goToStep(step)}
        disabled={!done}
        aria-current={active ? "step" : undefined}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors duration-200",
            done && "border-foreground bg-foreground text-background",
            active && "border-foreground text-foreground",
            !done && !active && "border-border text-muted-foreground"
          )}
        >
          {done ? <Check className="size-3.5 animate-in zoom-in-50 duration-200" /> : step}
        </span>
        <span
          className={cn(
            "flex-1 text-sm font-medium",
            !done && !active && "text-muted-foreground"
          )}
        >
          {label}
        </span>
        {done && summary && (
          <span className="text-xs text-muted-foreground underline-offset-2 hover:underline">
            {summary} · Edit
          </span>
        )}
      </button>
    );
  };

  const stepBody = "pb-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{activity?.activityName ?? "Reserve Activity"}</DialogTitle>
          <DialogDescription>Step {currentStep} of 3</DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="-mx-6 h-0.5 bg-muted overflow-hidden">
          <div
            className="h-full bg-foreground transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <form key={formKey} onSubmit={handleSubmit}>
          <div className="divide-y divide-border">

            {/* ── Step 1: Choose a date ── */}
            <div>
              {renderStepHeader(
                1,
                "Choose a date",
                selectedDate ? format(selectedDate, "MMM d") : undefined
              )}

              {currentStep === 1 && (
                <div className={stepBody}>
                  {/* Inline calendar: picking a date advances straight to time selection */}
                  <div className="flex justify-center rounded-lg border border-border">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setSelectedTime("");
                        if (date) goToStep(2);
                      }}
                      disabled={(date) => date < today}
                      modifiers={{
                        reservation_full: (date) =>
                          getDateModifiers(date).reservation_full ?? false,
                        reservation_limited: (date) =>
                          getDateModifiers(date).reservation_limited ?? false,
                        reservation_available: (date) =>
                          getDateModifiers(date).reservation_available ?? false,
                      }}
                      modifiersClassNames={{
                        reservation_full: "reservation-full",
                        reservation_limited: "reservation-limited",
                        reservation_available: "reservation-available",
                      }}
                    />
                  </div>

                  {availableTimeSlots.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Max {availableTimeSlots.length} reservation
                      {availableTimeSlots.length !== 1 ? "s" : ""} per day
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Step 2: Pick a time ── */}
            <div>
              {renderStepHeader(
                2,
                "Pick a time",
                isDateFulfilled ? "Queue" : selectedTime || undefined
              )}

              {currentStep === 2 && (
                <div className={stepBody}>
                  {isDateFulfilled ? (
                    <div className="p-4 border rounded-md bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
                            This date is fully booked
                          </p>
                          <p className="text-xs text-purple-700 dark:text-purple-300 mb-3">
                            All time slots for this date are reserved. You can join the queue to be
                            notified when a slot becomes available.
                          </p>
                          {queuePosition?.inQueue && (
                            <div className="mt-2 p-2 bg-purple-100 dark:bg-purple-900 rounded border border-purple-300 dark:border-purple-700">
                              <p className="text-xs font-medium text-purple-900 dark:text-purple-100">
                                You are in the queue
                              </p>
                              <p className="text-xs text-purple-700 dark:text-purple-300">
                                Position: {queuePosition.position} of {queuePosition.totalInQueue}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : availableTimeSlotsForDate.length === 0 ? (
                    <div className="p-3 border rounded-md bg-destructive/10 text-sm text-destructive">
                      No available time slots for this date
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableTimeSlotsForDate.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => {
                            setSelectedTime(time);
                            goToStep(3);
                          }}
                          className={cn(
                            "py-2 text-sm rounded-lg border transition-all duration-150 active:scale-95",
                            selectedTime === time
                              ? "bg-foreground text-background border-foreground"
                              : "border-border hover:border-foreground/40 hover:bg-muted"
                          )}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Step 3: Select your team ── */}
            <div>
              {renderStepHeader(3, "Select your team")}

              {currentStep === 3 && (
                <div className={stepBody}>
                  {teamsLoading ? (
                    <div className="flex gap-2">
                      {[0, 1].map((i) => (
                        <div key={i} className="h-8 w-28 rounded-full bg-muted animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {teams.map((team) => {
                          const count = team.teammates.length;
                          const overLimit =
                            activity?.maxParticipants &&
                            count > Number(activity.maxParticipants);
                          return (
                            <button
                              key={team._id}
                              type="button"
                              onClick={() => setSelectedTeamId(team._id)}
                              className={cn(
                                "px-3 py-1.5 text-sm rounded-full border transition-all duration-150 active:scale-95",
                                selectedTeamId === team._id
                                  ? "bg-foreground text-background border-foreground"
                                  : overLimit
                                  ? "border-destructive text-destructive hover:bg-destructive/10"
                                  : "border-border hover:bg-muted"
                              )}
                            >
                              {team.teamName} · {count}{" "}
                              {count === 1 ? "member" : "members"}
                            </button>
                          );
                        })}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Only teams where you are the creator are shown
                      </p>

                      {selectedTeamId &&
                        activity?.maxParticipants &&
                        userCount > Number(activity.maxParticipants) && (
                          <div className="flex items-center gap-2 p-2 border border-destructive/20 rounded-md bg-destructive/10">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <p className="text-xs text-destructive">
                              This team has {userCount} members, but this activity only allows{" "}
                              {activity.maxParticipants} participants.
                            </p>
                          </div>
                        )}

                      {/* Booking summary, mirrors the order recap shown before confirming on booking sites */}
                      {selectedDate && selectedTeam && (
                        <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs space-y-1 animate-in fade-in duration-200">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Date</span>
                            <span className="font-medium">{format(selectedDate, "EEE, MMM d")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Time</span>
                            <span className="font-medium">
                              {isDateFulfilled ? "Waiting list" : selectedTime}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Team</span>
                            <span className="font-medium">
                              {selectedTeam.teamName} ({userCount})
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 mb-2 bg-destructive/10 border border-destructive/20 rounded-md animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* ── Footer ── */}
          <DialogFooter className="flex gap-2 pt-4 border-t border-border mt-2">
            {currentStep === 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => goToStep(Math.max(1, currentStep - 1) as 1 | 2 | 3)}
                disabled={isBusy}
              >
                ← Back
              </Button>
            )}

            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={() => goToStep(Math.min(3, currentStep + 1) as 1 | 2 | 3)}
                disabled={
                  (currentStep === 1 && !selectedDate) ||
                  (currentStep === 2 && !isDateFulfilled && !selectedTime)
                }
              >
                Next →
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={
                  isBusy ||
                  !hasTeams ||
                  !selectedTeamId ||
                  (isDateFulfilled && (queuePosition?.inQueue ?? false)) ||
                  (!!activity?.maxParticipants &&
                    userCount > Number(activity.maxParticipants))
                }
              >
                {isBusy && <Loader2 className="size-4 animate-spin" />}
                {isJoiningQueue
                  ? "Joining Queue..."
                  : isPending
                  ? "Creating..."
                  : isDateFulfilled
                  ? "Join Queue"
                  : "Create Reservation"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
