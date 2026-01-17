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

// Create Stripe Connect account with business details - Action version
export const createConnectAccountWithDetails = action({
  args: {
    organisationId: v.id("organisations"),
    country: v.string(),
    businessType: v.union(v.literal("individual"), v.literal("company")),
    email: v.string(),
    businessName: v.optional(v.string()),
    businessDescription: v.optional(v.string()),
    taxId: v.optional(v.string()),
    phone: v.string(), // Now required
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    postalCode: v.string(),
    dateOfBirth: v.string(),
    businessWebsite: v.optional(v.string()),
    industry: v.optional(v.string()),
    firstName: v.string(),
    lastName: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: true; stripeAccountId: string; message?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const {
      organisationId,
      country,
      businessType,
      email,
      businessName,
      businessDescription,
      taxId,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      dateOfBirth,
      businessWebsite,
      industry,
      firstName,
      lastName,
    } = args;

    if (!organisationId || !country || !businessType || !email) {
      throw new Error("Missing required fields");
    }

    try {
      // Get organization
      const organisation = await ctx.runQuery(api.organisation.getById, {
        organisationId,
      });

      if (!organisation) {
        throw new Error("Organization not found");
      }

      // Check if account already exists
      if (organisation.stripeAccountId) {
        return {
          success: true,
          stripeAccountId: organisation.stripeAccountId,
          message: "Stripe account already exists",
        };
      }

      // Validate country code (must be 2 letters)
      if (!country || country.length !== 2) {
        throw new Error(
          "Invalid country code. Must be a 2-letter ISO country code."
        );
      }

      // Prepare account creation parameters
      // Country code must be uppercase for Stripe
      // Always use Croatia (HR) as per requirements
      const countryCode = "HR";

      // Format phone number to E.164 format (required)
      if (!phone || !phone.trim()) {
        throw new Error("Phone number is required");
      }

      // Remove all non-digit characters except +
      const cleaned = phone.replace(/[^\d+]/g, "");

      let formattedPhone: string;
      // If it already starts with +, use it as is
      if (cleaned.startsWith("+")) {
        formattedPhone = cleaned;
      } else {
        // If it doesn't start with +, add Croatia country code (+385)
        formattedPhone = `+385${cleaned}`;
      }

      // Basic E.164 validation: should start with + and have 7-15 digits after
      // Stripe accepts 7-15 digits
      const digitsAfterPlus = formattedPhone.slice(1);
      if (!/^\d{7,15}$/.test(digitsAfterPlus)) {
        throw new Error(
          "Phone number must be in E.164 format with 7-15 digits after the country code (e.g., +385123456789)."
        );
      }

      // Additional validation: ensure the phone number is valid for Stripe
      if (formattedPhone.length < 8 || formattedPhone.length > 16) {
        throw new Error(
          "Phone number must be between 8 and 16 characters total (including + and country code)."
        );
      }

      const accountParams: Stripe.AccountCreateParams = {
        country: countryCode,
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        controller: {
          requirement_collection: "application",
          stripe_dashboard: {
            type: "none",
          },
          losses: {
            payments: "application",
          },
          fees: {
            payer: "application",
          },
        },
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip: "0.0.0.0", // Will be set by Stripe from the request
        },
      };

      // Prepare address object for Stripe
      const addressObject: Stripe.AddressParam = {
        line1: addressLine1,
        city: city,
        state: state,
        postal_code: postalCode,
        country: countryCode,
      };
      if (addressLine2) {
        addressObject.line2 = addressLine2;
      }

      // Parse date of birth (format: YYYY-MM-DD)
      const dobParts = dateOfBirth.split("-");
      const dobDay = parseInt(dobParts[2], 10);
      const dobMonth = parseInt(dobParts[1], 10);
      const dobYear = parseInt(dobParts[0], 10);

      // Add business information based on type
      if (businessType === "company") {
        accountParams.business_type = "company";
        // Business profile is required for company accounts
        accountParams.business_profile = {};
        if (businessName) {
          accountParams.business_profile.name = businessName;
        }
        if (businessDescription) {
          accountParams.business_profile.product_description = businessDescription;
        }
        if (formattedPhone) {
          accountParams.business_profile.support_phone = formattedPhone;
        }
        if (businessWebsite) {
          // Validate and format URL - Stripe requires a valid URL with protocol
          let validatedUrl = businessWebsite.trim();
          
          // If URL doesn't start with http:// or https://, add https://
          if (!validatedUrl.match(/^https?:\/\//i)) {
            validatedUrl = `https://${validatedUrl}`;
          }
          
          // Basic URL validation
          try {
            new URL(validatedUrl);
            accountParams.business_profile.url = validatedUrl;
          } catch {
            throw new Error(
              `Invalid business website URL: "${businessWebsite}". Please provide a valid URL (e.g., https://example.com).`
            );
          }
        }
        if (industry) {
          accountParams.business_profile.mcc = industry;
        }
        if (taxId) {
          accountParams.company = {
            tax_id: taxId,
            address: addressObject,
          };
        } else {
          accountParams.company = {
            address: addressObject,
          };
        }
        // Add business representative information
        accountParams.individual = {
          first_name: firstName,
          last_name: lastName,
          email: email,
          dob: {
            day: dobDay,
            month: dobMonth,
            year: dobYear,
          },
          address: addressObject,
        };
        // Only add phone if provided and valid - Stripe may reject invalid formats
        if (formattedPhone) {
          accountParams.individual.phone = formattedPhone;
        }
      } else {
        accountParams.business_type = "individual";
        accountParams.individual = {
          first_name: firstName,
          last_name: lastName,
          email: email,
          dob: {
            day: dobDay,
            month: dobMonth,
            year: dobYear,
          },
          address: addressObject,
        };
        // Only add phone if provided and valid - Stripe may reject invalid formats
        if (formattedPhone) {
          accountParams.individual.phone = formattedPhone;
        }
      }

      // Create Stripe Connect account
      let account: Stripe.Account;
      try {
        account = await stripe.accounts.create(accountParams);
      } catch (createError: unknown) {
        // If error is related to phone number, try again without phone
        const errorMessage =
          createError &&
          typeof createError === "object" &&
          "message" in createError
            ? String(createError.message)
            : String(createError);

        if (
          errorMessage &&
          typeof errorMessage === "string" &&
          (errorMessage.includes("phone number") ||
            errorMessage.includes("phone") ||
            (createError &&
              typeof createError === "object" &&
              "param" in createError &&
              String(createError.param).includes("phone")))
        ) {
          console.warn(
            "Phone number validation failed, retrying without phone number:",
            errorMessage
          );

          // Remove phone from account params and retry
          if (accountParams.individual) {
            delete accountParams.individual.phone;
          }
          if (
            accountParams.business_profile &&
            accountParams.business_profile.support_phone
          ) {
            delete accountParams.business_profile.support_phone;
          }

          // Retry without phone number
          account = await stripe.accounts.create(accountParams);
        } else {
          // Re-throw if it's not a phone number error
          throw createError;
        }
      }

      // Update organization with account ID
      await ctx.runMutation(api.organisation.updateStripeAccount, {
        organisationId,
        stripeAccountId: account.id,
      });

      return {
        success: true,
        stripeAccountId: account.id,
      };
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

        throw new Error(stripeError.message || "Stripe API error");
      }

      // Handle generic errors
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Unknown error";

      throw new Error(errorMessage);
    }
  },
});

