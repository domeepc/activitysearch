"use client";

import { useState, useMemo, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type PaymentIntentStatus = "on_hold" | "paid" | "canceled" | "pending";

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

export function StripeDashboard() {
  const isMobile = useIsMobile();
  const [statusFilter, setStatusFilter] = useState<
    "all" | PaymentIntentStatus
  >("all");
  const [isLoading, setIsLoading] = useState(true);
  const [paymentIntents, setPaymentIntents] = useState<
    StripePaymentIntent[] | null
  >(null);
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

  const getPaymentIntents = useAction(api.stripe.getStripePaymentIntentsForOrganiser);
  const getStripeBalance = useAction(api.stripe.getOrganiserStripeBalance);
  const requestPayout = useAction(api.stripe.requestOrganiserPayout);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [payments, balance] = await Promise.all([
        getPaymentIntents({}),
        getStripeBalance({}),
      ]);
      setPaymentIntents(payments);
      setBalanceData(balance);
      setPayoutAmount((prev) =>
        prev ? prev : balance.available > 0 ? balance.available.toFixed(2) : ""
      );
    } catch (err) {
      console.error("Error fetching Stripe dashboard data:", err);
      setError(err instanceof Error ? err.message : "Failed to load payment data");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch payment intents and balance once on mount
  useEffect(() => {
    void loadDashboardData();
    // Intentionally no interval polling; refresh is action-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getPaymentIntents, getStripeBalance]);

  const handleRequestPayout = async () => {
    if (!balanceData?.hasConnectedAccount) {
      setPayoutError("Connect Stripe account first to request payouts.");
      return;
    }
    if (!balanceData.payoutsEnabled) {
      setPayoutError("Payouts are not enabled yet on your Stripe account.");
      return;
    }

    const requestedAmount = Number(payoutAmount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      setPayoutError("Enter a valid payout amount greater than 0.");
      return;
    }
    if (requestedAmount > balanceData.available) {
      setPayoutError("Requested amount exceeds your available balance.");
      return;
    }

    setIsRequestingPayout(true);
    setPayoutError(null);
    setPayoutSuccess(null);
    try {
      const result = await requestPayout({
        amount: requestedAmount,
        currency: balanceData.currency,
      });
      setPayoutSuccess(
        `Payout ${result.payoutId} requested for ${formatCurrency(
          result.amount,
          result.currency
        )}.`
      );
      await loadDashboardData();
    } catch (err) {
      setPayoutError(
        err instanceof Error ? err.message : "Failed to request payout."
      );
    } finally {
      setIsRequestingPayout(false);
    }
  };

  // Filter payment intents by status
  const filteredIntents = useMemo(() => {
    if (!paymentIntents) return [];
    if (statusFilter === "all") return paymentIntents;
    return paymentIntents.filter((pi) => pi.status === statusFilter);
  }, [paymentIntents, statusFilter]);

  const formatCurrency = (amount: number, currency: string = "EUR") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + "T00:00:00"), "MMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: PaymentIntentStatus) => {
    switch (status) {
      case "on_hold":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            On Hold
          </Badge>
        );
      case "paid":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600 gap-1">
            <CheckCircle className="h-3 w-3" />
            Paid
          </Badge>
        );
      case "canceled":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Canceled
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    if (!paymentIntents) {
      return { total: 0, onHold: 0, paid: 0, canceled: 0, pending: 0 };
    }
    return {
      total: paymentIntents.length,
      onHold: paymentIntents.filter((pi) => pi.status === "on_hold").length,
      paid: paymentIntents.filter((pi) => pi.status === "paid").length,
      canceled: paymentIntents.filter((pi) => pi.status === "canceled").length,
      pending: paymentIntents.filter((pi) => pi.status === "pending").length,
    };
  }, [paymentIntents]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Payment Intents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Payment Intents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Stripe Payment Intents
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Each row is one teammate&apos;s card hold. Multiple rows per team are
          normal. Customer totals are all-in; your net after Stripe and platform
          fees may be lower than the listed activity price.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">Stripe Balance</p>
            {!balanceData?.hasConnectedAccount ? (
              <Badge variant="outline">Not connected</Badge>
            ) : balanceData.payoutsEnabled ? (
              <Badge className="bg-green-500 hover:bg-green-600">Payouts enabled</Badge>
            ) : (
              <Badge variant="secondary">Payouts pending setup</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-lg font-semibold text-green-600">
                {formatCurrency(balanceData?.available ?? 0, balanceData?.currency ?? "EUR")}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-semibold">
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
              disabled={!balanceData?.hasConnectedAccount || !balanceData?.payoutsEnabled}
            />
            <Button
              onClick={handleRequestPayout}
              disabled={
                isRequestingPayout ||
                !balanceData?.hasConnectedAccount ||
                !balanceData?.payoutsEnabled ||
                Number(payoutAmount) <= 0
              }
            >
              {isRequestingPayout ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                "Request payout"
              )}
            </Button>
          </div>
          {payoutError && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {payoutError}
            </p>
          )}
          {payoutSuccess && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              {payoutSuccess}
            </p>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            All ({stats.total})
          </Button>
          <Button
            variant={statusFilter === "on_hold" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("on_hold")}
          >
            On Hold ({stats.onHold})
          </Button>
          <Button
            variant={statusFilter === "paid" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("paid")}
          >
            Paid ({stats.paid})
          </Button>
          <Button
            variant={statusFilter === "canceled" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("canceled")}
          >
            Canceled ({stats.canceled})
          </Button>
          <Button
            variant={statusFilter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("pending")}
          >
            Pending ({stats.pending})
          </Button>
        </div>

        {/* Payment Intents: mobile cards or desktop table */}
        {filteredIntents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No payment intents found{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.</p>
          </div>
        ) : isMobile ? (
          <div className="space-y-4">
            {filteredIntents.map((intent) => (
              <Card
                key={`${intent.paymentIntentId}-${intent.reservationId}`}
                className="overflow-hidden border-border"
              >
                <CardContent className="p-4 space-y-3">
                  {/* Activity & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">
                        {intent.activityName}
                      </h3>
                      {intent.activityAddress && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{intent.activityAddress}</span>
                        </div>
                      )}
                    </div>
                    {getStatusBadge(intent.status)}
                  </div>

                  {/* Team & payer */}
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">
                      {intent.teamName}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground pl-6">
                    Payer: {intent.payerName}
                    {intent.personsPaidFor > 1
                      ? ` · covers ${intent.personsPaidFor} people`
                      : ""}
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{formatDate(intent.date)}</span>
                    <span className="text-muted-foreground">at</span>
                    <span>{intent.time}</span>
                  </div>

                  {/* Amounts */}
                  <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Wallet className="h-3.5 w-3.5" />
                        Collected
                      </span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(intent.collectedAmount, intent.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        This card (auth)
                      </span>
                      <span>{formatCurrency(intent.amount, intent.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Remaining</span>
                      <span
                        className={
                          intent.remainingAmount > 0
                            ? "font-semibold text-orange-600"
                            : "text-muted-foreground"
                        }
                      >
                        {formatCurrency(intent.remainingAmount, intent.currency)}
                      </span>
                    </div>
                  </div>

                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Payment Intent ID
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Team
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Payer
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Activity
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Date & Time
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Collected (Saldo)
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    This card
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredIntents.map((intent) => (
                  <tr
                    key={`${intent.paymentIntentId}-${intent.reservationId}`}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <td className="p-4 align-middle font-mono text-xs">
                      {intent.paymentIntentId.substring(0, 20)}...
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-medium">{intent.teamName}</div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-medium">{intent.payerName}</div>
                      {intent.personsPaidFor > 1 && (
                        <div className="text-xs text-muted-foreground">
                          {intent.personsPaidFor} people
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <div>
                        <div className="font-medium">{intent.activityName}</div>
                        {intent.activityAddress && (
                          <div className="text-sm text-muted-foreground">
                            {intent.activityAddress}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div>
                        <div className="font-medium">{formatDate(intent.date)}</div>
                        <div className="text-sm text-muted-foreground">
                          {intent.time}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-middle">{getStatusBadge(intent.status)}</td>
                    <td className="p-4 align-middle font-semibold text-green-600">
                      {formatCurrency(intent.collectedAmount, intent.currency)}
                    </td>
                    <td className="p-4 align-middle">
                      {formatCurrency(intent.amount, intent.currency)}
                    </td>
                    <td
                      className={`p-4 align-middle ${intent.remainingAmount > 0
                          ? "font-semibold text-orange-600"
                          : "text-muted-foreground"
                        }`}
                    >
                      {formatCurrency(intent.remainingAmount, intent.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
