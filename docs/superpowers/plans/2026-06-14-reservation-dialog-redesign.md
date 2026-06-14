# ReservationDialog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat stacked form in `ReservationDialog` with a 3-step wizard (Date → Time → Team) using numbered panels, chip selectors, a progress bar, and dynamic Back/Next footer — all logic and hooks unchanged.

**Architecture:** Single file rewrite of `components/activities/ReservationDialog.tsx`. Add one new piece of state (`currentStep`). Replace `NativeSelect` inputs with chip button grids. Remove `Label`, `NativeSelect`, `NativeSelectOption`, `Users`, `Clock` imports (unused after rewrite). Keep all hooks, memos, `handleSubmit`, PostHog calls, and the "no teams" empty state untouched.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, shadcn/ui (new-york), date-fns, lucide-react

---

## Files

- **Modify:** `components/activities/ReservationDialog.tsx` — full JSX rewrite, one new state variable, two removed imports groups

---

### Task 1: Add `currentStep` state and reset it on dialog close

**Files:**
- Modify: `components/activities/ReservationDialog.tsx`

> No test framework exists in this project — verify behaviour manually by running `pnpm dev`.

- [ ] **Step 1: Add `currentStep` state after the existing state declarations**

In `components/activities/ReservationDialog.tsx`, after line 65 (`const [calendarOpen, setCalendarOpen] = useState(false);`), add:

```tsx
const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
```

- [ ] **Step 2: Reset `currentStep` inside `handleOpenChange`**

Replace the existing `handleOpenChange` function:

```tsx
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
```

- [ ] **Step 3: Verify dev server compiles with no TypeScript errors**

```bash
pnpm build 2>&1 | tail -20
```

Expected: no errors referencing `ReservationDialog.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/activities/ReservationDialog.tsx
git commit -m "feat(reservation-dialog): add currentStep wizard state"
```

---

### Task 2: Update imports — remove unused, keep required

**Files:**
- Modify: `components/activities/ReservationDialog.tsx`

- [ ] **Step 1: Replace the import block**

Replace the entire import section (lines 1–43 in the original) with:

```tsx
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  useMyTeamsAsCreator,
  useCreateReservation,
  useReservations,
  useReservationStatus,
  useJoinQueue,
  useGetQueuePosition,
} from "@/lib/hooks/useReservations";
import { Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
```

Removed: `Label`, `NativeSelect`, `NativeSelectOption`, `Users`, `Clock`.

- [ ] **Step 2: Verify no unused import warnings**

```bash
pnpm lint 2>&1 | grep "ReservationDialog"
```

Expected: no output (no lint errors on this file).

- [ ] **Step 3: Commit**

```bash
git add components/activities/ReservationDialog.tsx
git commit -m "feat(reservation-dialog): clean up imports for wizard rewrite"
```

---

### Task 3: Rewrite the main dialog JSX with step panels, progress bar, chips, and footer

**Files:**
- Modify: `components/activities/ReservationDialog.tsx`

This task replaces everything from the `return (` statement of the main export (line 306 onwards in the original) through to end of file. The "no teams" empty state (lines 279–304) is **unchanged**.

- [ ] **Step 1: Add `progressPct` derived value after the existing memos**

After the `userCount` memo (after line 188 in original), add:

```tsx
const progressPct = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;
```

- [ ] **Step 2: Replace the main `return` block with the full wizard JSX**

Replace from `return (` (line 306) to end of file with:

