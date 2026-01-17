"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, AlertCircle, Users } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

// Initialize Stripe
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: Id<"reservations">;
  amount: number; // Total amount for the reservation
  perPersonAmount: number; // Amount per person
  remainingPersons: number; // How many people still need to pay
  activityName: string;
  onSuccess: () => void;
}

function PaymentForm({
  reservationId,
  perPersonAmount,
  remainingPersons,
  activityName,
  personsToPayFor,
  onSuccess,
  onClose,
}: {
  reservationId: Id<"reservations">;
  perPersonAmount: number;
  remainingPersons: number;
  activityName: string;
  personsToPayFor: number;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordPayment = useMutation(api.reservations.recordPayment);

  const totalAmount = perPersonAmount * personsToPayFor;

  // Show error if Stripe or Elements are not available
  useEffect(() => {
    if (!stripe || !elements) {
      setError("Payment form is not ready. Please wait a moment and try again.");
    } else {
      setError(null);
    }
  }, [stripe, elements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError("Payment system is not ready. Please refresh the page and try again.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Submit payment
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Payment submission failed");
        setIsProcessing(false);
        return;
      }

      // Confirm payment
      const { error: confirmError, paymentIntent } =
        await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/reservations`,
          },
          redirect: "if_required",
        });

      if (confirmError) {
        setError(confirmError.message || "Payment failed");
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === "requires_capture") {
        // Payment is held, record it in database
        await recordPayment({
          reservationId,
          amount: Number(totalAmount),
          personsPaidFor: BigInt(personsToPayFor),
          stripePaymentIntentId: paymentIntent.id,
        });

        onSuccess();
        onClose();
      } else {
        setError("Payment was not held successfully");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment processing failed"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">Activity:</span>
          <span className="text-sm">{activityName}</span>
        </div>
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">Amount per person:</span>
          <span className="text-sm font-semibold">
            €{perPersonAmount.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">Total amount:</span>
          <span className="text-lg font-semibold">
            €{totalAmount.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <PaymentElement />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isProcessing || !stripe}>
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay €{totalAmount.toFixed(2)}
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PaymentDialog({
  open,
  onOpenChange,
  reservationId,
  amount,
  perPersonAmount,
  remainingPersons,
  activityName,
  onSuccess,
}: PaymentDialogProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personsToPayFor, setPersonsToPayFor] = useState(1);
  const createPaymentIntentAction = useAction(api.stripe.createPaymentIntent);

  // Reset persons to pay for when dialog opens
  useEffect(() => {
    if (open) {
      const initialPersons = Math.min(1, Math.max(1, remainingPersons));
      setPersonsToPayFor(initialPersons);
      setClientSecret(null);
      setError(null);
      setIsLoading(false);
    } else {
      // Reset when dialog closes
      setClientSecret(null);
      setError(null);
      setPersonsToPayFor(1);
      setIsLoading(false);
    }
  }, [open, remainingPersons]);

  const createPaymentIntent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Validate Stripe configuration
      if (!stripePublishableKey) {
        throw new Error(
          "Stripe is not configured. Please contact support or try again later."
        );
      }

      if (!stripePromise) {
        throw new Error(
          "Stripe payment system is not available. Please contact support."
        );
      }

      // Validate inputs
      if (remainingPersons <= 0) {
        throw new Error("No remaining persons to pay for");
      }
      if (personsToPayFor <= 0 || personsToPayFor > remainingPersons) {
        throw new Error(
          `Invalid number of persons. Please select between 1 and ${remainingPersons}`
        );
      }
      if (perPersonAmount <= 0) {
        throw new Error("Invalid amount per person");
      }

      const totalAmount = perPersonAmount * personsToPayFor;
      if (totalAmount <= 0) {
        throw new Error("Total amount must be greater than 0");
      }

      console.log("Creating payment intent:", {
        reservationId,
        totalAmount,
        personsToPayFor,
        perPersonAmount,
      });

      const data = await createPaymentIntentAction({
        reservationId,
        amount: totalAmount,
        currency: "eur",
      });

      if (!data || !data.clientSecret) {
        throw new Error("No client secret returned from server. Please try again.");
      }

      // Validate clientSecret format (should start with pi_)
      if (!data.clientSecret.startsWith("pi_") && !data.clientSecret.includes("_secret_")) {
        throw new Error("Invalid payment configuration. Please contact support.");
      }

      setClientSecret(data.clientSecret);
    } catch (err) {
      console.error("Error creating payment intent:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to create payment intent. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    reservationId,
    perPersonAmount,
    personsToPayFor,
    remainingPersons,
    createPaymentIntentAction,
  ]);

  if (!clientSecret && isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Loading Payment</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Don't show separate error dialog - show error in main dialog

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            Enter your payment details to complete the reservation payment.
            Funds will be held until the activity date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="personsToPayFor">
              Number of persons to pay for
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="personsToPayFor"
                type="number"
                min={1}
                max={remainingPersons}
                value={personsToPayFor}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setPersonsToPayFor(
                    Math.max(1, Math.min(value, remainingPersons))
                  );
                  // Reset client secret when changing persons so we create a new payment intent
                  setClientSecret(null);
                }}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                of {remainingPersons} remaining
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Total: €{(perPersonAmount * personsToPayFor).toFixed(2)} (
              {personsToPayFor} × €{perPersonAmount.toFixed(2)})
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {clientSecret && stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                },
              }}
            >
              <PaymentForm
                reservationId={reservationId}
                perPersonAmount={perPersonAmount}
                remainingPersons={remainingPersons}
                activityName={activityName}
                personsToPayFor={personsToPayFor}
                onSuccess={onSuccess}
                onClose={() => onOpenChange(false)}
              />
            </Elements>
          ) : (
            <Button
              onClick={createPaymentIntent}
              disabled={
                isLoading || remainingPersons <= 0 || personsToPayFor <= 0
              }
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating payment...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Continue to Payment
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
