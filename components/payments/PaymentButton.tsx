"use client";

import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";

interface PaymentButtonProps {
  reservationId: string;
  paymentStatus?: "pending" | "on_hold" | "fulfilled" | "cancelled";
  amount: number;
  remainingAmount: number;
  onPaymentClick: () => void;
  disabled?: boolean;
}

export function PaymentButton({
  reservationId,
  paymentStatus = "pending",
  amount,
  remainingAmount,
  onPaymentClick,
  disabled = false,
}: PaymentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClick = async () => {
    if (disabled || isProcessing || paymentStatus === "fulfilled") return;
    setIsProcessing(true);
    try {
      onPaymentClick();
    } finally {
      setIsProcessing(false);
    }
  };

  // Don't show button if payment is fulfilled or cancelled
  if (paymentStatus === "fulfilled" || paymentStatus === "cancelled") {
    return (
      <div className="flex items-center gap-2">
        <PaymentStatusBadge status={paymentStatus} />
      </div>
    );
  }

  // Show payment button if there's remaining amount
  if (remainingAmount > 0) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleClick}
          disabled={disabled || isProcessing || paymentStatus === "on_hold"}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Now
            </>
          )}
        </Button>
        {paymentStatus !== "pending" && (
          <PaymentStatusBadge status={paymentStatus} />
        )}
      </div>
    );
  }

  // Show status badge if fully paid but not yet fulfilled
  return <PaymentStatusBadge status={paymentStatus} />;
}