```tsx
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
            className="h-full bg-foreground transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <form key={formKey} onSubmit={handleSubmit}>
          <div className="divide-y divide-border">

            {/* ── Step 1: Choose a date ── */}
            <div>
              <button
                type="button"
                className="w-full flex items-center gap-3 py-3 text-left disabled:cursor-default"
                onClick={() => currentStep > 1 && setCurrentStep(1)}
                disabled={currentStep <= 1}
              >
                <span className="font-mono text-xs text-muted-foreground w-5">01</span>
                <span className="flex-1 text-sm font-medium">Choose a date</span>
                {currentStep > 1 && selectedDate && (
                  <span className="text-xs text-muted-foreground">
                    {format(selectedDate, "MMM d")}
                  </span>
                )}
              </button>

              {currentStep === 1 && (
                <div className="pb-4 space-y-2">
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal border-border"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : <span>Select a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 border-border border-2 shadow-xl"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          setSelectedTime("");
                          setCalendarOpen(false);
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
                    </PopoverContent>
                  </Popover>

                  {availableTimeSlots.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Max {availableTimeSlots.length} reservation
                      {availableTimeSlots.length !== 1 ? "s" : ""} per day
                    </p>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Step 2: Pick a time ── */}
            <div>
              <button
                type="button"
                className="w-full flex items-center gap-3 py-3 text-left disabled:cursor-default"
                onClick={() => currentStep > 2 && setCurrentStep(2)}
                disabled={currentStep <= 2}
              >
                <span className="font-mono text-xs text-muted-foreground w-5">02</span>
                <span className="flex-1 text-sm font-medium">Pick a time</span>
                {currentStep > 2 && (
                  <span className="text-xs text-muted-foreground">
                    {isDateFulfilled ? "Queue" : selectedTime}
                  </span>
                )}
              </button>

              {currentStep === 2 && (
                <div className="pb-4 space-y-3">
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
                    <div className="flex flex-wrap gap-2">
                      {availableTimeSlotsForDate.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setSelectedTime(time)}
                          className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                            selectedTime === time
                              ? "bg-foreground text-background border-foreground"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Step 3: Select your team ── */}
            <div>
              <div className="w-full flex items-center gap-3 py-3">
                <span className="font-mono text-xs text-muted-foreground w-5">03</span>
                <span className="flex-1 text-sm font-medium">Select your team</span>
              </div>

              {currentStep === 3 && (
                <div className="pb-4 space-y-3">
                  {teamsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading teams...</p>
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
                              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                                selectedTeamId === team._id
                                  ? "bg-foreground text-background border-foreground"
                                  : overLimit
                                  ? "border-destructive text-destructive hover:bg-destructive/10"
                                  : "border-border hover:bg-muted"
                              }`}
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
                    </>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <DialogFooter className="flex gap-2 pt-4 border-t border-border mt-2">
            {currentStep === 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending || isJoiningQueue}
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep((s) => (s - 1) as 1 | 2 | 3)}
                disabled={isPending || isJoiningQueue}
              >
                ← Back
              </Button>
            )}

            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={() => {
                  setError(null);
                  setCurrentStep((s) => (s + 1) as 1 | 2 | 3);
                }}
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
                  isPending ||
                  isJoiningQueue ||
                  !hasTeams ||
                  !selectedTeamId ||
                  (isDateFulfilled && (queuePosition?.inQueue ?? false)) ||
                  (!!activity?.maxParticipants &&
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
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
pnpm build 2>&1 | tail -30
```

Expected: no TypeScript errors. If `activityName` causes a type error, check the return type of `api.activity.getActivityById` — the field is `activityName` per `convex/schema.ts` line 182.

- [ ] **Step 4: Manual smoke test**

Run `pnpm dev` and open an activity page. Click "Reserve". Verify:
- Dialog opens on Step 1 of 3
- Progress bar shows ~33%
- Selecting a date enables "Next →"
- Advancing to Step 2 shows the step header with date summary; time chips render
- Selecting a time enables "Next →"; advancing shows "03 Select your team"
- Team chips show "TeamName · N members"; selecting one enables "Create Reservation"
- Back button returns to previous step
- Closing and reopening resets to Step 1

- [ ] **Step 5: Commit**

```bash
git add components/activities/ReservationDialog.tsx
git commit -m "feat(reservation-dialog): 3-step wizard with chips, progress bar, and dynamic footer"
```
