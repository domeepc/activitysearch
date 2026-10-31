"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle, Loader2, AlertCircle, AlertTriangle, ArrowRight, Circle, Clock } from "lucide-react";
import { describeStripeRequirements } from "@/lib/stripeRequirements";
import { Id } from "@/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

interface StripeConnectButtonProps {
  organisationId: Id<"organisations">;
}

export function StripeConnectButton({ organisationId }: StripeConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<{
    connected: boolean;
    accountId?: string;
    needsUpdate?: boolean;
    requirements?: {
      currentlyDue: string[];
      pastDue: string[];
      eventuallyDue: string[];
    };
    capabilities?: {
      cardPayments: "active" | "inactive" | "pending";
      transfers: "active" | "inactive" | "pending";
    };
    payoutsEnabled?: boolean;
    chargesEnabled?: boolean;
    detailsSubmitted?: boolean;
  } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const createConnectAccountLink = useAction(api.stripe.createConnectAccountLink);
  const getStripeAccountStatus = useAction(api.stripe.getStripeAccountStatus);

  useEffect(() => {
    const fetchStatus = () => {
      if (organisationId) {
        setIsLoadingStatus(true);
        getStripeAccountStatus({ organisationId })
          .then((status) => setAccountStatus(status))
          .catch((err) => {
            console.error("Error fetching Stripe status:", err);
            setAccountStatus({ connected: false, needsUpdate: false });
          })
          .finally(() => setIsLoadingStatus(false));
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [organisationId, getStripeAccountStatus]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const returnUrl = `${window.location.origin}/my-organisation`;
      const refreshUrl = `${window.location.origin}/my-organisation`;
      const result = await createConnectAccountLink({ organisationId, returnUrl, refreshUrl });
      if (result?.url) {
        window.location.href = result.url;
      } else {
        throw new Error("No redirect URL received from server");
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
      setError(error instanceof Error ? error.message : "Failed to connect Stripe account. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const isConnected = accountStatus?.connected || false;
  const requirements = accountStatus?.requirements;
  const overdue = describeStripeRequirements(requirements?.pastDue ?? []);
  // Stripe repeats past-due fields in currently_due; show each step once, under its most urgent heading
  const neededNow = describeStripeRequirements(requirements?.currentlyDue ?? []).filter((r) => !overdue.includes(r));
  const neededLater = describeStripeRequirements(requirements?.eventuallyDue ?? []).filter(
    (r) => !overdue.includes(r) && !neededNow.includes(r)
  );
  const urgent = overdue.length > 0 || neededNow.length > 0;
  const payoutsOn = !!accountStatus?.payoutsEnabled;

  const steps = [
    { label: "Stripe account created", done: isConnected },
    { label: "Details submitted", done: !!accountStatus?.detailsSubmitted && !urgent },
    { label: "Payouts on", done: payoutsOn },
  ];

  const setupButton = (label: string, variant: "default" | "outline" = "default") => (
    <Button onClick={handleConnect} disabled={isConnecting} variant={variant} className="h-10 w-full">
      {isConnecting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
          Redirecting to Stripe…
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
        </>
      )}
    </Button>
  );

  if (isLoadingStatus) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 md:px-6">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800">
            <CreditCard className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
          </div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Stripe Payment Setup</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 md:px-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800">
          <CreditCard className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Stripe Payment Setup</h2>
          <p className="text-xs text-muted-foreground">Connect your Stripe account to receive payments</p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 md:px-6">
        {isConnected && (
          <ol className="grid grid-cols-3 gap-2" aria-label="Payout setup progress">
            {steps.map((step, i) => (
              <li key={step.label} className="flex flex-col gap-2">
                <span
                  className={`h-1.5 rounded-full ${step.done ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"}`}
                  aria-hidden="true"
                />
                <span className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {step.done ? (
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                  ) : (
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-[9px] dark:border-zinc-600" aria-hidden="true">
                      {i + 1}
                    </span>
                  )}
                  <span>
                    {step.label}
                    <span className="sr-only">{step.done ? " (done)" : " (not done)"}</span>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* Stripe needs more information */}
        {isConnected && urgent && (
          <div
            className={`space-y-4 rounded-2xl border p-4 ${
              overdue.length > 0
                ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`h-5 w-5 mt-0.5 shrink-0 ${overdue.length > 0 ? "text-red-600" : "text-amber-600"}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {overdue.length > 0 ? "Payouts are paused" : "Finish setup to get paid"}
                </p>
                <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">
                  {overdue.length > 0
                    ? "Stripe needs these details before it can send your money."
                    : "Stripe needs a few more details before you can receive payouts."}
                </p>
              </div>
            </div>
            <ul className="space-y-2 rounded-xl bg-white/70 p-3 text-sm dark:bg-zinc-900/60">
              {[...overdue, ...neededNow].map((item) => (
                <li key={item} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200">
                    <Circle className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                    {item}
                  </span>
                  {overdue.includes(item) && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/60 dark:text-red-300">
                      Overdue
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {setupButton("Continue setup on Stripe")}
            <p className="text-center text-xs text-muted-foreground">
              Takes a few minutes. Stripe brings you back here when you&apos;re done.
            </p>
          </div>
        )}

        {/* Nothing missing, but Stripe hasn't switched payouts on yet */}
        {isConnected && !urgent && !payoutsOn && (
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
            <Clock className="h-5 w-5 mt-0.5 shrink-0 text-blue-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Stripe is reviewing your details</p>
              <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                This usually takes a few minutes, sometimes a couple of days. We&apos;ll show any new requests here.
              </p>
            </div>
          </div>
        )}

        {isConnected && !urgent && payoutsOn && (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 p-4">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Payouts are on</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Payments are transferred to your Stripe account after each activity.
              </p>
            </div>
          </div>
        )}

        {/* Not blocking yet */}
        {isConnected && neededLater.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Stripe will ask for these later</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Not needed yet, but adding them now avoids a pause in payouts.
              </p>
            </div>
            <ul className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              {neededLater.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <Circle className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            {!urgent && setupButton("Add them now", "outline")}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3">
            <AlertCircle className="h-4 w-4 text-red-500 mt-1 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Error</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Not connected */}
        {!isConnected && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-2xl bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 p-4">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-1 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Connect your Stripe account</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  You need to connect a Stripe account to receive payments. Funds will be held until the activity date and then transferred to your account.
                </p>
              </div>
            </div>
            <Button onClick={handleConnect} disabled={isConnecting} className="h-10 w-full">
              {isConnecting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-2" />Connect Stripe Account</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
