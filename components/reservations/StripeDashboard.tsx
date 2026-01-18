"use client";

import { useState, useMemo, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Id } from "@/convex/_generated/dataModel";

type PaymentIntentStatus = "on_hold" | "paid" | "canceled" | "pending";

interface StripePaymentIntent {
  paymentIntentId: string;
  reservationId: Id<"reservations">;
  teamId: Id<"teams"> | null;
  teamName: string;
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
  stripeDashboardUrl: string;
}

export function StripeDashboard() {
  const [statusFilter, setStatusFilter] = useState<
    "all" | PaymentIntentStatus
  >("all");
  const [isLoading, setIsLoading] = useState(true);
  const [paymentIntents, setPaymentIntents] = useState<
    StripePaymentIntent[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const getPaymentIntents = useAction(api.stripe.getStripePaymentIntentsForOrganizer);

  // Fetch payment intents on mount and set up auto-refresh
  useEffect(() => {
    const fetchData = () => {
      setIsLoading(true);
      setError(null);
      getPaymentIntents({})
        .then((data) => {
          setPaymentIntents(data);
        })
        .catch((err) => {
          console.error("Error fetching payment intents:", err);
          setError(err instanceof Error ? err.message : "Failed to load payment intents");
        })
        .finally(() => {
          setIsLoading(false);
        });
    };

    // Fetch immediately
    fetchData();

    // Set up auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);

    return () => clearInterval(interval);
  }, [getPaymentIntents]);

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
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Payment Intents Table */}
        {filteredIntents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No payment intents found{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.</p>
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
                    Activity
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Date & Time
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Collected (Soldo)
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Total Amount
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Remaining
                  </th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredIntents.map((intent) => (
                  <tr
                    key={intent.paymentIntentId}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <td className="p-4 align-middle font-mono text-xs">
                      {intent.paymentIntentId.substring(0, 20)}...
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-medium">{intent.teamName}</div>
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
                    <td className="p-4 align-middle">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          window.open(intent.stripeDashboardUrl, "_blank")
                        }
                        className="gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View in Stripe
                      </Button>
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
