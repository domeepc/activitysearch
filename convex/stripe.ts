import { httpAction, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// Create payment intent with manual capture (hold funds) - Action version for frontend
export const createPaymentIntent = action({
  args: {
    reservationId: v.id("reservations"),
    amount: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { reservationId, amount, currency = "eur" }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    if (!reservationId || !amount) {
      throw new Error("Missing required fields");
    }

    // Get reservation data
    const reservationData = await ctx.runQuery(
      api.reservations.getReservationCardData,
      { reservationId }
    );

    if (!reservationData) {
      throw new Error("Reservation not found");
    }

    // Get activity to find organization
    const activity = await ctx.runQuery(api.activity.getActivityById, {
      activityId: reservationData.activity._id,
    });

    if (!activity) {
      throw new Error("Activity not found");
    }

    // Find organization
    const allOrganisations = await ctx.runQuery(api.organisation.getAll);

    const organisation = allOrganisations?.find(
      (org: { activityIDs: Id<"activities">[] }) =>
        org.activityIDs.includes(reservationData.activity._id)
    );

    if (!organisation) {
      throw new Error("Organization not found");
    }

    // Get Stripe account ID if using Connect
    const stripeAccountId: string | undefined = organisation.stripeAccountId;

    try {
      // Create payment intent with manual capture
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        capture_method: "manual", // Hold funds, don't capture immediately
        metadata: {
          reservationId,
          activityId: reservationData.activity._id,
          organisationId: organisation._id,
        },
      };

      // If using Stripe Connect, transfer to connected account
      // When using transfer_data, create on platform account (not on connected account)
      if (stripeAccountId) {
        paymentIntentParams.application_fee_amount = Math.round(
          amount * 100 * 0.02
        ); // 2% platform fee
        paymentIntentParams.transfer_data = {
          destination: stripeAccountId,
        };
        // Create on platform account - transfer_data handles the transfer
        const paymentIntent: Stripe.PaymentIntent =
          await stripe.paymentIntents.create(paymentIntentParams);

        return {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        };
      }

      // Create payment intent on platform account (no Connect)
      const paymentIntent: Stripe.PaymentIntent =
        await stripe.paymentIntents.create(paymentIntentParams);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to create payment intent"
      );
    }
  },
});

