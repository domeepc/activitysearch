"use client";

import { useState, useMemo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface RefundPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: Id<"reservations">;
  activityName: string;
}

function PaymentStatusBadge({
  refundedAt,
  capturedAt,
  hasIntent,
}: {
  refundedAt?: number;
  capturedAt?: number;
  hasIntent: boolean;
}) {
  if (refundedAt) {
    return (
      <Badge variant="outline" className="gap-1 text-xs border-rose-300 text-rose-600">
        <XCircle className="h-3 w-3" />
        Refunded
      </Badge>
    );
  }
  if (capturedAt) {
    return (
      <Badge variant="outline" className="gap-1 text-xs border-emerald-300 text-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        Captured
      </Badge>
    );
  }
  if (hasIntent) {
    return (
      <Badge variant="outline" className="gap-1 text-xs border-amber-300 text-amber-600">
        <Clock className="h-3 w-3" />
        On hold
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}

export function RefundPaymentsDialog({
  open,
  onOpenChange,
  reservationId,
  activityName,
}: RefundPaymentsDialogProps) {
  const payments = useQuery(
    api.reservations.getReservationPaymentsForOrganiser,
    open ? { reservationId } : "skip"
  );
  const refundAction = useAction(api.stripe.refundSelectedPayments);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isRefunding, setIsRefunding] = useState(false);

  const refundablePayments = useMemo(
    () => (payments ?? []).filter((p) => !p.refundedAt && p.amount > 0),
    [payments]
  );

  const selectedTotal = useMemo(() => {
    return (payments ?? [])
      .filter((p) => selected.has(p._id))
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments, selected]);

  const toggleAll = () => {
    if (selected.size === refundablePayments.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(refundablePayments.map((p) => p._id)));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRefund = async () => {
    if (selected.size === 0) return;
    setIsRefunding(true);
    try {
      const result = await refundAction({
        reservationId,
        paymentIds: Array.from(selected) as Id<"reservationPayments">[],
      });

      if (result.errors.length > 0) {
        toast.error(`Refunded ${result.refunded}, but ${result.errors.length} failed`, {
          description: result.errors[0],
        });
      } else {
        toast.success(`${result.refunded} payment${result.refunded !== 1 ? "s" : ""} refunded`, {
          description: result.skipped > 0 ? `${result.skipped} already refunded, skipped.` : undefined,
        });
      }
      setSelected(new Set());
      if (result.errors.length === 0) onOpenChange(false);
    } catch (err) {
      toast.error("Refund failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsRefunding(false);
    }
  };

  const allSelected =
    refundablePayments.length > 0 && selected.size === refundablePayments.length;
  const someSelected = selected.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Issue Refunds
          </DialogTitle>
          <DialogDescription>
            Select payments to refund for <span className="font-medium text-foreground">{activityName}</span>.
            Each refund returns funds to the original card.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0">
          {payments === undefined ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No payments recorded for this reservation.
            </p>
          ) : (
            <div className="space-y-2 py-2">
              {refundablePayments.length > 0 && (
                <div className="flex items-center gap-2 pb-1 border-b border-border mb-3">
                  <Checkbox
                    id="select-all"
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                  />
                  <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer select-none">
                    Select all refundable ({refundablePayments.length})
                  </label>
                </div>
              )}

              {payments.map((payment) => {
                const canRefund = !payment.refundedAt && payment.amount > 0;
                const isChecked = selected.has(payment._id);
                const initials = payment.user
                  ? `${payment.user.name[0]}${payment.user.lastname[0]}`.toUpperCase()
                  : "?";

                return (
                  <div
                    key={payment._id}
                    className={[
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      canRefund
                        ? isChecked
                          ? "border-primary/40 bg-primary/5 cursor-pointer"
                          : "border-border hover:bg-muted/50 cursor-pointer"
                        : "border-border bg-muted/30 opacity-60",
                    ].join(" ")}
                    onClick={() => canRefund && toggle(payment._id)}
                  >
                    {canRefund && (
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggle(payment._id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    {!canRefund && <div className="w-4" />}

                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={payment.user?.avatar} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {payment.user
                          ? `${payment.user.name} ${payment.user.lastname}`
                          : "Unknown payer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.personsPaidFor} person{Number(payment.personsPaidFor) !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        €{payment.amount.toFixed(2)}
                      </p>
                      <PaymentStatusBadge
                        refundedAt={payment.refundedAt}
                        capturedAt={payment.capturedAt}
                        hasIntent={!!payment.stripePaymentIntentId}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t border-border mt-2">
          {someSelected && (
            <div className="flex-1 text-sm text-muted-foreground self-center">
              {selected.size} selected · €{selectedTotal.toFixed(2)} total
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRefunding}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRefund}
            disabled={!someSelected || isRefunding}
            className="gap-2"
          >
            {isRefunding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isRefunding
              ? "Refunding..."
              : `Refund${someSelected ? ` ${selected.size}` : ""} payment${selected.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
