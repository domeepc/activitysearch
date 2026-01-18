"use client";

import { useState, useMemo } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui/multi-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  useMyTeamsAsCreator,
  useCreateReservation,
  useReservations,
} from "@/lib/hooks/useReservations";
import {
  Calendar as CalendarIcon,
  Users,
  AlertCircle,
  Clock,
} from "lucide-react";
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
  // Use open state and activityId as key to reset form when dialog opens
  const formKey = `${activityId}-${open}`;

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Handle dialog open change and reset form when closing
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Dialog is closing, reset form
      setSelectedDate(undefined);
      setSelectedTime("");
      setSelectedTeamIds([]);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const { teams, isLoading: teamsLoading, hasTeams } = useMyTeamsAsCreator();
  const { createReservation, isPending } = useCreateReservation();
  const activity = useQuery(api.activity.getActivityById, { activityId });

  // Get available time slots from activity (memoized to avoid dependency issues)
  const availableTimeSlots = useMemo(
    () => activity?.availableTimeSlots ?? [],
    [activity?.availableTimeSlots]
  );

  // Get reservations for the activity to calculate status
  const { reservations } = useReservations(activityId);

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

  // Calculate total number of unique members across all selected teams
  const userCount = useMemo(() => {
    if (selectedTeamIds.length === 0) return 0;

    const allMemberIds = new Set<string>();
    teams.forEach((team) => {
      if (selectedTeamIds.includes(team._id)) {
        team.teammates.forEach((teammate) => {
          allMemberIds.add(teammate._id);
        });
      }
    });

    return allMemberIds.size;
  }, [selectedTeamIds, teams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedDate) {
      setError("Please select a date");
      return;
    }

    if (!selectedTime) {
      setError("Please select a time slot");
      return;
    }

    if (selectedTeamIds.length === 0) {
      setError("Please select at least one team");
      return;
    }

    if (userCount === 0) {
      setError("Selected teams have no members");
      return;
    }

    try {
      await createReservation({
        activityId,
        date: format(selectedDate, "yyyy-MM-dd"),
        time: selectedTime,
        teamIds: selectedTeamIds.map((id) => id as Id<"teams">),
        userCount,
      });
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create reservation"
      );
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reserve Activity</DialogTitle>
          <DialogDescription>
            Select a date, time, and team(s) to reserve this activity.
          </DialogDescription>
        </DialogHeader>

        <form key={formKey} onSubmit={handleSubmit} className="space-y-6">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>
              <CalendarIcon className="inline h-4 w-4 mr-2" />
              Date
            </Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  {selectedDate ? (
                    format(selectedDate, "PPP")
                  ) : (
                    <span>Select a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedTime(""); // Reset time when date changes
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < today}
                  modifiers={{
                    reservation_full: (date) => {
                      const mods = getDateModifiers(date);
                      return mods.reservation_full ?? false;
                    },
                    reservation_limited: (date) => {
                      const mods = getDateModifiers(date);
                      return mods.reservation_limited ?? false;
                    },
                    reservation_available: (date) => {
                      const mods = getDateModifiers(date);
                      return mods.reservation_available ?? false;
                    },
                  }}
                  modifiersClassNames={{
                    reservation_full: "reservation-full",
                    reservation_limited: "reservation-limited",
                    reservation_available: "reservation-available",
                  }}
                />
              </PopoverContent>
            </Popover>
            {availableTimeSlots.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Max {availableTimeSlots.length} reservation
                {availableTimeSlots.length !== 1 ? "s" : ""} per day
              </p>
            )}
          </div>

          {/* Time Slot Selector */}
          <div className="space-y-2">
            <Label>
              <Clock className="inline h-4 w-4 mr-2" />
              Time Slot
            </Label>
            {!selectedDate ? (
              <div className="p-3 border rounded-md bg-muted/50 text-sm text-muted-foreground">
                Please select a date first
              </div>
            ) : availableTimeSlotsForDate.length === 0 ? (
              <div className="p-3 border rounded-md bg-destructive/10 text-sm text-destructive">
                No available time slots for this date
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
                {availableTimeSlotsForDate.map((time) => (
                  <NativeSelectOption key={time} value={time}>
                    {time}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
            {selectedDate && availableTimeSlotsForDate.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {availableTimeSlotsForDate.length} slot
                {availableTimeSlotsForDate.length !== 1 ? "s" : ""} available
              </p>
            )}
          </div>

          {/* Team Selector */}
          <div className="space-y-2">
            <Label>
              <Users className="inline h-4 w-4 mr-2" />
              Teams
            </Label>
            {teamsLoading ? (
              <p className="text-sm text-muted-foreground">Loading teams...</p>
            ) : (
              <MultiSelect
                values={selectedTeamIds}
                onValuesChange={setSelectedTeamIds}
              >
                <MultiSelectTrigger className="w-full">
                  <MultiSelectValue placeholder="Select teams" />
                </MultiSelectTrigger>
                <MultiSelectContent>
                  {teams.map((team) => (
                    <MultiSelectItem key={team._id} value={team._id}>
                      {team.teamName}
                    </MultiSelectItem>
                  ))}
                </MultiSelectContent>
              </MultiSelect>
            )}
            <p className="text-xs text-muted-foreground">
              Only teams where you are the creator are shown
            </p>
          </div>

          {/* User Count - Auto-calculated from selected teams */}
          <div className="space-y-2">
            <Label>
              <Users className="inline h-4 w-4 mr-2" />
              Number of Participants
            </Label>
            <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
              <span className="text-sm font-medium text-foreground">
                {userCount === 0
                  ? "Select teams to see participant count"
                  : `${userCount} ${
                      userCount === 1 ? "participant" : "participants"
                    }`}
              </span>
              {selectedTeamIds.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  (from {selectedTeamIds.length}{" "}
                  {selectedTeamIds.length === 1 ? "team" : "teams"})
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically calculated from selected team members
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isPending ||
                isJoiningQueue ||
                !hasTeams ||
                !selectedTeamId ||
                (isDateFulfilled && queuePosition?.inQueue) ||
                (activity?.maxParticipants &&
                  userCount > Number(activity.maxParticipants))
              }
            >
              {isJoiningQueue
                ? "Joining Queue..."
                : isPending
                ? "Creating..."
                : isDateFulfilled
                ? "Join Queue"
                : "Create Reservation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