// Confirm payment intent (after user completes payment)
export const confirmPaymentIntent = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { paymentIntentId } = body;

  if (!paymentIntentId) {
    return new Response("Missing paymentIntentId", { status: 400 });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "requires_capture") {
      return new Response(
        JSON.stringify({
          error: "Payment intent is not in a state to be confirmed",
          status: paymentIntent.status,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error confirming payment intent:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

// Capture payment (called on activity day) - internal version for scheduled jobs
export const capturePayment = internalMutation({
  args: {
    paymentIntentId: v.string(),
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { paymentIntentId, reservationId }) => {
    // Get reservation
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    try {
      // Capture the payment
      const paymentIntent = await stripe.paymentIntents.capture(
        paymentIntentId
      );

      // Update payment record
      const payments = await ctx.db
        .query("reservationPayments")
        .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
        .collect();

      const payment = payments.find(
        (p) => p.stripePaymentIntentId === paymentIntentId
      );

      if (payment) {
        await ctx.db.patch(payment._id, {
          capturedAt: Date.now(),
        });
      }

      return {
        success: true,
        amount: paymentIntent.amount / 100,
        status: paymentIntent.status,
      };
    } catch (error) {
      console.error("Error capturing payment:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to capture payment"
      );
    }
  },
});

// Refund payment (for cancellations) - internal version for use by other mutations
export const refundPayment = internalMutation({
  args: {
    paymentIntentId: v.string(),
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { paymentIntentId, reservationId }) => {
    // Get reservation
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    try {
      // Cancel the payment intent (if not captured) or create refund (if captured)
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );

      if (paymentIntent.status === "requires_capture") {
        // Cancel the payment intent
        await stripe.paymentIntents.cancel(paymentIntentId);
      } else if (paymentIntent.status === "succeeded") {
        // Create a refund
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
        });
      }

      // Update payment record
      const payments = await ctx.db
        .query("reservationPayments")
        .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
        .collect();

      const payment = payments.find(
        (p) => p.stripePaymentIntentId === paymentIntentId
      );

      if (payment) {
        await ctx.db.patch(payment._id, {
          refundedAt: Date.now(),
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error refunding payment:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to refund payment"
      );
    }
  },
});

// Create Stripe Connect account with business details
export const createConnectAccountWithDetails = httpAction(
  async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const {
      organisationId,
      country,
      businessType,
      email,
      businessName,
      taxId,
      phone,
    } = body;

    if (!organisationId || !country || !businessType || !email) {
      return new Response("Missing required fields", { status: 400 });
    }

    try {
      // Get organization
      const organisation = await ctx.runQuery(api.organisation.getById, {
        organisationId,
      });

      if (!organisation) {
        return new Response("Organization not found", { status: 404 });
      }

      // Check if account already exists
      if (organisation.stripeAccountId) {
        return new Response(
          JSON.stringify({
            success: true,
            stripeAccountId: organisation.stripeAccountId,
            message: "Stripe account already exists",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Validate country code (must be 2 letters)
      if (!country || country.length !== 2) {
        return new Response(
          JSON.stringify({
            error: "Invalid country code. Must be a 2-letter ISO country code.",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Prepare account creation parameters
      // Country code must be uppercase for Stripe
      const countryCode = country.toUpperCase();

      const accountParams: Stripe.AccountCreateParams = {
        type: "express",
        country: countryCode,
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      };

      // Add business information based on type
      if (businessType === "company") {
        accountParams.business_type = "company";
        // Business profile is required for company accounts
        accountParams.business_profile = {};
        if (businessName) {
          accountParams.business_profile.name = businessName;
        }
        if (phone) {
          accountParams.business_profile.support_phone = phone;
        }
        if (taxId) {
          accountParams.company = {
            tax_id: taxId,
          };
        }
      } else {
        accountParams.business_type = "individual";
        if (phone) {
          accountParams.individual = {
            phone: phone,
          };
        }
      }

      // Create Stripe Connect account
      const account = await stripe.accounts.create(accountParams);

      // Update organization with account ID
      await ctx.runMutation(api.organisation.updateStripeAccount, {
        organisationId,
        stripeAccountId: account.id,
      });

      return new Response(
        JSON.stringify({
          success: true,
          stripeAccountId: account.id,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error creating Stripe Connect account:", error);

      // Handle Stripe API errors specifically
      if (error && typeof error === "object" && "type" in error) {
        const stripeError = error as {
          type?: string;
          code?: string;
          message?: string;
          param?: string;
          decline_code?: string;
        };

        return new Response(
          JSON.stringify({
            error: stripeError.message || "Stripe API error",
            type: stripeError.type,
            code: stripeError.code,
            param: stripeError.param,
            decline_code: stripeError.decline_code,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Handle generic errors
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Unknown error";

      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }
);

// Create Stripe Connect account link for onboarding
export const createConnectAccountLink = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { organisationId, returnUrl, refreshUrl } = body;

  if (!organisationId || !returnUrl || !refreshUrl) {
    return new Response("Missing required fields", { status: 400 });
  }

  try {
    // Get organization
    const organisation = await ctx.runQuery(api.organisation.getById, {
      organisationId,
    });

    if (!organisation) {
      return new Response("Organization not found", { status: 404 });
    }

    let accountId = organisation.stripeAccountId;

    // Create account if it doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "HR", // Croatia (adjust as needed)
        email: organisation.organisationEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      // Update organization with account ID
      await ctx.runMutation(api.organisation.updateStripeAccount, {
        organisationId,
        stripeAccountId: accountId,
      });
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating account link:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

// Webhook handler for Stripe events
export const stripeWebhook = httpAction(async (ctx, request) => {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await request.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // Handle different event types
  switch (event.type) {
    case "payment_intent.succeeded":
      // Payment was successfully captured
      // This will be handled by the capture mutation
      break;

    case "payment_intent.canceled":
      // Payment was canceled
      // Update payment status in database if needed
      break;

    case "account.updated":
      // Stripe Connect account was updated
      // Update organization onboarding status if needed
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
