"use client";

import { useState, useMemo, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  MapPin,
  Calendar,
  Wallet,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { Id } from "@/convex/_generated/dataModel";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
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

const HISTORY_RANGES: Array<{ key: BalanceHistoryRange; label: string }> = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "All" },
];

const STATUS_FILTERS: Array<{ key: "all" | PaymentIntentStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "on_hold", label: "On Hold" },
  { key: "paid", label: "Paid" },
  { key: "canceled", label: "Canceled" },
  { key: "refunded", label: "Refunded" },
  { key: "pending", label: "Pending" },
];

function buildLinePath(
  values: number[],
  width: number,
  height: number,
  minValue: number,
  maxValue: number
): string {
  if (values.length === 0) return "";
  const xStep = values.length > 1 ? width / (values.length - 1) : width;
  const valueRange = Math.max(maxValue - minValue, 1);
  return values
    .map((value, idx) => {
      const x = idx * xStep;
      const y = height - ((value - minValue) / valueRange) * height;
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function MiniTrendChart({
  title,
  currency,
  points,
  series,
}: {
  title: string;
  currency: string;
  points: StripeBalanceHistoryPoint[];
  series: Array<{
    label: string;
    lineClass: string;
    dotClass: string;
    getValue: (point: StripeBalanceHistoryPoint) => number;
  }>;
}) {
  const width = 720;
  const height = 220;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);

  if (points.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-zinc-100 p-5">
        <p className="text-sm font-semibold text-zinc-900 mb-1">{title}</p>
        <p className="text-sm text-zinc-400">No data for this range.</p>
      </div>
    );
  }

  const allValues = series.flatMap((s) => points.map(s.getValue));
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);

  return (
    <div className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <p className="text-xs text-zinc-400">
          {points[0]?.date} – {points[points.length - 1]?.date}
        </p>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[520px] h-44" role="img" aria-label={title}>
          <line x1="0" y1={height} x2={width} y2={height} stroke="#f4f4f5" strokeWidth="1" />
          {series.map((s) => (
            <path
              key={s.label}
              d={buildLinePath(points.map(s.getValue), width, height, minValue, maxValue)}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={s.lineClass}
            />
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        {series.map((s) => (
          <div key={s.label} className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${s.dotClass}`} />
            <span className="text-zinc-500">{s.label}</span>
            <span className="font-semibold text-zinc-900">{formatCurrency(s.getValue(points[points.length - 1]))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StripeDashboard() {
  const isMobile = useIsMobile();
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
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [historyRange, setHistoryRange] = useState<BalanceHistoryRange>("30d");
  const [historyData, setHistoryData] = useState<StripeBalanceHistoryData | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const getPaymentIntents = useAction(api.stripe.getStripePaymentIntentsForOrganiser);
  const getStripeBalance = useAction(api.stripe.getOrganiserStripeBalance);
  const getStripeBalanceHistory = useAction(api.stripe.getOrganiserStripeBalanceHistory);
  const requestPayout = useAction(api.stripe.requestOrganiserPayout);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [payments, balance] = await Promise.all([getPaymentIntents({}), getStripeBalance({})]);
      setPaymentIntents(payments);
      setBalanceData(balance);
      setPayoutAmount((prev) => prev ? prev : balance.available > 0 ? balance.available.toFixed(2) : "");
    } catch (err) {
      console.error("Error fetching Stripe dashboard data:", err);
      setError(err instanceof Error ? err.message : "Failed to load payment data");
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoryData = async (range: BalanceHistoryRange) => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistoryData(await getStripeBalanceHistory({ range }));
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Failed to load balance history.");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => { void loadDashboardData(); }, [getPaymentIntents, getStripeBalance]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadHistoryData(historyRange); }, [getStripeBalanceHistory, historyRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRequestPayout = async () => {
    if (!balanceData?.hasConnectedAccount) { setPayoutError("Connect Stripe account first."); return; }
    if (!balanceData.payoutsEnabled) { setPayoutError("Payouts not enabled yet."); return; }
    const requestedAmount = Number(payoutAmount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) { setPayoutError("Enter a valid amount."); return; }
    if (requestedAmount > balanceData.available) { setPayoutError("Exceeds available balance."); return; }

    setIsRequestingPayout(true);
    setPayoutError(null);
    setPayoutSuccess(null);
    try {
      const result = await requestPayout({ amount: requestedAmount, currency: balanceData.currency });
      setPayoutSuccess(`Payout ${result.payoutId} requested for ${formatCurrency(result.amount, result.currency)}.`);
      await Promise.all([loadDashboardData(), loadHistoryData(historyRange)]);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : "Failed to request payout.");
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const filteredIntents = useMemo(() => {
    if (!paymentIntents) return [];
    return statusFilter === "all" ? paymentIntents : paymentIntents.filter((pi) => pi.status === statusFilter);
  }, [paymentIntents, statusFilter]);

  const formatCurrency = (amount: number, currency = "EUR") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr + "T00:00:00"), "MMM dd, yyyy"); } catch { return dateStr; }
  };

  const getStatusBadge = (status: PaymentIntentStatus) => {
    switch (status) {
      case "on_hold": return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />On Hold</Badge>;
      case "paid": return <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1"><CheckCircle className="h-3 w-3" />Paid</Badge>;
      case "canceled": return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Canceled</Badge>;
      case "refunded": return <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700"><CheckCircle className="h-3 w-3" />Refunded</Badge>;
      case "pending": return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />Pending</Badge>;
    }
  };

  const stats = useMemo(() => {
    if (!paymentIntents) return { total: 0, on_hold: 0, paid: 0, canceled: 0, refunded: 0, pending: 0 };
    return {
      total: paymentIntents.length,
      on_hold: paymentIntents.filter((pi) => pi.status === "on_hold").length,
      paid: paymentIntents.filter((pi) => pi.status === "paid").length,
      canceled: paymentIntents.filter((pi) => pi.status === "canceled").length,
      refunded: paymentIntents.filter((pi) => pi.status === "refunded").length,
      pending: paymentIntents.filter((pi) => pi.status === "pending").length,
    };
  }, [paymentIntents]);

  const getStatCount = (key: "all" | PaymentIntentStatus) => key === "all" ? stats.total : stats[key];

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-100">
            <CreditCard className="h-4 w-4 text-zinc-500" />
          </div>
          <h2 className="text-base font-semibold text-zinc-900">Payments</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-100">
            <CreditCard className="h-4 w-4 text-zinc-500" />
          </div>
          <h2 className="text-base font-semibold text-zinc-900">Payments</h2>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-100">
          <CreditCard className="h-4 w-4 text-zinc-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Payments</h2>
          <p className="text-xs text-zinc-400">Each row is one teammate&apos;s card hold. Net after fees may differ from listed price.</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Balance — light panel */}
        <div className="rounded-2xl bg-zinc-50 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">Stripe Balance</p>
            {!balanceData?.hasConnectedAccount ? (
              <Badge variant="outline" className="text-zinc-500">Not connected</Badge>
            ) : balanceData.payoutsEnabled ? (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">Payouts enabled</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">Pending setup</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white border border-zinc-100 p-4">
              <p className="text-xs text-zinc-400 mb-1">Available</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(balanceData?.available ?? 0, balanceData?.currency ?? "EUR")}
              </p>
            </div>
            <div className="rounded-xl bg-white border border-zinc-100 p-4">
              <p className="text-xs text-zinc-400 mb-1">Pending</p>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(balanceData?.pending ?? 0, balanceData?.currency ?? "EUR")}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              placeholder="Payout amount"
              className="bg-white"
              disabled={!balanceData?.hasConnectedAccount || !balanceData?.payoutsEnabled}
            />
            <Button
              onClick={handleRequestPayout}
              className="shrink-0"
              disabled={isRequestingPayout || !balanceData?.hasConnectedAccount || !balanceData?.payoutsEnabled || Number(payoutAmount) <= 0}
            >
              {isRequestingPayout ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Requesting...</> : "Request payout"}
            </Button>
          </div>
          {payoutError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />{payoutError}
            </p>
          )}
          {payoutSuccess && (
            <p className="text-sm text-emerald-600 flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 shrink-0" />{payoutSuccess}
            </p>
          )}
        </div>

        {/* Balance History */}
        <div className="rounded-2xl bg-zinc-50 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-zinc-900">Balance History</p>
            <div className="flex items-center gap-1 rounded-lg bg-white border border-zinc-100 p-1">
              {HISTORY_RANGES.map((range) => (
                <button
                  key={range.key}
                  onClick={() => setHistoryRange(range.key)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    historyRange === range.key ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {historyError ? (
            <p className="text-sm text-red-500 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />{historyError}</p>
          ) : isHistoryLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
          ) : historyData?.hasConnectedAccount ? (
            <div className="space-y-3">
              <MiniTrendChart
                title="Available vs Pending"
                currency={historyData.currency}
                points={historyData.points}
                series={[
                  { label: "Available", lineClass: "stroke-emerald-500", dotClass: "bg-emerald-500", getValue: (p) => p.available },
                  { label: "Pending", lineClass: "stroke-amber-500", dotClass: "bg-amber-500", getValue: (p) => p.pending },
                ]}
              />
              <MiniTrendChart
                title="Inflow · Payouts · Net"
                currency={historyData.currency}
                points={historyData.points}
                series={[
                  { label: "Inflow", lineClass: "stroke-blue-500", dotClass: "bg-blue-500", getValue: (p) => p.grossInflow },
                  { label: "Payouts", lineClass: "stroke-rose-500", dotClass: "bg-rose-500", getValue: (p) => p.payoutOutflow },
                  { label: "Net", lineClass: "stroke-violet-500", dotClass: "bg-violet-500", getValue: (p) => p.net },
                ]}
              />
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Connect Stripe to view balance history.</p>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
              )}
            >
              {label} ({getStatCount(key)})
            </button>
          ))}
        </div>

        {/* Payment intents */}
        {filteredIntents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <CreditCard className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No payments{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.</p>
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {filteredIntents.map((intent) => (
              <div key={`${intent.paymentIntentId}-${intent.reservationId}`} className="rounded-2xl bg-zinc-50 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-zinc-900 truncate">{intent.activityName}</h3>
                    {intent.activityAddress && (
                      <div className="flex items-center gap-1 text-xs text-zinc-400 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{intent.activityAddress}</span>
                      </div>
                    )}
                  </div>
                  {getStatusBadge(intent.status)}
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <Users className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className="font-medium truncate">{intent.teamName}</span>
                </div>
                <div className="text-xs text-zinc-400 pl-6">
                  Payer: {intent.payerName}{intent.personsPaidFor > 1 ? ` · covers ${intent.personsPaidFor} people` : ""}
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className="font-medium">{formatDate(intent.date)}</span>
                  <span className="text-zinc-400">at</span>
                  <span>{intent.time}</span>
                </div>
                <div className="rounded-xl bg-white border border-zinc-100 p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400 flex items-center gap-1"><Wallet className="h-3.5 w-3.5" />Collected</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(intent.collectedAmount, intent.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">This card (auth)</span>
                    <span className="text-zinc-700">{formatCurrency(intent.amount, intent.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Remaining</span>
                    <span className={intent.remainingAmount > 0 ? "font-semibold text-orange-600" : "text-zinc-400"}>
                      {formatCurrency(intent.remainingAmount, intent.currency)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  {["Payment ID", "Team", "Payer", "Activity", "Date & Time", "Status", "Collected", "This card", "Remaining"].map((h) => (
                    <th key={h} className="h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-zinc-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredIntents.map((intent) => (
                  <tr key={`${intent.paymentIntentId}-${intent.reservationId}`} className="border-b border-zinc-50 transition-colors hover:bg-zinc-50">
                    <td className="p-4 align-middle font-mono text-xs text-zinc-400">{intent.paymentIntentId.substring(0, 20)}…</td>
                    <td className="p-4 align-middle font-medium text-zinc-900">{intent.teamName}</td>
                    <td className="p-4 align-middle">
                      <div className="font-medium text-zinc-900">{intent.payerName}</div>
                      {intent.personsPaidFor > 1 && <div className="text-xs text-zinc-400">{intent.personsPaidFor} people</div>}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-medium text-zinc-900">{intent.activityName}</div>
                      {intent.activityAddress && <div className="text-xs text-zinc-400">{intent.activityAddress}</div>}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-medium text-zinc-900">{formatDate(intent.date)}</div>
                      <div className="text-xs text-zinc-400">{intent.time}</div>
                    </td>
                    <td className="p-4 align-middle">{getStatusBadge(intent.status)}</td>
                    <td className="p-4 align-middle font-semibold text-emerald-600">{formatCurrency(intent.collectedAmount, intent.currency)}</td>
                    <td className="p-4 align-middle text-zinc-700">{formatCurrency(intent.amount, intent.currency)}</td>
                    <td className={cn("p-4 align-middle", intent.remainingAmount > 0 ? "font-semibold text-orange-600" : "text-zinc-400")}>
                      {formatCurrency(intent.remainingAmount, intent.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
