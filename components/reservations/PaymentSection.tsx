"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, CreditCard, CheckCircle, Clock, Users, Calendar, MapPin } from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { StripeDashboard } from "./StripeDashboard";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export function PaymentSection() {
  const isMobile = useIsMobile();
  const paymentDetails = useQuery(api.reservations.getPaymentDetailsForOrganiser);
  const [paymentFilter, setPaymentFilter] = useState<
    "all" | "pending" | "on_hold" | "fulfilled"
  >("all");
  const [viewMode, setViewMode] = useState<"overview" | "stripe">("overview");

  // Calculate payment statistics
  const paymentStats = useMemo(() => {
    if (!paymentDetails) {
      return {
        total: 0,
        pending: 0,
        onHold: 0,
        fulfilled: 0,
        totalAmountHeld: 0,
        totalAmountFulfilled: 0,
      };
    }

    let totalAmountHeld = 0;
    let totalAmountFulfilled = 0;
    let pendingCount = 0;
    let onHoldCount = 0;
    let fulfilledCount = 0;

    for (const detail of paymentDetails) {
      const status = detail.paymentStatus || "pending";

      if (status === "pending") {
        pendingCount++;
      } else if (status === "on_hold") {
        onHoldCount++;
        totalAmountHeld += detail.saldo;
      } else if (status === "fulfilled") {
        fulfilledCount++;
        totalAmountFulfilled += detail.saldo;
      }
    }

    return {
      total: paymentDetails.length,
      pending: pendingCount,
      onHold: onHoldCount,
      fulfilled: fulfilledCount,
      totalAmountHeld: totalAmountHeld,
      totalAmountFulfilled: totalAmountFulfilled,
    };
  }, [paymentDetails]);

  // Filter payment details by payment status
  const filteredPaymentDetails = useMemo(() => {
    if (!paymentDetails) return [];

    if (paymentFilter === "all") {
      return paymentDetails;
    }

    return paymentDetails.filter(
      (d) => (d.paymentStatus || "pending") === paymentFilter
    );
  }, [paymentDetails, paymentFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "on_hold":
        return <Badge variant="secondary">On Hold</Badge>;
      case "fulfilled":
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Fulfilled</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + "T00:00:00"), "MMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  if (!paymentDetails) {
    return (
      <Card className="border border-border shadow-sm">
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading payment data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={viewMode === "overview" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("overview")}
          className="gap-2 border border-border shadow-sm"
        >
          <Wallet className="h-4 w-4" />
          Payment Overview
        </Button>
        <Button
          variant={viewMode === "stripe" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("stripe")}
          className="gap-2 border border-border shadow-sm"
        >
          <CreditCard className="h-4 w-4" />
          Stripe Dashboard
        </Button>
      </div>

      {viewMode === "stripe" ? (
        <StripeDashboard />
      ) : (
        <>
          {/* Payment Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="border border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Reservations</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{paymentStats.total}</div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Payment</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{paymentStats.pending}</div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On Hold</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{paymentStats.onHold}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(paymentStats.totalAmountHeld)} held
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fulfilled</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{paymentStats.fulfilled}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(paymentStats.totalAmountFulfilled)} captured
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Status Filter */}
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle>Payment Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={paymentFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPaymentFilter("all")}
                    className="border border-border shadow-sm"
                  >
                    All ({paymentStats.total})
                  </Button>
                  <Button
                    variant={paymentFilter === "pending" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPaymentFilter("pending")}
                    className="border border-border shadow-sm"
                  >
                    Pending ({paymentStats.pending})
                  </Button>
                  <Button
                    variant={paymentFilter === "on_hold" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPaymentFilter("on_hold")}
                    className="border border-border shadow-sm"
                  >
                    On Hold ({paymentStats.onHold})
                  </Button>
                  <Button
                    variant={paymentFilter === "fulfilled" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPaymentFilter("fulfilled")}
                    className="border border-border shadow-sm"
                  >
                    Fulfilled ({paymentStats.fulfilled})
                  </Button>
                </div>
                <div className="mt-4">
                  {filteredPaymentDetails.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No reservations found with this payment status.</p>
                    </div>
                  ) : isMobile ? (
                    <div className="space-y-4">
                      {filteredPaymentDetails.map((detail) => (
                        <Card
                          key={detail.reservationId}
                          className="overflow-hidden border border-border shadow-sm"
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Activity & Status */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base truncate">
                                  {detail.activityName}
                                </h3>
                                {detail.activityAddress && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{detail.activityAddress}</span>
                                  </div>
                                )}
                              </div>
                              {getStatusBadge(detail.paymentStatus)}
                            </div>

                            {/* Teams */}
                            <div className="flex flex-wrap gap-1">
                              {detail.teams.length > 0 ? (
                                detail.teams.map((team) => (
                                  <Badge
                                    key={team._id}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {team.teamName}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-sm">No teams</span>
                              )}
                            </div>

                            {/* Date & Time */}
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">{formatDate(detail.date)}</span>
                              <span className="text-muted-foreground">at</span>
                              <span>{detail.time}</span>
                            </div>

                            {/* Participants */}
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>{detail.userCount} participants</span>
                            </div>

                            {/* Amounts */}
                            <div className="rounded-lg border border-border bg-muted/50 p-3 flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Saldo / Total</span>
                              <div className="text-right">
                                <span className="font-semibold text-green-600 block">
                                  {formatCurrency(detail.saldo)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(detail.totalAmount)} total
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-border shadow-sm overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Activity
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Teams
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Date & Time
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Saldo
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Total Amount
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Participants
                            </th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPaymentDetails.map((detail) => (
                            <tr
                              key={detail.reservationId}
                              className="border-b transition-colors hover:bg-muted/50"
                            >
                              <td className="p-4 align-middle">
                                <div>
                                  <div className="font-medium">
                                    {detail.activityName}
                                  </div>
                                  {detail.activityAddress && (
                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {detail.activityAddress}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                <div className="flex flex-wrap gap-1">
                                  {detail.teams.length > 0 ? (
                                    detail.teams.map((team) => (
                                      <Badge
                                        key={team._id}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {team.teamName}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-muted-foreground text-sm">No teams</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="font-medium">{formatDate(detail.date)}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {detail.time}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                <div className="font-semibold text-green-600">
                                  {formatCurrency(detail.saldo)}
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                <div className="text-muted-foreground">
                                  {formatCurrency(detail.totalAmount)}
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span>{detail.userCount}</span>
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                {getStatusBadge(detail.paymentStatus)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
