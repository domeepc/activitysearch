"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { format } from "date-fns";
import { AlertCircle, CheckCircle, CreditCard, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PaymentIntentStatus = "on_hold" | "paid" | "canceled" | "pending" | "refunded";
type BalanceHistoryRange = "7d" | "30d" | "90d" | "all";

interface StripePaymentIntent {
  paymentIntentId: string;
  reservationId: Id<"reservations">;
  teamId: Id<"teams"> | null;
  teamName: string;
  payerName: string;
  personsPaidFor: number;
  activityName: string;
  activityAddress: string;
  date: string;
  time: string;
  status: PaymentIntentStatus;
  stripeStatus: string;
  amount: number;
  collectedAmount: number;
  remainingAmount: number;
  currency: string;
  createdAt: number;
  capturedAt?: number;
  refundedAt?: number;
}

interface StripeBalanceHistoryPoint {
  date: string;
  available: number;
  pending: number;
  grossInflow: number;
  payoutOutflow: number;
  net: number;
}

interface StripeBalanceHistoryData {
  hasConnectedAccount: boolean;
  currency: string;
  range: BalanceHistoryRange;
  points: StripeBalanceHistoryPoint[];
}

const HISTORY_RANGES: Array<{ key: BalanceHistoryRange; label: string; long: string }> = [
  { key: "7d", label: "7D", long: "last 7 days" },
  { key: "30d", label: "30D", long: "last 30 days" },
  { key: "90d", label: "90D", long: "last 90 days" },
  { key: "all", label: "All", long: "all time" },
];

// Fixed order so a status keeps its colour whatever the filter shows.
const STATUS_META: Record<PaymentIntentStatus, { label: string; swatch: string; chip: string }> = {
  paid: { label: "Paid", swatch: "bg-green-600", chip: "bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300" },
  on_hold: { label: "On hold", swatch: "bg-blue-600", chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  pending: { label: "Pending", swatch: "bg-amber-500", chip: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  refunded: { label: "Refunded", swatch: "bg-zinc-400", chip: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  canceled: { label: "Canceled", swatch: "bg-zinc-300 dark:bg-zinc-600", chip: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};
const STATUS_ORDER: PaymentIntentStatus[] = ["paid", "on_hold", "pending", "refunded", "canceled"];

function money(amount: number, currency = "EUR", compact = false) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(amount);
}

function dayLabel(key: string, pattern = "d MMM") {
  try {
    return format(new Date(`${key}T00:00:00`), pattern);
  } catch {
    return key;
  }
}

/** Round the axis max up to a 1/2/5 step so tick labels stay readable. */
function niceMax(value: number) {
  if (value <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

function BalanceChart({ points, currency }: { points: StripeBalanceHistoryPoint[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const balances = points.map((p) => p.available + p.pending);
  const max = niceMax(Math.max(...balances, ...points.map((p) => p.grossInflow), 0));
  const minBalance = Math.min(...balances, 0);
  const lo = minBalance < 0 ? -niceMax(-minBalance) : 0;
  const y = (v: number) => H - ((v - lo) / (max - lo)) * H;
  const step = W / points.length;
  const x = (i: number) => i * step + step / 2;
  const line = balances.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${y(lo)} L${x(0).toFixed(1)} ${y(lo)} Z`;
  const barW = Math.max(2, Math.min(18, step - 4));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => lo + (max - lo) * f);
  const xLabelIdx = points.length <= 4 ? points.map((_, i) => i) : [0, Math.round((points.length - 1) / 3), Math.round(((points.length - 1) * 2) / 3), points.length - 1];
  const hp = hover !== null ? points[hover] : null;
  const first = balances[0] ?? 0;
  const last = balances[balances.length - 1] ?? 0;

  return (
    <div className="grid grid-cols-[48px_1fr] gap-2">
      <div className="flex flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t}>{money(t, currency, true)}</span>
        ))}
      </div>
      <div className="relative min-w-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-56 w-full touch-none overflow-visible"
          role="img"
          aria-label={`Balance went from ${money(first, currency)} to ${money(last, currency)} over ${points.length} days, with daily inflow bars`}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.floor(((e.clientX - r.left) / r.width) * points.length);
            setHover(Math.max(0, Math.min(points.length - 1, i)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} className="stroke-zinc-100 dark:stroke-zinc-800" strokeDasharray={t === lo ? undefined : "3 4"} vectorEffect="non-scaling-stroke" />
          ))}
          {points.map((p, i) =>
            p.grossInflow > 0 ? (
              <rect
                key={p.date}
                x={x(i) - barW / 2}
                y={y(p.grossInflow)}
                width={barW}
                height={Math.max(0, y(lo) - y(p.grossInflow))}
                rx={Math.min(4, barW / 2)}
                className={cn("transition-colors", hover === i ? "fill-blue-300 dark:fill-blue-700" : "fill-blue-200 dark:fill-blue-900")}
              />
            ) : null
          )}
          <path d={area} className="fill-blue-600/10" />
          <path d={line} fill="none" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="stroke-zinc-300 dark:stroke-zinc-600" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {hp && hover !== null && (
          <>
            <span
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 dark:border-zinc-900"
              style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(balances[hover]) / H) * 224}px` }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-lg bg-zinc-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-900"
              style={{
                left: `${(x(hover) / W) * 100}%`,
                transform: hover > points.length / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
              }}
            >
              <b>{dayLabel(hp.date, "EEE d MMM")}</b> · {money(hp.available + hp.pending, currency)} balance
              <br />
              <span className="opacity-80">
                +{money(hp.grossInflow, currency)} in
                {hp.payoutOutflow > 0 && ` · −${money(hp.payoutOutflow, currency)} paid out`}
              </span>
            </div>
          </>
        )}
        <div className="flex justify-between pt-2 text-[11px] text-zinc-500 dark:text-zinc-400" aria-hidden="true">
          {xLabelIdx.map((i) => (
            <span key={i}>{dayLabel(points[i].date)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StripeDashboard() {
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentIntentStatus>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [paymentIntents, setPaymentIntents] = useState<StripePaymentIntent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balanceData, setBalanceData] = useState<{
    hasConnectedAccount: boolean;
    payoutsEnabled: boolean;
    available: number;
    pending: number;
    currency: string;
  } | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [historyRange, setHistoryRange] = useState<BalanceHistoryRange>("30d");
  const [historyData, setHistoryData] = useState<StripeBalanceHistoryData | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const getPaymentIntents = useAction(api.stripe.getStripePaymentIntentsForOrganiser);
  const getStripeBalance = useAction(api.stripe.getOrganiserStripeBalance);
  const getStripeBalanceHistory = useAction(api.stripe.getOrganiserStripeBalanceHistory);
  const requestPayout = useAction(api.stripe.requestOrganiserPayout);

  // Refresh after a payout (the initial loads live in the effects below)
  const loadDashboardData = async () => {
    try {
      const [payments, balance] = await Promise.all([getPaymentIntents({}), getStripeBalance({})]);
      setPaymentIntents(payments);
      setBalanceData(balance);
      setError(null);
    } catch (err) {
      console.error("Error fetching Stripe dashboard data:", err);
      setError(err instanceof Error ? err.message : "Failed to load payment data");
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoryData = async (range: BalanceHistoryRange) => {
    try {
      setHistoryData(await getStripeBalanceHistory({ range }));
      setHistoryError(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Failed to load balance history.");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPaymentIntents({}), getStripeBalance({})])
      .then(([payments, balance]) => {
        if (cancelled) return;
        setPaymentIntents(payments);
        setBalanceData(balance);
        setError(null);
      })
      .catch((err) => {
        console.error("Error fetching Stripe dashboard data:", err);
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load payment data");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getPaymentIntents, getStripeBalance]);

  useEffect(() => {
    let cancelled = false;
    getStripeBalanceHistory({ range: historyRange })
      .then((data) => {
        if (cancelled) return;
        setHistoryData(data);
        setHistoryError(null);
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : "Failed to load balance history.");
      })
      .finally(() => {
        if (!cancelled) setIsHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getStripeBalanceHistory, historyRange]);

  const currency = balanceData?.currency ?? historyData?.currency ?? "EUR";
  const canPayout = !!balanceData?.hasConnectedAccount && !!balanceData.payoutsEnabled && balanceData.available > 0;

  const handleRequestPayout = async () => {
    if (!balanceData?.hasConnectedAccount) { setPayoutError("Connect Stripe account first."); return; }
    if (!balanceData.payoutsEnabled) { setPayoutError("Payouts not enabled yet."); return; }
    const requestedAmount = Number(payoutAmount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) { setPayoutError("Enter a valid amount."); return; }
    if (requestedAmount > balanceData.available) { setPayoutError("That's more than your available balance."); return; }

    setIsRequestingPayout(true);
    setPayoutError(null);
    try {
      const result = await requestPayout({ amount: requestedAmount, currency: balanceData.currency });
      setPayoutSuccess(`Payout of ${money(result.amount, result.currency)} is on its way.`);
      setPayoutOpen(false);
      await Promise.all([loadDashboardData(), loadHistoryData(historyRange)]);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : "Failed to request payout.");
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const rangeLong = HISTORY_RANGES.find((r) => r.key === historyRange)?.long ?? "";
  const totals = useMemo(() => {
    const pts = historyData?.points ?? [];
    return {
      inflow: pts.reduce((s, p) => s + p.grossInflow, 0),
      payouts: pts.reduce((s, p) => s + p.payoutOutflow, 0),
    };
  }, [historyData]);

  const byStatus = useMemo(() => {
    const out = STATUS_ORDER.map((status) => {
      const rows = (paymentIntents ?? []).filter((pi) => pi.status === status);
      return { status, count: rows.length, amount: rows.reduce((s, pi) => s + pi.amount, 0) };
    });
    const total = out.reduce((s, r) => s + r.amount, 0);
    return { rows: out, total };
  }, [paymentIntents]);

  const filteredIntents = useMemo(() => {
    const list = [...(paymentIntents ?? [])].sort((a, b) => b.createdAt - a.createdAt);
    return statusFilter === "all" ? list : list.filter((pi) => pi.status === statusFilter);
  }, [paymentIntents, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white py-20 dark:border-zinc-800 dark:bg-zinc-900">
        <Loader2 className="size-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 dark:bg-red-950/50" role="alert">
        <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  const card = "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {!balanceData?.hasConnectedAccount
            ? "Connect Stripe in your organisation settings to receive payouts."
            : balanceData.payoutsEnabled
              ? "Payouts are enabled."
              : "Stripe is still verifying your account — payouts unlock once it's done."}
        </p>
        <div role="radiogroup" aria-label="Range" className="inline-flex rounded-lg bg-zinc-200/70 p-1 text-[13px] dark:bg-zinc-800">
          {HISTORY_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={historyRange === r.key}
              onClick={() => {
                if (r.key === historyRange) return;
                setIsHistoryLoading(true);
                setHistoryRange(r.key);
              }}
              className={cn(
                "h-[30px] rounded-lg px-3 transition-colors",
                historyRange === r.key
                  ? "bg-white font-semibold text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {payoutSuccess && (
        <p className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-300" role="status">
          <CheckCircle className="size-4 shrink-0" />
          {payoutSuccess}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={cn(card, "flex flex-col gap-2")}>
          <dt className="text-xs text-zinc-600 dark:text-zinc-400">Available</dt>
          <dd className="text-2xl font-bold tracking-tight tabular-nums">{money(balanceData?.available ?? 0, currency)}</dd>
          <Button
            size="sm"
            className="mt-1 self-start font-semibold"
            disabled={!canPayout}
            onClick={() => {
              setPayoutAmount(balanceData ? balanceData.available.toFixed(2) : "");
              setPayoutError(null);
              setPayoutSuccess(null);
              setPayoutOpen(true);
            }}
          >
            Request payout
          </Button>
        </div>
        <div className={cn(card, "flex flex-col gap-2")}>
          <dt className="text-xs text-zinc-600 dark:text-zinc-400">Pending (on hold)</dt>
          <dd className="text-2xl font-bold tracking-tight tabular-nums">{money(balanceData?.pending ?? 0, currency)}</dd>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Released after each activity</span>
        </div>
        <div className={cn(card, "flex flex-col gap-2")}>
          <dt className="text-xs text-zinc-600 dark:text-zinc-400">Inflow · {rangeLong}</dt>
          <dd className="text-2xl font-bold tracking-tight tabular-nums">{historyData?.hasConnectedAccount ? money(totals.inflow, currency) : "—"}</dd>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Card payments captured</span>
        </div>
        <div className={cn(card, "flex flex-col gap-2")}>
          <dt className="text-xs text-zinc-600 dark:text-zinc-400">Paid out · {rangeLong}</dt>
          <dd className="text-2xl font-bold tracking-tight tabular-nums">{historyData?.hasConnectedAccount ? money(totals.payouts, currency) : "—"}</dd>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Sent to your bank</span>
        </div>
      </dl>

      <div className="flex flex-wrap items-stretch gap-4">
        <section aria-labelledby="bal-h" className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-2xl border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 id="bal-h" className="flex-1 text-base font-bold">Balance over time</h2>
            <span className="inline-flex gap-4 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-2"><span className="h-[3px] w-3.5 rounded-sm bg-blue-600" />Balance</span>
              <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-blue-200 dark:bg-blue-900" />Daily inflow</span>
            </span>
          </div>
          {historyError ? (
            <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><AlertCircle className="size-4" />{historyError}</p>
          ) : isHistoryLoading && !historyData ? (
            <div className="flex h-56 items-center justify-center"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>
          ) : !historyData?.hasConnectedAccount ? (
            <p className="flex h-56 items-center justify-center text-sm text-zinc-600 dark:text-zinc-400">Connect Stripe to see your balance history.</p>
          ) : historyData.points.length === 0 ? (
            <p className="flex h-56 items-center justify-center text-sm text-zinc-600 dark:text-zinc-400">No activity in this range yet.</p>
          ) : (
            <div className={cn("transition-opacity", isHistoryLoading && "opacity-50")}>
              <BalanceChart points={historyData.points} currency={historyData.currency} />
            </div>
          )}
        </section>

        <section aria-labelledby="mix-h" className="flex flex-[1_1_320px] flex-col gap-4 rounded-2xl border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 id="mix-h" className="text-base font-bold">Payment status</h2>
          {byStatus.total === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No payments yet.</p>
          ) : (
            <>
              <div
                role="img"
                aria-label={`Payments by status: ${byStatus.rows.filter((r) => r.amount > 0).map((r) => `${STATUS_META[r.status].label} ${Math.round((r.amount / byStatus.total) * 100)}%`).join(", ")}`}
                className="flex h-3.5 gap-1 overflow-hidden rounded-full"
              >
                {byStatus.rows.filter((r) => r.amount > 0).map((r) => (
                  <span key={r.status} className={STATUS_META[r.status].swatch} style={{ width: `${(r.amount / byStatus.total) * 100}%` }} />
                ))}
              </div>
              <ul className="flex flex-col gap-3 text-[13px]">
                {byStatus.rows.filter((r) => r.count > 0).map((r) => (
                  <li key={r.status} className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-sm", STATUS_META[r.status].swatch)} />
                    <span className="flex-1">{STATUS_META[r.status].label} <span className="text-zinc-500">· {r.count}</span></span>
                    <b className="tabular-nums">{money(r.amount, currency)}</b>
                    <span className="w-9 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{Math.round((r.amount / byStatus.total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="tx-h" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <h2 id="tx-h" className="flex-1 text-base font-bold">Payments</h2>
          <div className="flex flex-wrap gap-2">
            {(["all", ...STATUS_ORDER] as const)
              .filter((k) => k === "all" || byStatus.rows.find((r) => r.status === k)!.count > 0)
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={statusFilter === k}
                  onClick={() => setStatusFilter(k)}
                  className={cn(
                    "h-[30px] rounded-full border px-3 text-xs transition-colors",
                    statusFilter === k
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
                  )}
                >
                  {k === "all" ? "All" : STATUS_META[k].label}
                </button>
              ))}
          </div>
        </div>
        {filteredIntents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-zinc-600 dark:text-zinc-400">
            <CreditCard className="size-8 opacity-30" />
            No payments here yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-zinc-50 text-left text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Payer</th>
                  <th className="px-3 py-3 font-medium">Activity</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredIntents.map((intent) => {
                  const negative = intent.status === "refunded" || intent.status === "canceled";
                  return (
                    <tr key={`${intent.paymentIntentId}-${intent.reservationId}`} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-5 py-3 whitespace-nowrap">{format(new Date(intent.createdAt), "d MMM")}</td>
                      <td className="px-3 py-3">
                        {intent.payerName} <span className="text-zinc-500">· {intent.teamName}</span>
                        {intent.personsPaidFor > 1 && <span className="block text-xs text-zinc-500">covers {intent.personsPaidFor} people</span>}
                      </td>
                      <td className="px-3 py-3">
                        {intent.activityName}
                        <span className="block text-xs text-zinc-500">{dayLabel(intent.date, "EEE d MMM")} · {intent.time}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap", STATUS_META[intent.status].chip)}>
                          {STATUS_META[intent.status].label}
                        </span>
                      </td>
                      <td className={cn("px-5 py-3 text-right font-semibold tabular-nums", negative && "text-zinc-500")}>
                        {intent.status === "refunded" ? "−" : ""}
                        {money(intent.amount, intent.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Request a payout</DialogTitle>
            <DialogDescription>
              Up to {money(balanceData?.available ?? 0, currency)} can be sent to your bank account now.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleRequestPayout();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="payout-amount">Amount ({currency})</Label>
              <Input
                id="payout-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                max={balanceData?.available}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="h-11 text-base tabular-nums"
                autoFocus
              />
            </div>
            {payoutError && (
              <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400" role="alert">
                <AlertCircle className="size-4 shrink-0" />
                {payoutError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" className="h-10" onClick={() => setPayoutOpen(false)}>
                Not now
              </Button>
              <Button type="submit" className="h-10 font-semibold" disabled={isRequestingPayout || Number(payoutAmount) <= 0}>
                {isRequestingPayout ? "Requesting…" : `Pay out ${money(Number(payoutAmount) || 0, currency)}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
