"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

interface StripeConnectButtonProps {
  organisationId: Id<"organisations">;
}

export function StripeConnectButton({ organisationId }: StripeConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const organisation = useQuery(api.organisation.getById, { organisationId });
  const createConnectAccountLink = useAction(api.stripe.createConnectAccountLink);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const returnUrl = `${window.location.origin}/my-organisation`;
      const refreshUrl = `${window.location.origin}/my-organisation`;

      // Use Convex action instead of HTTP route - automatically handles authentication
      const result = await createConnectAccountLink({
        organisationId,
        returnUrl,
        refreshUrl,
        // Country is optional - backend will default to HR if not provided
      });

      // Redirect to Stripe onboarding
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

  const isConnected = organisation?.stripeAccountId && organisation?.stripeAccountOnboardingComplete;

  return (
    <Card>
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
        {isConnected ? (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">
                Stripe account connected
              </p>
              <p className="text-xs text-green-700">
                Payments will be transferred to your connected account
              </p>
            </div>
          </div>
        ) : (
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
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="text-xs text-destructive mt-1">{error}</p>
                </div>
              </div>
            )}
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
