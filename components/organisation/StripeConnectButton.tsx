"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface StripeConnectButtonProps {
  organisationId: Id<"organisations">;
}

export function StripeConnectButton({ organisationId }: StripeConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const organisation = useQuery(api.organisation.getById, { organisationId });

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Get Convex deployment URL
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
      const returnUrl = `${window.location.origin}/my-organisation`;
      const refreshUrl = `${window.location.origin}/my-organisation`;

      const response = await fetch(
        `${convexUrl}/stripe/create-connect-account-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organisationId,
            returnUrl,
            refreshUrl,
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create Stripe Connect account link");
      }

      const data = await response.json();
      
      // Redirect to Stripe onboarding
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
      alert("Failed to connect Stripe account. Please try again.");
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
