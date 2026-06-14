"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
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
  const hasRequirements = requirements && (
    requirements.currentlyDue.length > 0 ||
    requirements.pastDue.length > 0 ||
    requirements.eventuallyDue.length > 0
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
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Connect your Stripe account to receive payments</p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 md:px-6">
        {/* Requirements alert */}
        {isConnected && hasRequirements && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Action Required: Complete Your Stripe Account Setup
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                  Your Stripe account needs additional information to enable payouts.
                </p>
                <div className="mt-3 space-y-2">
                  {requirements.pastDue.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Past Due (Urgent):</p>
                      <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside space-y-0.5">
                        {requirements.pastDue.map((req, idx) => <li key={idx}>{req}</li>)}
                      </ul>
                    </div>
                  )}
                  {requirements.currentlyDue.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-amber-900 dark:text-amber-100 mb-1">Currently Required:</p>
                      <ul className="text-xs text-amber-800 dark:text-amber-200 list-disc list-inside space-y-0.5">
                        {requirements.currentlyDue.map((req, idx) => <li key={idx}>{req}</li>)}
                      </ul>
                    </div>
                  )}
                  {requirements.eventuallyDue.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Due Soon:</p>
                      <ul className="text-xs text-blue-700 dark:text-blue-300 list-disc list-inside space-y-0.5">
                        {requirements.eventuallyDue.map((req, idx) => <li key={idx}>{req}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full rounded-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isConnecting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting to Stripe...</>
              ) : (
                <><AlertTriangle className="h-4 w-4 mr-2" />Complete Setup Now</>
              )}
            </Button>
            <p className="text-xs text-center text-zinc-400 dark:text-zinc-500">
              Click the button above to provide the required information to Stripe
            </p>
          </div>
        )}

        {/* Connected + no requirements */}
        {isConnected && !hasRequirements && (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 p-4">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Stripe account connected</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Payments will be transferred to your connected account
                {accountStatus?.payoutsEnabled && accountStatus?.chargesEnabled
                  ? " · Fully activated"
                  : ""}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Error</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Not connected */}
        {!isConnected && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-2xl bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 p-4">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Connect your Stripe account</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  You need to connect a Stripe account to receive payments. Funds will be held until the activity date and then transferred to your account.
                </p>
              </div>
            </div>
            <Button onClick={handleConnect} disabled={isConnecting} className="w-full rounded-full">
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
