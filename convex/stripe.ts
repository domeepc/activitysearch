import { httpAction, internalMutation, internalAction, action } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: "2025-12-15.preview" as any,
});

// Map Stripe payment intent status to display status
function mapStripeStatusToDisplayStatus(
  stripeStatus: string,
  capturedAt?: number,
  refundedAt?: number
): "on_hold" | "paid" | "canceled" | "pending" {
  // If refunded, show as canceled
  if (refundedAt) {
    return "canceled";
  }

  // Map Stripe statuses
  switch (stripeStatus) {
    case "requires_capture":
      return "on_hold";
    case "succeeded":
      // If captured, it's paid
      return capturedAt ? "paid" : "on_hold";
    case "canceled":
      return "canceled";
    case "requires_payment_method":
    case "requires_confirmation":
    case "processing":
      return "pending";
    default:
      return "pending";
  }
}

// Generate Stripe dashboard URL for payment intent
function getStripeDashboardUrl(paymentIntentId: string): string {
  const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
  const baseUrl = isTestMode
    ? "https://dashboard.stripe.com/test/payments"
    : "https://dashboard.stripe.com/payments";
  return `${baseUrl}/${paymentIntentId}`;
}

// Utility function to parse address string into Stripe address format
// Address format: "line1, line2, city, state postalCode, country"
// Or simpler: "line1, city, state postalCode, country"
function parseAddressString(
  addressString: string,
  defaultCountry: string = "HR"
): Stripe.AddressParam {
  // Try to parse the address string
  // Common format: "Ulica Vice Jerčića 35, Kaštel Sućurac, splitsko-dalmatinska 212212, HR"
  const parts = addressString.split(",").map((p) => p.trim());

  if (parts.length >= 3) {
    // Assume format: line1, city, state postalCode, country
    const line1 = parts[0];
    const city = parts[1];
    const statePostal = parts[2];
    const country = parts[3] || defaultCountry;

    // Try to extract state and postal code from "state postalCode"
    const statePostalMatch = statePostal.match(/^(.+?)\s+(\d+)$/);
    let state = statePostal;
    let postalCode = "";

    if (statePostalMatch) {
      state = statePostalMatch[1].trim();
      postalCode = statePostalMatch[2].trim();
    } else {
      // If no match, assume it's just state or postal code
      if (/^\d+$/.test(statePostal)) {
        postalCode = statePostal;
        state = "";
      } else {
        state = statePostal;
      }
    }

    return {
      line1,
      city,
      state: state || undefined,
      postal_code: postalCode || undefined,
      country: country.toUpperCase(),
    };
  } else if (parts.length === 2) {
    // Simpler format: line1, city
    return {
      line1: parts[0],
      city: parts[1],
      country: defaultCountry.toUpperCase(),
    };
  } else {
    // Fallback: use entire string as line1
    return {
      line1: addressString,
      country: defaultCountry.toUpperCase(),
    };
  }
}

