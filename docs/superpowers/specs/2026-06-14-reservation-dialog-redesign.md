# ReservationDialog Redesign

**Date:** 2026-06-14  
**File:** `components/activities/ReservationDialog.tsx`  
**Scope:** Pure visual redesign — all logic, hooks, validation, and Convex queries unchanged.

---

## Goal

Replace the flat stacked-form layout with a 3-step wizard that feels editorial and premium, matching the Geist + neutral token design system.

---

## Shell

- Dialog: `max-w-lg`, no `overflow-y-auto` (only active step expanded, height stays compact)
- `DialogTitle`: activity name from existing `activity` query; fallback `"Reserve Activity"`
- `DialogDescription`: `"Step N of 3"` — updates as user advances
- Progress bar: `h-0.5` line below header, fills `33% / 66% / 100%` with CSS transition. Color: `bg-foreground`.

---

## Step Panels

Three panels stacked. Each has an always-visible header row; content only renders when active.

### Step header row
- Left: mono index `01` / `02` / `03` in `text-xs text-muted-foreground font-mono`
- Center: step title
- Right: completion summary (shown when step is done and user has moved past it); clicking jumps back

### Step 1 — Choose a date
- Content: existing calendar popover trigger button (full width) + availability hint text
- Completion summary: formatted date e.g. `"Jun 20"`
- Next enabled: date selected

### Step 2 — Pick a time
- Normal content: `flex flex-wrap gap-2` chip grid of `availableTimeSlotsForDate`
  - Each chip: `<button>` with time string
  - Selected: `bg-foreground text-background`
  - Unselected: `border border-border hover:bg-muted rounded-full px-3 py-1 text-sm`
- Queue mode (date fulfilled): existing purple queue status card, unchanged
- Completion summary: selected time e.g. `"14:00"`; in queue mode: `"Queue"`
- Next enabled: time selected (or queue mode — no time required)

### Step 3 — Select your team
- Content: same chip style as Step 2
- Each chip label: `{teamName} · {N} members`
- Chip exceeding `maxParticipants`: `border-destructive text-destructive`
- Warning text below grid if over-limit team is selected
- Completion summary: `"{teamName} · {N} members"`

---

## Error Display

Inline within active step panel, below chips. Uses existing `error` state. No separate footer error block.

---

## Footer

| Step | Left button | Right button |
|------|-------------|--------------|
| 1 | `Cancel` (ghost, closes dialog) | `Next →` (disabled until date selected) |
| 2 | `← Back` (outline) | `Next →` (disabled until time selected; queue mode: always enabled) |
| 3 | `← Back` (outline) | `Reserve` / `Join Queue` (existing disabled logic) |

Back/Next control `currentStep` state (1 \| 2 \| 3). Submit fires `handleSubmit` on step 3 CTA click — no change to submit logic.

---

## New State

Single new piece of state: `const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)`

Reset on dialog close alongside existing resets.

---

## What Does NOT Change

- All hooks: `useMyTeamsAsCreator`, `useCreateReservation`, `useJoinQueue`, `useGetQueuePosition`, `useReservations`, `useReservationStatus`
- `handleSubmit` logic and validation
- PostHog capture calls
- `NativeSelect` removed in favour of chips — `selectedTime` and `selectedTeamId` state type unchanged
- "No teams" empty state dialog — unchanged
- Calendar modifiers and `getDateModifiers` — unchanged
