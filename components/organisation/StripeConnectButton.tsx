"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Fetch Stripe account status on mount and when organisation changes
  // Also auto-refresh periodically to check for new requirements
  useEffect(() => {
    const fetchStatus = () => {
      if (organisationId) {
        setIsLoadingStatus(true);
        getStripeAccountStatus({ organisationId })
          .then((status) => {
            setAccountStatus(status);
          })
          .catch((err) => {
            console.error("Error fetching Stripe status:", err);
            setAccountStatus({ connected: false, needsUpdate: false });
          })
          .finally(() => {
            setIsLoadingStatus(false);
          });
      }
    };

    // Fetch immediately
    fetchStatus();

    // Auto-refresh every 5 minutes to check for new requirements
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [organisationId, getStripeAccountStatus]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const returnUrl = `${window.location.origin}/my-organisation`;
      const refreshUrl = `${window.location.origin}/my-organisation`;

      // Use Convex action instead of HTTP route - automatically handles authentication
      // Type will be auto-detected based on account status
      const result = await createConnectAccountLink({
        organisationId,
        returnUrl,
        refreshUrl,
        // Country is optional - backend will default to HR if not provided
      });

      // Redirect to Stripe onboarding/update
      if (result?.url) {
        window.location.href = result.url;
      } else {
        throw new Error("No redirect URL received from server");
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to connect Stripe account. Please try again.";
      setError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  // Determine connection status from fetched data
  const isConnected = accountStatus?.connected || false;
  const requirements = accountStatus?.requirements;
  const hasRequirements = requirements && (
    requirements.currentlyDue.length > 0 ||
    requirements.pastDue.length > 0 ||
    requirements.eventuallyDue.length > 0
  );

  // Show loading state while fetching status
  if (isLoadingStatus) {
    return (
      <Card className="border-2 border-border shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Payment Setup
          </CardTitle>
          <CardDescription>
            Connect your Stripe account to receive payments for reservations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-border shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Stripe Payment Setup
        </CardTitle>
        <CardDescription>
          Connect your Stripe account to receive payments for reservations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show requirements alert if there are any requirements due (including due soon) */}
        {isConnected && hasRequirements && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-400 rounded-lg shadow-sm">
            <AlertTriangle className="h-6 w-6 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-base font-semibold text-amber-900">
                Action Required: Complete Your Stripe Account Setup
              </p>
              <p className="text-sm text-amber-800 mt-1">
                Your Stripe account needs additional information to enable payouts. Without completing this, you won&apos;t be able to receive payments.
              </p>
              {hasRequirements && (
                <div className="mt-3 space-y-2">
                  {requirements.pastDue.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-red-700 mb-1">
                        Past Due (Urgent):
                      </p>
                      <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                        {requirements.pastDue.map((req, idx) => (
                          <li key={idx}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {requirements.currentlyDue.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-amber-900 mb-1">
                        Currently Required:
                      </p>
                      <ul className="text-xs text-amber-800 list-disc list-inside space-y-0.5">
                        {requirements.currentlyDue.map((req, idx) => (
                          <li key={idx}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {requirements.eventuallyDue.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-blue-700 mb-1">
                        Due Soon:
                      </p>
                      <ul className="text-xs text-blue-700 list-disc list-inside space-y-0.5">
                        {requirements.eventuallyDue.map((req, idx) => (
                          <li key={idx}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4">
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  size="lg"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirecting to Stripe...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Complete Setup Now
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Click the button above to provide the required information to Stripe
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Show success state if connected and no requirements */}
        {isConnected && !hasRequirements && (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">
                Stripe account connected
              </p>
              <p className="text-xs text-green-700">
                Payments will be transferred to your connected account
              </p>
              {accountStatus?.payoutsEnabled && accountStatus?.chargesEnabled && (
                <p className="text-xs text-green-600 mt-1">
                  Account fully activated - ready to receive payments
                </p>
              )}
            </div>
          </div>
        )}

        {/* Show error if any */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-xs text-destructive mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Show connect button if not connected */}
        {!isConnected && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Connect your Stripe account
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  You need to connect a Stripe account to receive payments.
                  Funds will be held until the activity date and then transferred to your account.
                </p>
              </div>
            </div>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Connect Stripe Account
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