// Create SetupIntent for individual payment (to collect payment method)
export const createSetupIntent = action({
  args: {
    reservationId: v.id("reservations"),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { reservationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get current user
    const currentUser = await ctx.runQuery(api.users.current);
    if (!currentUser) {
      throw new Error("User not found");
    }

    // Get reservation data
    const reservationData = await ctx.runQuery(
      api.reservations.getReservationCardData,
      { reservationId }
    );

    if (!reservationData) {
      throw new Error("Reservation not found");
    }

    // Get activity to find organisation
    const activity = await ctx.runQuery(api.activity.getActivityById, {
      activityId: reservationData.activity._id,
    });

    if (!activity) {
      throw new Error("Activity not found");
    }

    // Find organisation
    const allOrganisations = await ctx.runQuery(api.organisation.getAll);
    const organisation = allOrganisations?.find(
      (org: { activityIDs: Id<"activities">[] }) =>
        org.activityIDs.includes(reservationData.activity._id)
    );

    if (!organisation) {
      throw new Error("Organisation not found");
    }

    try {
      // Create SetupIntent to collect payment method
      // SetupIntent is created on platform account (not connected account)
      // The payment method will be used later in the team PaymentIntent
      const setupIntentParams: Stripe.SetupIntentCreateParams = {
        payment_method_types: ["card"],
        metadata: {
          reservationId,
          activityId: reservationData.activity._id,
          organisationId: organisation._id,
          userId: currentUser._id,
        },
      };

      const setupIntent: Stripe.SetupIntent =
        await stripe.setupIntents.create(setupIntentParams);

      return {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
      };
    } catch (error) {
      console.error("Error creating setup intent:", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to create setup intent"
      );
    }
  },
});

// Internal action to create payment intent for a team with collected payment methods
// Must be an action (not mutation) because Stripe SDK uses setTimeout internally for retries
// Type assertion breaks circular reference: function is referenced via internal.stripe.createTeamPaymentIntentInternal
export const createTeamPaymentIntentInternal = internalAction({
  args: {
    reservationId: v.id("reservations"),
    teamId: v.id("teams"),
    amount: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { reservationId, teamId, amount, currency = "eur" }): Promise<{
    clientSecret: string | null;
    paymentIntentId: string;
  }> => {
    if (!reservationId || !amount) {
      throw new Error("Missing required fields");
    }

    // Get reservation data using runQuery (actions can't directly access db)
    const reservation = await ctx.runQuery(api.reservations.getReservationCardData, {
      reservationId,
    });
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    // Get activity
    const activity = await ctx.runQuery(api.activity.getActivityById, {
      activityId: reservation.activity._id,
    });
    if (!activity) {
      throw new Error("Activity not found");
    }

    // Find organisation
    const allOrganisations = await ctx.runQuery(api.organisation.getAll);
    const organisation = allOrganisations?.find(
      (org: { activityIDs: Id<"activities">[] }) =>
        org.activityIDs.includes(reservation.activity._id)
    );

    if (!organisation) {
      throw new Error("Organisation not found");
    }

    // Get Stripe account ID if using Connect
    const stripeAccountId: string | undefined = organisation.stripeAccountId;

    try {
      const amountInCents = Math.round(amount * 100);

      // Get all payments for this reservation and team to collect payment methods
      // Use internal mutation since we're in an action context
      const allPayments = await ctx.runMutation(
        internal.reservations.getReservationPaymentsInternal,
        { reservationId }
      );

      // Get team to filter payments
      const team = await ctx.runQuery(api.teams.getTeamById, { teamId });
      if (!team) {
        throw new Error("Team not found");
      }

      const teamMemberIds = new Set(team.teammates);
      const teamPayments = allPayments.filter(
        (p) => teamMemberIds.has(p.userId) && !p.refundedAt && p.stripePaymentMethodId
      );

      // Check if team already has a payment intent - prevent duplicate creation
      const existingPaymentIntentIds = Array.from(
        new Set(
          teamPayments
            .map((p) => p.stripePaymentIntentId)
            .filter((id): id is string => id !== undefined)
        )
      );

      if (existingPaymentIntentIds.length > 0) {
        // Team already has a payment intent, don't create another one
        console.log(
          `Team ${teamId} already has payment intent(s): ${existingPaymentIntentIds.join(", ")}, skipping creation to prevent duplicates`
        );
        // Return the first existing payment intent ID
        // The payment records are already updated with this ID, so no need to update them again
        return {
          clientSecret: null,
          paymentIntentId: existingPaymentIntentIds[0],
        };
      }

      // Collect all payment method IDs from team payments
      const paymentMethodIds = teamPayments
        .map((p) => p.stripePaymentMethodId)
        .filter((id): id is string => id !== undefined);

      if (paymentMethodIds.length === 0) {
        throw new Error("No payment methods collected for this team");
      }

      // Use the first payment method as the primary payment method for the PaymentIntent
      // Note: Stripe PaymentIntent supports one payment_method per intent
      // We'll use the first collected payment method
      const primaryPaymentMethodId = paymentMethodIds[0];
      const primaryPayment = teamPayments.find(
        (p) => p.stripePaymentMethodId === primaryPaymentMethodId
      );

      if (!primaryPayment) {
        throw new Error("Primary payment method not found");
      }

      // Get user information for the primary payment method owner
      // The payment record already includes user info from getReservationPaymentsInternal
      const primaryUser = primaryPayment.user;

      if (!primaryUser) {
        throw new Error("User not found for primary payment method");
      }

      // Create or retrieve Stripe Customer for the user
      // Search for existing customer by email
      let customer: Stripe.Customer;
      const existingCustomers = await stripe.customers.list({
        email: primaryUser.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        // Create new customer
        customer = await stripe.customers.create({
          email: primaryUser.email,
          name: `${primaryUser.name} ${primaryUser.lastname}`,
          metadata: {
            userId: primaryPayment.userId,
          },
        });
      }

      // Attach the payment method to the customer
      // Check if payment method is already attached to avoid errors
      try {
        await stripe.paymentMethods.attach(primaryPaymentMethodId, {
          customer: customer.id,
        });
      } catch {
        // If payment method is already attached, that's fine
        // Check if it's attached to a different customer
        const paymentMethod = await stripe.paymentMethods.retrieve(
          primaryPaymentMethodId
        );
        if (paymentMethod.customer && paymentMethod.customer !== customer.id) {
          // Detach from old customer and attach to new one
          await stripe.paymentMethods.detach(primaryPaymentMethodId);
          await stripe.paymentMethods.attach(primaryPaymentMethodId, {
            customer: customer.id,
          });
        }
        // If already attached to this customer, no action needed
      }

      // Create payment intent with manual capture and the primary payment method
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        capture_method: "manual", // Hold funds, don't capture immediately
        payment_method_types: ["card"], // Specify card as payment method
        payment_method: primaryPaymentMethodId, // Use first payment method
        customer: customer.id, // Attach customer to payment intent
        confirm: true, // Confirm immediately to authorize and put on hold (requires_capture)
        metadata: {
          reservationId,
          activityId: reservation.activity._id,
          organisationId: organisation._id,
          teamId: teamId, // Store team ID in metadata
          paymentMethodCount: paymentMethodIds.length.toString(),
          // Store all payment method IDs in metadata for reference
          allPaymentMethodIds: paymentMethodIds.join(","),
        },
      };

      // If using Stripe Connect, transfer to connected account
      if (stripeAccountId) {
        paymentIntentParams.application_fee_amount = Math.round(
          amount * 100 * 0.02
        ); // 2% platform fee
        paymentIntentParams.transfer_data = {
          destination: stripeAccountId,
        };
        const paymentIntent: Stripe.PaymentIntent =
          await stripe.paymentIntents.create(paymentIntentParams);

        const paymentIntentId = paymentIntent.id;

        // Update all team payments with the payment intent ID using a mutation
        await ctx.runMutation(internal.reservations.updateTeamPaymentIntentIds, {
          reservationId,
          teamId,
          paymentIntentId,
        });

        return {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        };
      }

      // Create payment intent on platform account (no Connect)
      const paymentIntent: Stripe.PaymentIntent =
        await stripe.paymentIntents.create(paymentIntentParams);

      const paymentIntentId = paymentIntent.id;

      // Update all team payments with the payment intent ID using a mutation
      await ctx.runMutation(internal.reservations.updateTeamPaymentIntentIds, {
        reservationId,
        teamId,
        paymentIntentId,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error("Error creating team payment intent:", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to create team payment intent"
      );
    }
  },
});

// Create payment intent for a team when their saldo is fulfilled
export const createTeamPaymentIntent = action({
  args: {
    reservationId: v.id("reservations"),
    teamId: v.id("teams"),
    amount: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { reservationId, teamId, amount, currency = "eur" }) => {
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

    // Get activity to find organisation
    const activity = await ctx.runQuery(api.activity.getActivityById, {
      activityId: reservationData.activity._id,
    });

    if (!activity) {
      throw new Error("Activity not found");
    }

    // Find organisation
    const allOrganisations = await ctx.runQuery(api.organisation.getAll);

    const organisation = allOrganisations?.find(
      (org: { activityIDs: Id<"activities">[] }) =>
        org.activityIDs.includes(reservationData.activity._id)
    );

    if (!organisation) {
      throw new Error("Organisation not found");
    }

    // Get Stripe account ID if using Connect
    const stripeAccountId: string | undefined = organisation.stripeAccountId;

    try {
      const amountInCents = Math.round(amount * 100);

      // Create payment intent with manual capture
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        capture_method: "manual", // Hold funds, don't capture immediately
        payment_method_types: ["card"], // Specify card as payment method
        metadata: {
          reservationId,
          activityId: reservationData.activity._id,
          organisationId: organisation._id,
          teamId: teamId, // Store team ID in metadata
        },
      };

      // If using Stripe Connect, transfer to connected account
      if (stripeAccountId) {
        paymentIntentParams.application_fee_amount = Math.round(
          amount * 100 * 0.02
        ); // 2% platform fee
        paymentIntentParams.transfer_data = {
          destination: stripeAccountId,
        };
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
      console.error("Error creating team payment intent:", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to create team payment intent"
      );
    }
  },
});

// Create payment intent with manual capture (hold funds) - Action version for frontend
// This is kept for backward compatibility but should not be used for new payments
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

    // Get current user
    const currentUser = await ctx.runQuery(api.users.current);
    if (!currentUser) {
      throw new Error("User not found");
    }

    // Get reservation data
    const reservationData = await ctx.runQuery(
      api.reservations.getReservationCardData,
      { reservationId }
    );

    if (!reservationData) {
      throw new Error("Reservation not found");
    }

    // Get teams for this reservation to find which team the user belongs to
    // Use getReservationCardData which includes teams information
    const reservationWithTeams = reservationData.teams || [];
    
    // Get full team details to check teammates
    const teams = await Promise.all(
      reservationWithTeams.map((team: { _id: Id<"teams"> }) =>
        ctx.runQuery(api.teams.getTeamById, { teamId: team._id })
      )
    );
    const validTeams = teams.filter(
      (t): t is NonNullable<typeof t> => t !== null
    );

    // Find which team(s) the current user belongs to for this reservation
    const userTeams = validTeams.filter((team) =>
      team.teammates.includes(currentUser._id)
    );

    if (userTeams.length === 0) {
      throw new Error("User is not a member of any team for this reservation");
    }

    // Use the first team the user belongs to (or we could use all teams, but let's use first for simplicity)
    const teamId = userTeams[0]._id;

    // Get activity to find organisation
    const activity = await ctx.runQuery(api.activity.getActivityById, {
      activityId: reservationData.activity._id,
    });

    if (!activity) {
      throw new Error("Activity not found");
    }

    // Find organisation
    const allOrganisations = await ctx.runQuery(api.organisation.getAll);

    const organisation = allOrganisations?.find(
      (org: { activityIDs: Id<"activities">[] }) =>
        org.activityIDs.includes(reservationData.activity._id)
    );

    if (!organisation) {
      throw new Error("Organisation not found");
    }

    // Get Stripe account ID if using Connect
    const stripeAccountId: string | undefined = organisation.stripeAccountId;

    try {
      // Check for existing payment intents for the same reservation and team
      const existingPayments = await ctx.runQuery(
        api.reservations.getReservationPayments,
        { reservationId }
      );

      // Find existing payment intents for the same team that are still modifiable
      // Get all teams for this reservation to check which team each payment belongs to
      const allReservationTeams = await Promise.all(
        reservationWithTeams.map((team: { _id: Id<"teams"> }) =>
          ctx.runQuery(api.teams.getTeamById, { teamId: team._id })
        )
      );
      const validReservationTeams = allReservationTeams.filter(
        (t): t is NonNullable<typeof t> => t !== null
      );

      // Create a map of userId -> teamIds for quick lookup
      const userToTeamsMap = new Map<Id<"users">, Id<"teams">[]>();
      for (const team of validReservationTeams) {
        for (const teammateId of team.teammates) {
          const existing = userToTeamsMap.get(teammateId) || [];
          existing.push(team._id);
          userToTeamsMap.set(teammateId, existing);
        }
      }

      // Find existing payment intents for the same team that are still modifiable
      const teamPaymentIntents = existingPayments
        .filter((p) => {
          // Check if payment is from a user in the same team
          const paymentUserTeamIds = userToTeamsMap.get(p.userId) || [];
          return (
            paymentUserTeamIds.includes(teamId) &&
            p.stripePaymentIntentId &&
            !p.capturedAt &&
            !p.refundedAt
          );
        })
        .map((p) => p.stripePaymentIntentId)
        .filter((id): id is string => id !== undefined);

      // Try to find a modifiable payment intent
      // Priority: requires_capture > requires_confirmation > requires_payment_method
      let existingPaymentIntent: Stripe.PaymentIntent | null = null;
      let bestPriority = -1;
      
      for (const paymentIntentId of teamPaymentIntents) {
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
          // Check if payment intent is in a modifiable state
          // Priority: requires_capture (3) > requires_confirmation (2) > requires_payment_method (1)
          let priority = -1;
          if (pi.status === "requires_capture") {
            priority = 3;
          } else if (pi.status === "requires_confirmation") {
            priority = 2;
          } else if (pi.status === "requires_payment_method") {
            priority = 1;
          }
          // Note: succeeded payment intents are typically captured and cannot be updated
          // We only update requires_capture, requires_confirmation, or requires_payment_method
          
          if (priority > bestPriority) {
            existingPaymentIntent = pi;
            bestPriority = priority;
          }
        } catch (error) {
          // Payment intent might not exist or be accessible, continue
          console.warn(`Could not retrieve payment intent ${paymentIntentId}:`, error);
        }
      }

      const amountInCents = Math.round(amount * 100);

      if (existingPaymentIntent) {
        // Update existing payment intent
        // Note: Payment intents in requires_capture state can be updated
        const updateParams: Stripe.PaymentIntentUpdateParams = {
          amount: existingPaymentIntent.amount + amountInCents,
          payment_method_types: ["card"], // Ensure payment method is set
        };

        // If using Stripe Connect, update application fee
        if (stripeAccountId) {
          const totalAmount = (existingPaymentIntent.amount + amountInCents) / 100;
          updateParams.application_fee_amount = Math.round(
            totalAmount * 100 * 0.02
          );
        }

        try {
          const updatedPaymentIntent = await stripe.paymentIntents.update(
            existingPaymentIntent.id,
            updateParams
          );

          return {
            clientSecret: updatedPaymentIntent.client_secret,
            paymentIntentId: updatedPaymentIntent.id,
          };
        } catch (updateError) {
          // If update fails (e.g., payment intent in wrong state), create new one
          console.warn(
            `Failed to update payment intent ${existingPaymentIntent.id}, creating new one:`,
            updateError
          );
          // Fall through to create new payment intent
        }
      }

      // Create new payment intent with manual capture
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        capture_method: "manual", // Hold funds, don't capture immediately
        payment_method_types: ["card"], // Specify card as payment method
        metadata: {
          reservationId,
          activityId: reservationData.activity._id,
          organisationId: organisation._id,
          teamId: teamId, // Store team ID in metadata
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

// Consolidate multiple payment intents into a single payment intent for a reservation/team
export const consolidatePaymentIntents = action({
  args: {
    reservationId: v.id("reservations"),
    teamId: v.optional(v.id("teams")),
  },
  handler: async (
    ctx,
    { reservationId, teamId }
  ): Promise<{
    success: boolean;
    paymentIntentId: string | null;
    message?: string;
    amount?: number;
    consolidatedCount?: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get reservation data
    const reservationData = await ctx.runQuery(
      api.reservations.getReservationCardData,
      { reservationId }
    );

    if (!reservationData) {
      throw new Error("Reservation not found");
    }

    // Get activity to find organisation
    const activity = await ctx.runQuery(api.activity.getActivityById, {
      activityId: reservationData.activity._id,
    });

    if (!activity) {
      throw new Error("Activity not found");
    }

    // Find organisation
    const allOrganisations = await ctx.runQuery(api.organisation.getAll);
    const organisation = allOrganisations?.find(
      (org: { activityIDs: Id<"activities">[] }) =>
        org.activityIDs.includes(reservationData.activity._id)
    );

    if (!organisation) {
      throw new Error("Organisation not found");
    }

    const stripeAccountId: string | undefined = organisation.stripeAccountId;

    // Get all payments for this reservation
    const allPayments = await ctx.runQuery(
      api.reservations.getReservationPayments,
      { reservationId }
    );

    // Filter payments by team if teamId is provided
    let paymentsToConsolidate = allPayments.filter(
      (p) => p.stripePaymentIntentId && !p.refundedAt
    );

    if (teamId) {
      // Get team details to filter by team members
      const team = await ctx.runQuery(api.teams.getTeamById, { teamId });
      if (team) {
        const teamMemberIds = new Set(team.teammates);
        paymentsToConsolidate = paymentsToConsolidate.filter((p) =>
          teamMemberIds.has(p.userId)
        );
      }
    }

    if (paymentsToConsolidate.length === 0) {
      throw new Error("No payment intents found to consolidate");
    }

    // Get unique payment intent IDs
    const paymentIntentIds = Array.from(
      new Set(
        paymentsToConsolidate
          .map((p) => p.stripePaymentIntentId)
          .filter((id): id is string => !!id)
      )
    );

    if (paymentIntentIds.length <= 1) {
      // Already consolidated or only one intent
      return {
        success: true,
        paymentIntentId: paymentIntentIds[0] || null,
        message: "No consolidation needed",
      };
    }

    // Retrieve all payment intents from Stripe
    const paymentIntents: Stripe.PaymentIntent[] = [];
    const modifiableIntents: Stripe.PaymentIntent[] = [];

    for (const paymentIntentId of paymentIntentIds) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        paymentIntents.push(pi);

        // Check if payment intent is in a modifiable state
        // Note: succeeded payment intents are typically captured and cannot be consolidated
        // We only consolidate requires_capture, requires_confirmation, or requires_payment_method
        if (
          pi.status === "requires_payment_method" ||
          pi.status === "requires_confirmation" ||
          pi.status === "requires_capture"
        ) {
          modifiableIntents.push(pi);
        }
      } catch (error) {
        console.error(
          `Error retrieving payment intent ${paymentIntentId}:`,
          error
        );
      }
    }

    if (modifiableIntents.length === 0) {
      throw new Error(
        "No modifiable payment intents found. All intents may be already captured or canceled."
      );
    }

    // Use the first modifiable intent as the base, or create a new one
    let consolidatedIntent: Stripe.PaymentIntent;
    const baseIntent = modifiableIntents[0];

    // Calculate total amount from all modifiable intents
    const totalAmountInCents = modifiableIntents.reduce(
      (sum, pi) => sum + pi.amount,
      0
    );

    // If we have multiple modifiable intents, we need to consolidate
    if (modifiableIntents.length > 1) {
      // Update the first intent with the total amount
      const updateParams: Stripe.PaymentIntentUpdateParams = {
        amount: totalAmountInCents,
        payment_method_types: ["card"], // Ensure payment method is set
      };

      // If using Stripe Connect, update application fee
      if (stripeAccountId) {
        const totalAmountDecimal = totalAmountInCents / 100;
        updateParams.application_fee_amount = Math.round(
          totalAmountDecimal * 100 * 0.02
        );
      }

      consolidatedIntent = await stripe.paymentIntents.update(
        baseIntent.id,
        updateParams
      );

      // Cancel other modifiable payment intents
      for (let i = 1; i < modifiableIntents.length; i++) {
        const intentToCancel = modifiableIntents[i];
        try {
          if (intentToCancel.status === "requires_capture") {
            await stripe.paymentIntents.cancel(intentToCancel.id);
          } else if (
            intentToCancel.status === "requires_payment_method" ||
            intentToCancel.status === "requires_confirmation"
          ) {
            await stripe.paymentIntents.cancel(intentToCancel.id);
          }
        } catch (error) {
          console.error(
            `Error canceling payment intent ${intentToCancel.id}:`,
            error
          );
        }
      }

      // Update all payment records to point to the consolidated intent
      await ctx.runMutation(internal.reservations.updatePaymentIntentIds, {
        reservationId,
        oldPaymentIntentIds: modifiableIntents
          .slice(1)
          .map((pi) => pi.id),
        newPaymentIntentId: consolidatedIntent.id,
      });
    } else {
      // Only one modifiable intent, no consolidation needed
      consolidatedIntent = baseIntent;
    }

    return {
      success: true,
      paymentIntentId: consolidatedIntent.id,
      amount: consolidatedIntent.amount / 100,
      consolidatedCount: modifiableIntents.length,
    };
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

// Capture payment (called on activity day) - internal mutation version
// Note: Stripe's capture method doesn't use setTimeout, so this can be a mutation
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

      if (payment && !payment.capturedAt) {
        await ctx.db.patch(payment._id, {
          capturedAt: Date.now(),
        });

        // Check if all payments for this reservation are captured and update status
        // This will also send card updates if status changes to fulfilled
        await ctx.runMutation(internal.reservations.checkAndUpdateFulfilledStatus, {
          reservationId,
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

// Refund payment (for cancellations) - internal action version (must be action because Stripe SDK uses setTimeout)
export const refundPayment = internalAction({
  args: {
    paymentIntentId: v.string(),
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { paymentIntentId, reservationId }) => {
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

      // Update payment record via mutation
      await ctx.runMutation(internal.reservations.updatePaymentRefundedAt, {
        paymentIntentId,
        reservationId,
        refundedAt: Date.now(),
      });

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
    IBAN: v.optional(v.string()),
    currency: v.optional(v.string()),
    bankCountry: v.optional(v.string()),
    externalAccountToken: v.optional(v.string()),
    defaultForCurrency: v.optional(v.boolean()),
    routingNumber: v.optional(v.string()),
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
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      dateOfBirth,
      firstName,
      lastName,
      businessWebsite,
      businessDescription,
      industry,
      IBAN,
      currency,
      bankCountry,
      externalAccountToken,
      defaultForCurrency,
      routingNumber,
    } = args;

    // Debug log to verify values are received
    console.log("Received external account parameters:", {
      hasIBAN: !!IBAN,
      IBAN: IBAN ? IBAN.substring(0, 4) + "..." : "NOT PROVIDED",
      IBANLength: IBAN?.length || 0,
      IBANTrimmed: IBAN?.trim() || "EMPTY",
      currency: currency || "not provided",
      bankCountry: bankCountry || "not provided",
      externalAccountToken: externalAccountToken ? "PROVIDED" : "NOT PROVIDED",
    });

    if (!organisationId || !country || !businessType || !email) {
      throw new Error("Missing required fields");
    }

    try {
      // Get organisation
      const organisation = await ctx.runQuery(api.organisation.getById, {
        organisationId,
      });

      if (!organisation) {
        throw new Error("Organisation not found");
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
        business_type: "individual", // Use individual type
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
      if (!dateOfBirth || dateOfBirth.trim() === "") {
        throw new Error("Date of birth is required");
      }

      const dobParts = dateOfBirth.split("-");
      if (dobParts.length !== 3) {
        throw new Error("Invalid date of birth format. Expected YYYY-MM-DD");
      }

      const dobDay = parseInt(dobParts[2], 10);
      const dobMonth = parseInt(dobParts[1], 10);
      const dobYear = parseInt(dobParts[0], 10);

      if (isNaN(dobDay) || isNaN(dobMonth) || isNaN(dobYear)) {
        throw new Error("Invalid date of birth. Day, month, and year must be valid numbers");
      }

      // For individual accounts, use individual field directly
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

      // Add business_profile with all required fields for payments and payouts
      // According to Stripe docs, business_profile fields are often required for activation
      accountParams.business_profile = {};
      
      // Product description is required (use organisation description)
      if (businessDescription) {
        accountParams.business_profile.product_description = businessDescription;
      }
      
      // URL - use website if provided, otherwise Stripe will use product_description
      if (businessWebsite) {
        accountParams.business_profile.url = businessWebsite;
      }
      // If no website, Stripe will use product_description (which we always provide)
      
      // Support contact information - required for many countries including HR
      // Use the organisation email and phone for support
      accountParams.business_profile.support_email = email;
      if (formattedPhone) {
        accountParams.business_profile.support_phone = formattedPhone;
      }
      
      // MCC (Merchant Category Code) - map industry to appropriate MCC
      // "Other entertainment and recreation" typically maps to MCC 7999
      if (industry) {
        const mccMap: Record<string, string> = {
          "Tourism & Travel": "4722",
          "Events & Entertainment": "7922",
          "Sports & Recreation": "7941",
          "Adventure & Outdoor": "7999",
          "Education & Training": "8299",
          "Food & Beverage": "5812",
          "Arts & Culture": "7929",
          "Health & Wellness": "8041",
          "Technology & Digital": "7372",
          "Retail & Shopping": "5999",
          "Hospitality & Accommodation": "7011",
          "Other entertainment and recreation": "7999",
          "Other": "7999",
        };
        const mcc = mccMap[industry] || "7999"; // Default to 7999 for "Other entertainment and recreation"
        accountParams.business_profile.mcc = mcc;
      } else {
        // Default MCC for "Other entertainment and recreation"
        accountParams.business_profile.mcc = "7999";
      }

      // Add external account (bank account) to account creation if token or IBAN is provided
      // This makes it the default external account for that currency
      const externalAccountCurrency = (currency && currency.trim()) || "EUR";
      const externalAccountCountry = (bankCountry && bankCountry.trim()) || "HR";
      
      if (externalAccountToken) {
        // Use token if provided (from Stripe.js)
        accountParams.external_account = externalAccountToken;
        console.log("Adding external account token to account creation:", {
          token: externalAccountToken.substring(0, 10) + "...",
        });
      } else if (IBAN && IBAN.trim()) {
        // Use IBAN details if token is not available
        const cleanedIBAN = IBAN.replace(/\s/g, "").toUpperCase();
        
        // Validate IBAN format
        if (cleanedIBAN.match(/^[A-Z]{2}\d{2}[A-Z0-9]+$/)) {
          const accountHolderName = `${firstName} ${lastName}`.trim();
          
          accountParams.external_account = {
            object: "bank_account",
            country: externalAccountCountry.toUpperCase(),
            currency: externalAccountCurrency.toLowerCase(),
            account_number: cleanedIBAN,
            account_holder_name: accountHolderName,
            account_holder_type: "individual",
          };
          
          // Add routing number if provided (for US accounts)
          if (routingNumber && routingNumber.trim()) {
            accountParams.external_account.routing_number = routingNumber.trim();
          }
          
          console.log("Adding external account (IBAN) to account creation:", {
            IBAN: cleanedIBAN.substring(0, 4) + "..." + cleanedIBAN.substring(cleanedIBAN.length - 4),
            currency: externalAccountCurrency,
            country: externalAccountCountry,
          });
        } else {
          console.warn("Invalid IBAN format, skipping external account in account creation:", cleanedIBAN);
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

          // Remove phone from individual params and retry
          if (accountParams.individual && accountParams.individual.phone) {
            delete accountParams.individual.phone;
          }

          // Retry without phone number
          account = await stripe.accounts.create(accountParams);
        } else {
          // Re-throw if it's not a phone number error
          throw createError;
        }
      }

      // Update organisation with account ID
      await ctx.runMutation(api.organisation.updateStripeAccount, {
        organisationId,
        stripeAccountId: account.id,
      });

      // Check if external account was already added during account creation
      // If it was added, we don't need to create it separately
      const externalAccountAlreadyAdded = !!(accountParams.external_account);
      
      if (!externalAccountAlreadyAdded) {
        // Create bank account separately if token is provided OR IBAN is provided
        // (This handles the case where account creation didn't include external_account)
        const hasToken = !!externalAccountToken;
        const hasIBAN = !!(IBAN && IBAN.trim() && IBAN.trim().length > 0);
        console.log("External account creation condition check:", {
          hasToken,
          hasIBAN,
          IBANValue: IBAN || "undefined",
          IBANTrimmed: IBAN?.trim() || "empty",
          willCreate: hasToken || hasIBAN,
        });
        
        if (hasToken || hasIBAN) {
          try {
          // Prepare account holder name (first name + last name)
          const accountHolderName = `${firstName} ${lastName}`.trim();
          
          // Build the external account parameter
          // If token is provided, use it directly; otherwise use bank account details
          let externalAccountParam: string | {
            object: "bank_account";
            country: string;
            currency: string;
            account_number: string;
            account_holder_name: string;
            account_holder_type: "individual";
            routing_number?: string;
          };
          
          if (externalAccountToken) {
            // Token-based bank account (from Stripe.js)
            // Token should be in format: btok_... (bank account token)
            // Validate token format
            if (!externalAccountToken.startsWith("btok_")) {
              console.warn("Bank account token format may be incorrect. Expected 'btok_...' but got:", externalAccountToken.substring(0, 10) + "...");
            }
            externalAccountParam = externalAccountToken;
            console.log("Creating external account with token:", {
              accountId: account.id,
              token: externalAccountToken.substring(0, 10) + "...", // Log partial token for security
              tokenLength: externalAccountToken.length,
            });
          } else if (IBAN && IBAN.trim()) {
            // Direct bank account details (IBAN)
            // Clean IBAN (remove spaces and convert to uppercase)
            const cleanedIBAN = IBAN.replace(/\s/g, "").toUpperCase();
            
            // Validate IBAN format (should start with country code)
            if (!cleanedIBAN.match(/^[A-Z]{2}\d{2}[A-Z0-9]+$/)) {
              throw new Error(`Invalid IBAN format: ${cleanedIBAN}`);
            }
            
            console.log("Creating external account with IBAN:", {
              accountId: account.id,
              IBAN: cleanedIBAN.substring(0, 4) + "..." + cleanedIBAN.substring(cleanedIBAN.length - 4), // Log partial IBAN for security
              currency: externalAccountCurrency,
              country: externalAccountCountry,
              accountHolderName: accountHolderName,
              accountHolderType: "individual",
            });
            
            // Build external account object
            const externalAccountObject: {
              object: "bank_account";
              country: string;
              currency: string;
              account_number: string;
              account_holder_name: string;
              account_holder_type: "individual";
              routing_number?: string;
            } = {
              object: "bank_account",
              country: externalAccountCountry.toUpperCase(),
              currency: externalAccountCurrency.toLowerCase(),
              account_number: cleanedIBAN,
              account_holder_name: accountHolderName,
              account_holder_type: "individual", // Since we're using business_type: "individual"
            };
            
            // Add routing number if provided (for US accounts)
            if (routingNumber && routingNumber.trim()) {
              externalAccountObject.routing_number = routingNumber.trim();
            }
            
            externalAccountParam = externalAccountObject;
          } else {
            throw new Error("Either externalAccountToken or IBAN must be provided");
          }
          
          // Build the create parameters
          const createParams: {
            external_account: string | {
              object: "bank_account";
              country: string;
              currency: string;
              account_number: string;
              account_holder_name: string;
              account_holder_type: "individual";
              routing_number?: string;
            };
            default_for_currency?: boolean;
          } = {
            external_account: externalAccountParam,
          };
          
          // Add optional parameters
          if (defaultForCurrency !== undefined) {
            createParams.default_for_currency = defaultForCurrency;
          }
          
          // Create external account for bank payouts
          // Using stripe.accounts.createExternalAccount() - the standard SDK method
          // This works with both tokens (btok_...) and direct bank account details
          // Returns a single external account object
          const externalAccount = await stripe.accounts.createExternalAccount(
            account.id,
            createParams
          );
          
          console.log("External account created successfully:", {
            externalAccountId: externalAccount.id,
            currency: externalAccount.currency,
            country: externalAccount.country,
            status: externalAccount.status,
            last4: externalAccount.last4,
            object: externalAccount.object,
          });
        } catch (externalAccountError: unknown) {
          // Log error but don't fail the account creation
          console.error("Error creating external account:", externalAccountError);
          const errorMessage = externalAccountError instanceof Error
            ? externalAccountError.message
            : String(externalAccountError);
          
          // Check if it's a Stripe error with more details
          const errorDetails: {
            error: string;
            IBAN?: string;
            token?: string;
            currency: string;
            country: string;
            stripeErrorType?: string;
            stripeErrorCode?: string;
            stripeErrorParam?: string;
            stripeErrorMessage?: string;
          } = {
            error: errorMessage,
            currency: externalAccountCurrency,
            country: externalAccountCountry,
          };
          
          if (externalAccountToken) {
            errorDetails.token = externalAccountToken.substring(0, 10) + "...";
          } else if (IBAN) {
            errorDetails.IBAN = IBAN.substring(0, 4) + "...";
          }
          
          if (externalAccountError && typeof externalAccountError === "object" && "type" in externalAccountError) {
            const stripeError = externalAccountError as { type?: string; code?: string; param?: string; message?: string };
            errorDetails.stripeErrorType = stripeError.type;
            errorDetails.stripeErrorCode = stripeError.code;
            errorDetails.stripeErrorParam = stripeError.param;
            errorDetails.stripeErrorMessage = stripeError.message;
          }
          
          console.error("External account error details:", errorDetails);
          // Continue - user can add external account later through Stripe dashboard
          }
        } else {
          console.warn("Neither externalAccountToken nor IBAN provided, skipping external account creation. Account can add it later.");
        }
      } else {
        console.log("External account was already added during account creation, skipping separate creation.");
      }

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
    type: v.optional(
      v.union(v.literal("account_onboarding"), v.literal("account_update"))
    ),
  },
  handler: async (
    ctx,
    { organisationId, returnUrl, refreshUrl, country, type }
  ) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get organisation
    const organisation = await ctx.runQuery(api.organisation.getById, {
      organisationId,
    });

    if (!organisation) {
      throw new Error("Organisation not found");
    }

    // Validate email
    if (
      !organisation.organisationEmail ||
      !organisation.organisationEmail.includes("@")
    ) {
      throw new Error(
        "Organisation email is invalid. Please update your organisation email first."
      );
    }

    let accountId = organisation.stripeAccountId;

    // Auto-detect link type if not provided
    let linkType: "account_onboarding" | "account_update" = type || "account_onboarding";

    // If account exists, check if it needs updates
    if (accountId && !type) {
      try {
        const account = await stripe.accounts.retrieve(accountId);
        const requirements = account.requirements;
        const hasRequirements =
          (requirements?.currently_due && requirements.currently_due.length > 0) ||
          (requirements?.past_due && requirements.past_due.length > 0);

        // Use account_update if account exists and has requirements
        if (hasRequirements) {
          linkType = "account_update";
        }
      } catch (error) {
        // If account retrieval fails, default to onboarding
        console.warn("Could not retrieve account to determine link type:", error);
        linkType = "account_onboarding";
      }
    }

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

        // Update organisation with account ID
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

    // Create account link with appropriate type
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: linkType,
    });

    return { url: accountLink.url };
  },
});

// Update Stripe account from organisation data
export const updateStripeAccountFromOrganisation = action({
  args: {
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, { organisationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get organisation
    const organisation = await ctx.runQuery(api.organisation.getById, {
      organisationId,
    });

    if (!organisation) {
      throw new Error("Organisation not found");
    }

    const accountId = organisation.stripeAccountId;

    if (!accountId) {
      // No Stripe account to update
      return { success: true, message: "No Stripe account found" };
    }

    try {
      // Retrieve current Stripe account
      const account = await stripe.accounts.retrieve(accountId);

      // Build update parameters
      const updateParams: Stripe.AccountUpdateParams = {};

      // Update email if changed
      if (
        organisation.organisationEmail &&
        organisation.organisationEmail !== account.email
      ) {
        updateParams.email = organisation.organisationEmail;
      }

      // Update business profile
      if (organisation.description) {
        updateParams.business_profile = {
          product_description: organisation.description,
        };
        // Preserve existing fields if they exist
        if (account.business_profile?.url) {
          updateParams.business_profile.url = account.business_profile.url;
        }
        if (account.business_profile?.mcc) {
          updateParams.business_profile.mcc = account.business_profile.mcc;
        }
      }

      // Update individual information if available
      // Get owner user to extract name
      if (organisation.organisersIDs.length > 0) {
        const ownerId = organisation.organisersIDs[0];
        // Get user data using a query that can access the database
        const allUsers = await ctx.runQuery(api.users.getUsersByIds, {
          userIds: [ownerId],
        });
        const owner = allUsers.length > 0 ? allUsers[0] : null;

        if (owner) {
          // Parse address
          const parsedAddress = parseAddressString(organisation.address, "HR");

          const ownerEmail = organisation.organisationEmail || (account.email && account.email !== null ? account.email : undefined);
          updateParams.individual = {
            first_name: owner.name,
            last_name: owner.lastname,
            email: ownerEmail,
            address: parsedAddress,
          };
        } else {
          // If no owner found, still update address
          const parsedAddress = parseAddressString(organisation.address, "HR");
          if (account.individual) {
            const noOwnerEmail = organisation.organisationEmail || (account.email && account.email !== null ? account.email : undefined);
            updateParams.individual = {
              address: parsedAddress,
              email: noOwnerEmail,
            };
          }
        }
      } else {
        // If no owner found, still update address
        const parsedAddress = parseAddressString(organisation.address, "HR");
        if (account.individual) {
          const individualEmail = organisation.organisationEmail || (account.email && account.email !== null ? account.email : undefined);
          updateParams.individual = {
            address: parsedAddress,
            email: individualEmail,
          };
        }
      }

      // Update account if there are changes
      if (Object.keys(updateParams).length > 0) {
        await stripe.accounts.update(accountId, updateParams);
        console.log("Stripe account updated successfully");
      }

      // Update external account (IBAN) if changed
      if (organisation.IBAN && organisation.IBAN.trim()) {
        try {
          // Get existing external accounts
          const externalAccounts = await stripe.accounts.listExternalAccounts(
            accountId,
            { limit: 10 }
          );

          const cleanedIBAN = organisation.IBAN.replace(/\s/g, "").toUpperCase();

          // Check if IBAN already exists
          // Note: BankAccount doesn't expose account_number directly for security
          // We'll check by comparing the last4 or create a new one if needed
          const existingBankAccount = externalAccounts.data.find(
            (ea) => ea.object === "bank_account"
          );
          
          // If there's an existing bank account, we might need to replace it
          // For now, we'll create a new one if none exists
          const shouldCreateNew = !existingBankAccount;

          if (shouldCreateNew) {
            // Create new external account
            const accountHolderName =
              updateParams.individual?.first_name &&
              updateParams.individual?.last_name
                ? `${updateParams.individual.first_name} ${updateParams.individual.last_name}`
                : account.individual?.first_name && account.individual?.last_name
                ? `${account.individual.first_name} ${account.individual.last_name}`
                : "";

            if (accountHolderName) {
              await stripe.accounts.createExternalAccount(accountId, {
                external_account: {
                  object: "bank_account",
                  country: "HR",
                  currency: "eur",
                  account_number: cleanedIBAN,
                  account_holder_name: accountHolderName,
                  account_holder_type: "individual",
                },
              });
              console.log("External account (IBAN) updated successfully");
            }
          } else {
            console.log("External account already exists, skipping creation");
          }
        } catch (externalAccountError) {
          console.error("Error updating external account:", externalAccountError);
          // Don't fail the entire update if external account update fails
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Error updating Stripe account:", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to update Stripe account"
      );
    }
  },
});

// Get Stripe account status and requirements
export const getStripeAccountStatus = action({
  args: {
    organisationId: v.id("organisations"),
  },
  handler: async (
    ctx,
    { organisationId }
  ): Promise<{
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
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get organisation
    const organisation = await ctx.runQuery(api.organisation.getById, {
      organisationId,
    });

    if (!organisation) {
      throw new Error("Organisation not found");
    }

    const accountId: string | undefined = organisation.stripeAccountId;

    // If no Stripe account, return not connected
    if (!accountId) {
      return {
        connected: false,
        needsUpdate: false,
      };
    }

    try {
      // Retrieve Stripe account
      const account: Stripe.Account = await stripe.accounts.retrieve(accountId);

      // Check requirements
      const requirements = account.requirements;
      const currentlyDue = requirements?.currently_due || [];
      const pastDue = requirements?.past_due || [];
      const eventuallyDue = requirements?.eventually_due || [];

      // Determine if account needs updates
      const needsUpdate = currentlyDue.length > 0 || pastDue.length > 0;

      // Get capabilities status
      const cardPaymentsStatus = account.capabilities?.card_payments || "inactive";
      const transfersStatus = account.capabilities?.transfers || "inactive";

      return {
        connected: true,
        accountId: account.id,
        needsUpdate,
        requirements: {
          currentlyDue,
          pastDue,
          eventuallyDue,
        },
        capabilities: {
          cardPayments: cardPaymentsStatus as "active" | "inactive" | "pending",
          transfers: transfersStatus as "active" | "inactive" | "pending",
        },
        payoutsEnabled: account.payouts_enabled || false,
        chargesEnabled: account.charges_enabled || false,
        detailsSubmitted: account.details_submitted || false,
      };
    } catch (error) {
      console.error("Error retrieving Stripe account:", error);
      // If account doesn't exist in Stripe, return not connected
      if (
        error &&
        typeof error === "object" &&
        "type" in error &&
        (error as { type?: string }).type === "StripeInvalidRequestError"
      ) {
        return {
          connected: false,
          needsUpdate: false,
        };
      }
      throw error;
    }
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

// Get Stripe payment intents for organiser
export const getStripePaymentIntentsForOrganiser = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get current user
    const currentUser = await ctx.runQuery(api.users.current);
    if (!currentUser || currentUser.role !== "organiser") {
      return [];
    }

    // Find organisation(s) where user is an organiser
    const allOrganisations = await ctx.runQuery(api.organisation.getAll);
    const userOrganisations = allOrganisations.filter((org) =>
      org.organisersIDs.includes(currentUser._id)
    );

    if (userOrganisations.length === 0) {
      return [];
    }

    // Get all activity IDs from user's organisations
    const activityIds = new Set<Id<"activities">>();
    for (const org of userOrganisations) {
      for (const activityId of org.activityIDs) {
        activityIds.add(activityId);
      }
    }

    if (activityIds.size === 0) {
      return [];
    }

    // Get all reservations for these activities
    const allReservations = await ctx.runQuery(api.reservations.getReservationsForOrganiser);
    const organiserReservations = allReservations.filter((r) => !r.cancelledAt);
    
    if (organiserReservations.length === 0) {
      return [];
    }

    const reservationIds = organiserReservations.map((r) => r._id);

    // Get all payment records for these reservations
    // We need to get payments for each reservation
    const allPayments: Array<{
      reservationId: Id<"reservations">;
      userId: Id<"users">;
      stripePaymentIntentId?: string;
      capturedAt?: number;
      refundedAt?: number;
      amount: number;
    }> = [];
    
    // Get payments for each reservation
    for (const reservationId of reservationIds) {
      const payments = await ctx.runQuery(api.reservations.getReservationPayments, {
        reservationId,
      });
      for (const payment of payments) {
        if (payment.stripePaymentIntentId) {
          allPayments.push({
            reservationId,
            userId: payment.userId,
            stripePaymentIntentId: payment.stripePaymentIntentId,
            capturedAt: payment.capturedAt,
            refundedAt: payment.refundedAt,
            amount: payment.amount,
          });
        }
      }
    }
    
    const relevantPayments = allPayments;

    // Get unique payment intent IDs
    const paymentIntentIds: string[] = Array.from(
      new Set(
        relevantPayments
          .map((p) => p.stripePaymentIntentId)
          .filter((id): id is string => !!id)
      )
    );

    if (paymentIntentIds.length === 0) {
      return [];
    }

    // Group payments by reservation and team to identify consolidation needs
    const paymentsByReservationAndTeam = new Map<
      string, // key: `${reservationId}_${teamId}`
      {
        reservationId: Id<"reservations">;
        teamId: Id<"teams"> | null;
        paymentIntentIds: Set<string>;
      }
    >();

    // First pass: group all payments by reservation and team to identify which need consolidation
    for (const payment of relevantPayments) {
      // Get reservation to find teams
      const reservation = organiserReservations.find(
        (r) => r._id === payment.reservationId
      );
      if (!reservation) continue;

      // Get teams for this reservation
      const reservationTeams = await Promise.all(
        reservation.teamIds.map((tid: Id<"teams">) =>
          ctx.runQuery(api.teams.getTeamById, { teamId: tid })
        )
      );
      const validTeams = reservationTeams.filter(
        (t): t is NonNullable<typeof t> => t !== null
      );

      // Find which team this payment belongs to
      let paymentTeamId: Id<"teams"> | null = null;
      for (const team of validTeams) {
        if (team.teammates.includes(payment.userId)) {
          paymentTeamId = team._id;
          break;
        }
      }

      // If we can't determine team, use first team as fallback
      if (!paymentTeamId && validTeams.length > 0) {
        paymentTeamId = validTeams[0]._id;
      }

      const key = paymentTeamId
        ? `${payment.reservationId}_${paymentTeamId}`
        : `${payment.reservationId}_unknown`;

      const existing = paymentsByReservationAndTeam.get(key);
      if (existing) {
        if (payment.stripePaymentIntentId) {
          existing.paymentIntentIds.add(payment.stripePaymentIntentId);
        }
      } else {
        paymentsByReservationAndTeam.set(key, {
          reservationId: payment.reservationId,
          teamId: paymentTeamId,
          paymentIntentIds: new Set(
            payment.stripePaymentIntentId ? [payment.stripePaymentIntentId] : []
          ),
        });
      }
    }

    // Consolidate payment intents where multiple exist for same reservation/team
    const consolidatedIntentIds = new Map<string, string>(); // old -> new
    for (const [
      key,
      { reservationId, teamId, paymentIntentIds },
    ] of paymentsByReservationAndTeam) {
      if (paymentIntentIds.size > 1) {
        // Multiple payment intents for this reservation/team - consolidate them
        try {
          const result: {
            success: boolean;
            paymentIntentId: string | null;
            message?: string;
            amount?: number;
            consolidatedCount?: number;
          } = await ctx.runAction(api.stripe.consolidatePaymentIntents, {
            reservationId,
            teamId: teamId || undefined,
          });
          if (result.success && result.paymentIntentId) {
            // Map all old intent IDs to the new consolidated one
            for (const oldIntentId of paymentIntentIds) {
              if (oldIntentId !== result.paymentIntentId) {
                consolidatedIntentIds.set(oldIntentId, result.paymentIntentId);
              }
            }
            // Update relevantPayments to use consolidated intent ID
            for (const payment of relevantPayments) {
              if (
                payment.reservationId === reservationId &&
                payment.stripePaymentIntentId &&
                consolidatedIntentIds.has(payment.stripePaymentIntentId)
              ) {
                payment.stripePaymentIntentId = consolidatedIntentIds.get(
                  payment.stripePaymentIntentId
                )!;
              }
            }
          }
        } catch (error) {
          console.error(
            `Error consolidating payment intents for ${key}:`,
            error
          );
          // Continue even if consolidation fails
        }
      }
    }

    // Update payment intent IDs list to reflect consolidations
    const finalPaymentIntentIds = Array.from(
      new Set(
        relevantPayments
          .map((p) => p.stripePaymentIntentId)
          .filter((id): id is string => !!id)
      )
    );

    if (finalPaymentIntentIds.length === 0) {
      return [];
    }

    // Retrieve payment intents from Stripe API
    const paymentIntentsData = await Promise.allSettled(
      finalPaymentIntentIds.map(async (paymentIntentId: string) => {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          
          // Extract teamId from metadata (legacy payment intents might not have it)
          const teamIdFromMetadata = paymentIntent.metadata?.teamId as Id<"teams"> | undefined;
          
          // Find the payment record(s) for this payment intent
          const paymentRecords = relevantPayments.filter(
            (p: { stripePaymentIntentId?: string }) => p.stripePaymentIntentId === paymentIntentId
          );

          if (paymentRecords.length === 0) {
            return null;
          }

          // Group by (reservation, team) - one payment intent per team per reservation
          // If teamId is in metadata, use it; otherwise try to infer from payments
          const paymentByReservationAndTeam = new Map<
            string, // key: `${reservationId}_${teamId}`
            {
              reservationId: Id<"reservations">;
              teamId: Id<"teams"> | null;
              payments: Array<{
                reservationId: Id<"reservations">;
                stripePaymentIntentId?: string;
                capturedAt?: number;
                refundedAt?: number;
                amount: number;
              }>;
            }
          >();

          for (const payment of paymentRecords) {
            // Use teamId from metadata if available, otherwise we'll need to infer it
            const teamId = teamIdFromMetadata || null;
            const key = teamId 
              ? `${payment.reservationId}_${teamId}`
              : `${payment.reservationId}_unknown`;
            
            const existing = paymentByReservationAndTeam.get(key);
            if (existing) {
              existing.payments.push({
                reservationId: payment.reservationId,
                stripePaymentIntentId: payment.stripePaymentIntentId,
                capturedAt: payment.capturedAt,
                refundedAt: payment.refundedAt,
                amount: payment.amount,
              });
            } else {
              paymentByReservationAndTeam.set(key, {
                reservationId: payment.reservationId,
                teamId,
                payments: [{
                  reservationId: payment.reservationId,
                  stripePaymentIntentId: payment.stripePaymentIntentId,
                  capturedAt: payment.capturedAt,
                  refundedAt: payment.refundedAt,
                  amount: payment.amount,
                }],
              });
            }
          }

          // Process each (reservation, team) combination
          const results = [];
          for (const [, { reservationId, teamId, payments }] of paymentByReservationAndTeam) {
            // Find reservation details
            const reservation = organiserReservations.find(
              (r) => r._id === reservationId
            );
            if (!reservation) continue;

            // If teamId wasn't in metadata, try to infer it from reservation teams
            let finalTeamId: Id<"teams"> | null = teamId;
            if (!finalTeamId) {
              // Get reservation teams and try to match based on payment users
              // For now, we'll use the first team if we can't determine
              const reservationTeams = await Promise.all(
                reservation.teamIds.map((tid: Id<"teams">) =>
                  ctx.runQuery(api.teams.getTeamById, { teamId: tid })
                )
              );
              const validTeams = reservationTeams.filter(
                (t): t is NonNullable<typeof t> => t !== null
              );
              // Use first team as fallback (this is a legacy data case)
              finalTeamId = validTeams.length > 0 ? validTeams[0]._id : null;
            }

            // Get team information
            let teamName = "Unknown Team";
            if (finalTeamId) {
              const team = await ctx.runQuery(api.teams.getTeamById, {
                teamId: finalTeamId,
              });
              if (team) {
                teamName = team.teamName;
              }
            }

            // Get activity for pricing
            const activity = await ctx.runQuery(api.activity.getActivityById, {
              activityId: reservation.activityId,
            });

            // Calculate team-level collected amount (sum of all payments from this team for this reservation)
            const teamPayments = payments.filter((p) => !p.refundedAt);
            const teamCollectedAmount = teamPayments.reduce(
              (sum, p) => sum + p.amount,
              0
            );

            // Calculate total reservation amount and remaining
            const totalAmount = activity ? activity.price * Number(reservation.userCount) : 0;
            const allReservationPayments = allPayments.filter(
              (p) => p.reservationId === reservationId && !p.refundedAt
            );
            const totalCollectedAmount = allReservationPayments.reduce(
              (sum, p) => sum + p.amount,
              0
            );
            // If reservation is fulfilled, remaining should be 0
            const remainingAmount = reservation.paymentStatus === "fulfilled"
              ? 0
              : Math.max(0, totalAmount - totalCollectedAmount);

            // Determine display status
            const paymentRecord = payments[0];
            const displayStatus = mapStripeStatusToDisplayStatus(
              paymentIntent.status,
              paymentRecord.capturedAt,
              paymentRecord.refundedAt
            );

            results.push({
              paymentIntentId: paymentIntent.id,
              reservationId,
              teamId: finalTeamId,
              teamName,
              activityName: reservation.activity?.activityName || "Unknown Activity",
              activityAddress: reservation.activity?.address || "",
              date: reservation.date,
              time: reservation.time,
              status: displayStatus,
              stripeStatus: paymentIntent.status,
              amount: paymentIntent.amount / 100, // Convert from cents (this is the team's payment intent amount)
              collectedAmount: teamCollectedAmount, // Team's collected amount (saldo)
              remainingAmount, // Reservation-level remaining
              currency: paymentIntent.currency.toUpperCase(),
              createdAt: paymentIntent.created * 1000, // Convert to milliseconds
              capturedAt: paymentRecord.capturedAt,
              refundedAt: paymentRecord.refundedAt,
              stripeDashboardUrl: getStripeDashboardUrl(paymentIntent.id),
            });
          }

          return results;
        } catch (error) {
          console.error(
            `Error retrieving payment intent ${paymentIntentId}:`,
            error
          );
          return null;
        }
      })
    );

    // Flatten results and filter out nulls
    const allResults: Array<{
      paymentIntentId: string;
      reservationId: Id<"reservations">;
      teamId: Id<"teams"> | null;
      teamName: string;
      activityName: string;
      activityAddress: string;
      date: string;
      time: string;
      status: "on_hold" | "paid" | "canceled" | "pending";
      stripeStatus: string;
      amount: number;
      collectedAmount: number;
      remainingAmount: number;
      currency: string;
      createdAt: number;
      capturedAt?: number;
      refundedAt?: number;
      stripeDashboardUrl: string;
    }> = [];

    for (const result of paymentIntentsData) {
      if (result.status === "fulfilled" && result.value) {
        if (Array.isArray(result.value)) {
          allResults.push(...result.value);
        } else if (result.value !== null) {
          allResults.push(result.value);
        }
      }
    }

    // Sort by date (most recent first)
    return allResults.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.time.localeCompare(a.time);
    });
  },
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
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // Handle different event types
  switch (event.type) {
    case "payment_intent.created":
      // Payment intent was created
      // No action needed - payment intent is already tracked in our database
      console.log(`Payment intent created: ${(event.data.object as Stripe.PaymentIntent).id}`);
      break;

    case "payment_intent.succeeded":
      // Payment was successfully captured
      const succeededPaymentIntent = event.data.object as Stripe.PaymentIntent;
      const reservationId = succeededPaymentIntent.metadata?.reservationId as Id<"reservations"> | undefined;
      
      if (reservationId) {
        // Use internal mutation to find and update payment
        // This will also check if all payments are captured and update reservation status
        // and send card updates if status changes to fulfilled
        await ctx.runMutation(internal.reservations.updatePaymentFromWebhook, {
          paymentIntentId: succeededPaymentIntent.id,
          reservationId,
          capturedAt: Date.now(),
        });
      }
      console.log(`Payment intent succeeded: ${succeededPaymentIntent.id}`);
      break;

    case "payment_intent.canceled":
      // Payment was canceled
      // Update payment status in database if needed
      break;

    case "setup_intent.created":
      // SetupIntent was created
      // No action needed - SetupIntent is tracked when payment is recorded
      console.log(`SetupIntent created: ${(event.data.object as Stripe.SetupIntent).id}`);
      break;

    case "setup_intent.succeeded":
      // SetupIntent succeeded - payment method was collected
      // No action needed - payment method ID is already stored when payment is recorded
      console.log(`SetupIntent succeeded: ${(event.data.object as Stripe.SetupIntent).id}`);
      break;

    case "setup_intent.setup_failed":
      // SetupIntent failed
      console.log(`SetupIntent failed: ${(event.data.object as Stripe.SetupIntent).id}`);
      break;

    case "account.updated":
      // Stripe Connect account was updated
      // Update organisation onboarding status if needed
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
