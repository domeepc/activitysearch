"use client";

import { useMemo, useState } from "react";
import { format, isToday, startOfDay } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, Inbox, MoreHorizontal, Search, Users, X } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCancelReservation } from "@/lib/hooks/useReservations";
import { cn } from "@/lib/utils";

interface Reservation {
  _id: Id<"reservations">;
  date: string;
  time: string;
  userCount: bigint;
  activityId: Id<"activities">;
  teamIds: Id<"teams">[];
  createdBy: Id<"users">;
  cancelledAt?: number;
  cancellationReason?: string;
  readByOrganizer?: boolean;
  activity: {
    _id: Id<"activities">;
    activityName: string;
    address: string;
  } | null;
  user: {
    _id: Id<"users">;
    name: string;
    lastname: string;
    username: string;
    slug: string;
    avatar: string;
  } | null;
  teams: Array<{
    _id: Id<"teams">;
    teamName: string;
    slug: string;
  }>;
}

type Filter = "upcoming" | "past" | "cancelled" | "all";
type Status = "today" | "upcoming" | "past" | "cancelled";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const STATUS: Record<Status, { label: string; chip: string }> = {
  today: { label: "Today", chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  upcoming: { label: "Upcoming", chip: "bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300" },
  past: { label: "Done", chip: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  cancelled: { label: "Cancelled", chip: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300" },
};

function dateOf(r: Reservation) {
  return new Date(`${r.date}T00:00:00`);
}

function statusOf(r: Reservation): Status {
  if (r.cancelledAt) return "cancelled";
  const d = dateOf(r);
  if (isToday(d)) return "today";
  return d < startOfDay(new Date()) ? "past" : "upcoming";
}

function DateBlock({ r }: { r: Reservation }) {
  const d = dateOf(r);
  return (
    <span className="flex w-12 shrink-0 flex-col items-center self-start rounded-xl border border-zinc-200 py-1 leading-none dark:border-zinc-700">
      <span className="text-[10px] font-semibold uppercase text-zinc-500">{format(d, "MMM")}</span>
      <span className="text-lg font-bold">{format(d, "d")}</span>
      <span className="text-[10px] text-zinc-500">{format(d, "EEE")}</span>
    </span>
  );
}

function StatusChip({ r }: { r: Reservation }) {
  const s = STATUS[statusOf(r)];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold", s.chip)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {s.label}
    </span>
  );
}

interface ReservationTableProps {
  reservations: Reservation[];
  isLoading?: boolean;
}

export function ReservationTable({ reservations, isLoading = false }: ReservationTableProps) {
  const { cancelReservation, isPending } = useCancelReservation();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [reason, setReason] = useState("");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { upcoming: 0, past: 0, cancelled: 0, all: reservations.length };
    for (const r of reservations) {
      const s = statusOf(r);
      if (s === "cancelled") c.cancelled++;
      else if (s === "past") c.past++;
      else c.upcoming++;
    }
    return c;
  }, [reservations]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = reservations.filter((r) => {
      const s = statusOf(r);
      if (filter === "upcoming" && s !== "upcoming" && s !== "today") return false;
      if (filter === "past" && s !== "past") return false;
      if (filter === "cancelled" && s !== "cancelled") return false;
      if (!q) return true;
      return [
        r.activity?.activityName,
        r.user && `${r.user.name} ${r.user.lastname} ${r.user.username}`,
        ...r.teams.map((t) => t.teamName),
      ].some((v) => v?.toLowerCase().includes(q));
    });
    const key = (r: Reservation) => `${r.date} ${r.time}`;
    // Upcoming reads soonest-first; everything else newest-first.
    return list.sort((a, b) => (filter === "upcoming" ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a))));
  }, [reservations, filter, query]);

  const handleCancelConfirm = async () => {
    if (!selected || !reason.trim()) return;
    try {
      const result = await cancelReservation(selected._id, reason.trim());
      setSelected(null);
      setReason("");
      toast.success("Reservation cancelled. The team is refunded.");
      if (result.autoAssigned) toast.info("The first team in the queue got the freed spot.");
      else if (result.queueNotified) toast.info("The first team in the queue has been notified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel reservation");
    }
  };

  const rowMenu = (r: Reservation) =>
    r.cancelledAt ? null : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-9" aria-label="Reservation actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setReason("");
              setSelected(r);
            }}
          >
            <X /> Cancel reservation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

  const bookedBy = (r: Reservation) => (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-7">
        <AvatarImage src={r.user?.avatar} alt="" />
        <AvatarFallback name={r.user ? `${r.user.name} ${r.user.lastname}` : "Unknown"} />
      </Avatar>
      <span className="min-w-0">
        <b className="block truncate text-sm font-medium">
          {r.user ? `${r.user.name} ${r.user.lastname}` : "Unknown"}
        </b>
        <span className="block truncate text-xs text-zinc-500">
          {r.teams.length > 0 ? r.teams.map((t) => t.teamName).join(", ") : r.user ? `@${r.user.username}` : ""}
        </span>
      </span>
    </span>
  );

  return (
    <section aria-labelledby="res-h" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5 dark:border-zinc-800">
        <h2 id="res-h" className="sr-only">Reservations</h2>
        <div role="tablist" aria-label="Filter reservations" className="inline-flex max-w-full overflow-x-auto rounded-xl bg-zinc-100 p-1 text-sm [scrollbar-width:none] dark:bg-zinc-800">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 transition-colors",
                filter === key
                  ? "bg-white font-semibold text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              )}
            >
              {label}
              <span className="text-xs tabular-nums text-zinc-500">{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <Input
            aria-label="Search reservations"
            placeholder="Search activity, person or team"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 bg-zinc-50 pl-9 dark:bg-zinc-800/60"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-zinc-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Inbox className="size-5" />
          </span>
          {query.trim()
            ? `Nothing matches “${query.trim()}”.`
            : filter === "upcoming"
              ? "No upcoming reservations yet. New bookings show up here."
              : `No ${filter === "all" ? "" : filter + " "}reservations.`}
        </div>
      ) : (
        <>
          {/* Desktop / tablet */}
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                <th className="py-3 pl-5 pr-3 font-medium">When</th>
                <th className="px-3 py-3 font-medium">Activity</th>
                <th className="px-3 py-3 font-medium">Booked by</th>
                <th className="px-3 py-3 font-medium">People</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="py-3 pl-3 pr-5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r._id}
                  className={cn(
                    "border-t border-zinc-100 transition-colors hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/40",
                    r.cancelledAt && "text-zinc-500"
                  )}
                >
                  <td className="py-3 pl-5 pr-3">
                    <span className="flex items-center gap-3">
                      <DateBlock r={r} />
                      <span className="font-semibold tabular-nums">{r.time}</span>
                    </span>
                  </td>
                  <td className="max-w-[16rem] px-3 py-3">
                    <b className="block truncate font-medium">{r.activity?.activityName ?? "Unknown activity"}</b>
                    {r.activity?.address && <span className="block truncate text-xs text-zinc-500">{r.activity.address}</span>}
                  </td>
                  <td className="max-w-[14rem] px-3 py-3">{bookedBy(r)}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Users className="size-4 text-zinc-400" aria-hidden="true" />
                      {Number(r.userCount)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusChip r={r} />
                    {r.cancellationReason && (
                      <span className="mt-1 block max-w-[12rem] truncate text-xs text-zinc-500" title={r.cancellationReason}>
                        {r.cancellationReason}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-3 pr-5 text-right">{rowMenu(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Phone */}
          <ul className="flex flex-col md:hidden">
            {rows.map((r) => (
              <li key={r._id} className="flex gap-3 border-t border-zinc-100 px-4 py-4 first:border-t-0 dark:border-zinc-800">
                <DateBlock r={r} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm font-semibold">{r.activity?.activityName ?? "Unknown activity"}</b>
                      <span className="text-xs text-zinc-500">
                        {r.time} · {Number(r.userCount)} people
                      </span>
                    </span>
                    <StatusChip r={r} />
                  </div>
                  {bookedBy(r)}
                  {r.cancellationReason && <p className="text-xs text-zinc-500">“{r.cancellationReason}”</p>}
                </div>
                <div className="-mr-2 self-start">{rowMenu(r)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300">
            <AlertCircle className="size-5" />
          </span>
          <DialogHeader>
            <DialogTitle>Cancel this reservation?</DialogTitle>
            <DialogDescription>
              The team is refunded in full and the first team in the queue is offered the spot.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">
              <b>{selected.activity?.activityName ?? "Activity"}</b>
              <br />
              <span className="text-zinc-600 dark:text-zinc-400">
                {format(dateOf(selected), "EEE, d MMM")} · {selected.time} · {selected.teams.map((t) => t.teamName).join(", ") || "Team"}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-cancel-reason">Reason (shared with the team)</Label>
            <Textarea
              id="org-cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bad weather forecast"
              rows={3}
              className="resize-none"
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-10" onClick={() => setSelected(null)} disabled={isPending}>
              Keep it
            </Button>
            <Button variant="destructive" className="h-10 font-semibold" onClick={handleCancelConfirm} disabled={isPending || !reason.trim()}>
              {isPending ? "Cancelling…" : "Cancel & refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