// Create Stripe Connect account with business details - HTTP Action version (kept for backward compatibility)
export const createConnectAccountWithDetailsHttp = httpAction(
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
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      dateOfBirth,
      businessWebsite,
      firstName,
      lastName,
    } = body;

    if (!organisationId || !country || !businessType || !email) {
      return new Response("Missing required fields", { status: 400 });
    }

    try {
      // Use the action version
      const result = await ctx.runAction(
        api.stripe.createConnectAccountWithDetails,
        {
          organisationId,
          country,
          businessType,
          email,
          businessName,
          taxId,
          phone,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          dateOfBirth,
          businessWebsite,
          firstName,
          lastName,
        }
      );

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error creating Stripe Connect account:", error);

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

// Create Stripe Connect account link for onboarding - Action version
export const createConnectAccountLink = action({
  args: {
    organisationId: v.id("organisations"),
    returnUrl: v.string(),
    refreshUrl: v.string(),
    country: v.optional(v.string()),
  },
  handler: async (ctx, { organisationId, returnUrl, refreshUrl, country }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get organization
    const organisation = await ctx.runQuery(api.organisation.getById, {
      organisationId,
    });

    if (!organisation) {
      throw new Error("Organization not found");
    }

    // Validate email
    if (
      !organisation.organisationEmail ||
      !organisation.organisationEmail.includes("@")
    ) {
      throw new Error(
        "Organization email is invalid. Please update your organization email first."
      );
    }

    let accountId = organisation.stripeAccountId;

    // Create account if it doesn't exist
    if (!accountId) {
      // Country is required for account creation
      const countryCode = country || "HR"; // Default to HR if not provided

      // Validate country code (must be 2 letters)
      if (!countryCode || countryCode.length !== 2) {
        throw new Error(
          "Country code is required and must be a 2-letter ISO country code (e.g., 'US', 'HR', 'GB'). Please provide a country parameter."
        );
      }

      try {
        const account = await stripe.accounts.create({
          type: "express",
          country: countryCode.toUpperCase(),
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
      } catch (accountError: unknown) {
        // Get the error message - log the full error for debugging
        const errorMessage =
          accountError &&
          typeof accountError === "object" &&
          "message" in accountError
            ? String(accountError.message)
            : String(accountError);
        const errorType =
          accountError &&
          typeof accountError === "object" &&
          "type" in accountError
            ? String(accountError.type)
            : undefined;
        const errorCode =
          accountError &&
          typeof accountError === "object" &&
          "code" in accountError
            ? String(accountError.code)
            : undefined;

        console.error("Error creating Stripe account:", {
          message: errorMessage,
          type: errorType,
          code: errorCode,
          fullError: accountError,
        });

        // Only show Connect error if the message EXACTLY contains the specific phrase
        // The exact Stripe error is: "You can only create new accounts if you've signed up for Connect"
        if (
          errorMessage.includes("signed up for Connect") ||
          (errorMessage.includes("Connect") &&
            errorMessage.includes("learn how"))
        ) {
          // Check if we're in test mode - might need test mode Connect enabled
          const isTestMode =
            process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
          const modeHint = isTestMode
            ? " Make sure you've enabled Connect in your Stripe Test Mode dashboard."
            : " Make sure you've enabled Connect in your Stripe Live Mode dashboard.";

          throw new Error(
            `Stripe Connect is not enabled on your Stripe account.${modeHint} Please enable Stripe Connect in your Stripe Dashboard at https://dashboard.stripe.com/settings/connect, or contact support to enable it. Original error: ${errorMessage}`
          );
        }

        // For all other errors, pass through the actual Stripe error message
        // This allows users to see the real issue (e.g., invalid email, country restrictions, etc.)
        if (accountError instanceof Error) {
          throw accountError;
        }

        // If it's a Stripe error object, extract the message
        if (
          accountError &&
          typeof accountError === "object" &&
          "message" in accountError
        ) {
          throw new Error(String(accountError.message));
        }

        throw new Error(
          errorMessage ||
            "Failed to create Stripe account. Please check your Stripe configuration and try again."
        );
      }
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  },
});

// Keep HTTP action version for webhook compatibility (if needed)
export const createConnectAccountLinkHttp = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { organisationId, returnUrl, refreshUrl, country } = body;

  if (!organisationId || !returnUrl || !refreshUrl) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await ctx.runAction(api.stripe.createConnectAccountLink, {
      organisationId,
      returnUrl,
      refreshUrl,
      country,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error creating account link:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
