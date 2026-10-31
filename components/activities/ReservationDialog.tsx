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
import { AlertCircle, CalendarDays, Check, Loader2, Users } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { addDays, format, isSameDay } from "date-fns";
import Link from "next/link";

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
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Handle dialog open change and reset form when closing
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedDate(undefined);
      setSelectedTime("");
      setSelectedTeamId("");
      setError(null);
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

  // The next two weeks, shown as a strip; older/later dates come from the calendar.
  const upcomingDays = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(today, i)),
    [today]
  );

  // Calculate total number of members in selected team
  const userCount = useMemo(() => {
    if (!selectedTeamId) return 0;

    const selectedTeam = teams.find((team) => team._id === selectedTeamId);
    if (!selectedTeam) return 0;

    return selectedTeam.teammates.length;
  }, [selectedTeamId, teams]);

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
      toast.success("Reserved! Your team can pay their shares in the team chat.");
      onOpenChange(false);
    } else {
      setError(result.error || "Failed to create reservation");
    }
  };

  if (!hasTeams && !teamsLoading) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <Users className="size-5" />
          </span>
          <DialogHeader>
            <DialogTitle>Create a team first</DialogTitle>
            <DialogDescription>
              Reservations are made for a team you created, so everyone can split the price. Start one in Messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
            <Button asChild className="h-10 bg-blue-600 font-semibold text-white hover:bg-blue-700">
              <Link href="/chat">Go to Messages</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const selectedTeam = teams.find((team) => team._id === selectedTeamId);
  const isBusy = isPending || isJoiningQueue;
  const maxParticipants = activity?.maxParticipants ? Number(activity.maxParticipants) : 0;
  const overLimit = maxParticipants > 0 && userCount > maxParticipants;
  const price = activity?.price ?? 0;
  const share = userCount > 0 ? Math.round((price / userCount) * 100) / 100 : 0;
  const timeDone = isDateFulfilled || !!selectedTime;
  const doneSteps = (selectedDate ? 1 : 0) + (selectedDate && timeDone ? 1 : 0) + (selectedTeamId ? 1 : 0);
  const canSubmit =
    !isBusy &&
    !!selectedDate &&
    timeDone &&
    !!selectedTeamId &&
    !overLimit &&
    !(isDateFulfilled && (queuePosition?.inQueue ?? false));
  const image = activity?.images?.[0];

  const pickDate = (date: Date | undefined) => {
    setError(null);
    setSelectedDate(date);
    setSelectedTime("");
    setCalendarOpen(false);
  };

  const stepBadge = (n: number, done: boolean, active: boolean) => (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
        done
          ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
          : active
            ? "border border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
            : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"
      )}
    >
      {done ? <Check className="size-3.5 animate-in zoom-in-50 duration-200" strokeWidth={3} /> : n}
    </span>
  );

  const STATUS_DOT = {
    open: "bg-green-600",
    limited: "bg-orange-600",
    full: "bg-violet-600",
  } as const;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] grid-cols-1 gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-[780px]">
        <form key={formKey} onSubmit={handleSubmit} className="flex w-full min-w-0 flex-wrap">
          <div className="flex min-w-0 flex-[999_1_400px] flex-col gap-5 p-5 sm:p-6">
            <DialogHeader className="pr-8 text-left">
              <DialogTitle className="text-xl">Reserve your spot</DialogTitle>
              <DialogDescription>
                {doneSteps < 3 ? `Step ${Math.min(doneSteps + 1, 3)} of 3` : "Ready to reserve"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-colors duration-300",
                    i < doneSteps ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-800"
                  )}
                />
              ))}
            </div>

            {/* 1 · Date */}
            <section aria-labelledby="rd-date" className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {stepBadge(1, !!selectedDate, !selectedDate)}
                <h3 id="rd-date" className="flex-1 text-sm font-semibold">Date</h3>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50">
                      <CalendarDays className="size-3.5" /> More dates
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto rounded-2xl p-1">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={pickDate}
                      disabled={(date) => date < today}
                      modifiers={{
                        reservation_full: (date) => getDateModifiers(date).reservation_full ?? false,
                        reservation_limited: (date) => getDateModifiers(date).reservation_limited ?? false,
                        reservation_available: (date) => getDateModifiers(date).reservation_available ?? false,
                      }}
                      modifiersClassNames={{
                        reservation_full: "reservation-full",
                        reservation_limited: "reservation-limited",
                        reservation_available: "reservation-available",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div
                role="radiogroup"
                aria-labelledby="rd-date"
                className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
              >
                {upcomingDays.map((day) => {
                  const m = getDateModifiers(day);
                  const status = m.reservation_full ? "full" : m.reservation_limited ? "limited" : "open";
                  const selected = !!selectedDate && isSameDay(day, selectedDate);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${format(day, "EEEE d MMMM")}${status === "full" ? ", full — join queue" : status === "limited" ? ", filling up" : ""}`}
                      onClick={() => pickDate(day)}
                      className={cn(
                        "flex w-[58px] shrink-0 snap-start flex-col items-center gap-1 rounded-xl border py-2 transition-colors",
                        selected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                      )}
                    >
                      <span className="text-[11px] opacity-80">{format(day, "EEE")}</span>
                      <span className="text-base font-bold leading-none">{format(day, "d")}</span>
                      <span className={cn("mt-1 size-1.5 rounded-full", selected ? "bg-white" : STATUS_DOT[status])} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              {selectedDate && !upcomingDays.some((d) => isSameDay(d, selectedDate)) && (
                <p className="text-[13px] text-zinc-600 dark:text-zinc-400">
                  Picked <b className="text-zinc-900 dark:text-zinc-50">{format(selectedDate, "EEE, d MMM yyyy")}</b>
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-green-600" />Open</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-orange-600" />Filling up</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-violet-600" />Full · join queue</span>
              </div>
            </section>

            {/* 2 · Time */}
            <section aria-labelledby="rd-time" className={cn("flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800", !selectedDate && "opacity-50")}>
              <div className="flex items-center gap-3">
                {stepBadge(2, !!selectedDate && timeDone, !!selectedDate && !timeDone)}
                <h3 id="rd-time" className="text-sm font-semibold">Time</h3>
              </div>
              {!selectedDate ? (
                <p className="text-[13px] text-zinc-600 dark:text-zinc-400">Pick a date to see open times.</p>
              ) : isDateFulfilled ? (
                <div className="rounded-xl bg-violet-50 p-4 text-[13px] dark:bg-violet-950/40">
                  <b className="block text-violet-900 dark:text-violet-200">This day is fully booked</b>
                  <span className="text-violet-800 dark:text-violet-300">
                    {queuePosition?.inQueue
                      ? `Your team is #${queuePosition.position} of ${queuePosition.totalInQueue} in the queue.`
                      : "Join the queue and we'll offer your team the first spot that opens up."}
                  </span>
                </div>
              ) : availableTimeSlotsForDate.length === 0 ? (
                <p className="rounded-xl bg-zinc-50 p-4 text-[13px] text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
                  No times left on this day — try another date.
                </p>
              ) : (
                <div role="radiogroup" aria-labelledby="rd-time" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {availableTimeSlotsForDate.map((time) => (
                    <button
                      key={time}
                      type="button"
                      role="radio"
                      aria-checked={selectedTime === time}
                      onClick={() => {
                        setError(null);
                        setSelectedTime(time);
                      }}
                      className={cn(
                        "h-10 rounded-xl border text-sm font-medium tabular-nums transition-colors active:scale-[0.97]",
                        selectedTime === time
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                      )}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* 3 · Team */}
            <section aria-labelledby="rd-team" className="flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                {stepBadge(3, !!selectedTeamId, !selectedTeamId && !!selectedDate && timeDone)}
                <h3 id="rd-team" className="flex-1 text-sm font-semibold">Team</h3>
                <span className="text-[11px] text-zinc-500">Teams you created</span>
              </div>
              {teamsLoading ? (
                <div className="flex flex-col gap-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                  ))}
                </div>
              ) : (
                <div role="radiogroup" aria-labelledby="rd-team" className="flex flex-col gap-2">
                  {teams.map((team) => {
                    const count = team.teammates.length;
                    const tooBig = maxParticipants > 0 && count > maxParticipants;
                    const selected = selectedTeamId === team._id;
                    return (
                      <button
                        key={team._id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setError(null);
                          setSelectedTeamId(team._id);
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          selected
                            ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600 dark:bg-blue-950/40"
                            : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                        )}
                      >
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                          {team.teamName[0]?.toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm font-semibold">{team.teamName}</b>
                          <span className={cn("block text-xs", tooBig ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400")}>
                            {count} {count === 1 ? "person" : "people"}
                            {tooBig ? ` · max ${maxParticipants} for this activity` : price ? ` · ${formatPrice(Math.round((price / count) * 100) / 100)} each` : ""}
                          </span>
                        </span>
                        {selected && <Check className="size-4 text-blue-600 dark:text-blue-400" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="flex flex-[1_1_260px] flex-col gap-4 border-t border-zinc-100 bg-zinc-50 p-5 sm:p-6 md:border-t-0 md:border-l dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-center gap-3">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-blue-100 dark:bg-zinc-800">
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="size-full object-cover" />
                )}
              </span>
              <span className="min-w-0">
                <b className="line-clamp-2 text-sm font-semibold leading-snug">{activity?.activityName ?? "Activity"}</b>
                {activity?.address && (
                  <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">{activity.address}</span>
                )}
              </span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[13px]">
              <dt className="text-zinc-600 dark:text-zinc-400">Date</dt>
              <dd className="text-right font-medium">{selectedDate ? format(selectedDate, "EEE, d MMM") : "—"}</dd>
              <dt className="text-zinc-600 dark:text-zinc-400">Time</dt>
              <dd className="text-right font-medium">{isDateFulfilled ? "Queue" : selectedTime || "—"}</dd>
              <dt className="text-zinc-600 dark:text-zinc-400">Team</dt>
              <dd className="truncate text-right font-medium">{selectedTeam ? `${selectedTeam.teamName} · ${userCount}` : "—"}</dd>
            </dl>
            <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(price)}</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {userCount > 0
                ? `Split between ${userCount} — each teammate pays ${formatPrice(share)} after you reserve.`
                : "The price is split between your team after you reserve."}
            </p>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[13px] text-red-700 dark:bg-red-950/50 dark:text-red-300">
                <AlertCircle className="mt-1 size-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="mt-auto flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  "h-12 text-[15px] font-semibold text-white",
                  isDateFulfilled ? "bg-violet-600 hover:bg-violet-700" : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isBusy && <Loader2 className="size-4 animate-spin" />}
                {isJoiningQueue
                  ? "Joining queue…"
                  : isPending
                    ? "Reserving…"
                    : isDateFulfilled
                      ? queuePosition?.inQueue
                        ? "Already in the queue"
                        : "Join the queue"
                      : "Reserve"}
              </Button>
              <Button type="button" variant="ghost" className="h-10" onClick={() => handleOpenChange(false)} disabled={isBusy}>
                Cancel
              </Button>
            </div>
          </aside>
        </form>
      </DialogContent>
    </Dialog>
  );
}
