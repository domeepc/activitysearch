import {
  httpAction,
  internalMutation,
  internalAction,
  action,
  type ActionCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import Stripe from "stripe";
import { STRIPE_SUPPORTED_COUNTRIES } from "../lib/countries";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY must be set");
}

const stripe = new Stripe(stripeSecretKey, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: "2025-12-15.preview" as any,
});

const MAX_CHARGE_ATTEMPTS = 3;
const CHARGE_RETRY_INTERVAL_MS = 20 * 60 * 60 * 1000; // ~daily, with slack for the hourly job

const PLATFORM_FEE_BPS = 500; // 5.00% service fee, added on top for the customer
const MINOR_UNITS_PER_MAJOR = 100;
const HISTORY_LOOKBACK_BUFFER_DAYS = 14;
const MAX_BALANCE_TRANSACTION_PAGES = 20;

function toMajorUnits(amountMinor: number): number {
  return amountMinor / MINOR_UNITS_PER_MAJOR;
}

function calculatePlatformFeeMinor(amountMinor: number): number {
  return Math.round((amountMinor * PLATFORM_FEE_BPS) / 10_000);
}

/**
 * Customer pays price + 5% service fee + VAT; the platform keeps the fee and the VAT it must remit;
 * the organiser receives the full activity price.
 */
export function splitChargeWithVat(priceCents: number, vatCents: number) {
  const serviceFeeCents = calculatePlatformFeeMinor(priceCents);
  const chargeCents = priceCents + serviceFeeCents + vatCents;
  const applicationFeeCents = serviceFeeCents + vatCents;
  return { serviceFeeCents, chargeCents, applicationFeeCents, organiserCents: chargeCents - applicationFeeCents };
}

// VAT via Stripe Tax, added on top of the activity price. With destination charges the platform is the
// merchant of record, so it collects and remits the VAT; the organiser always receives the full price.
// shortcut: one "General - Services" code for every activity, taxed by the platform's place of supply;
// upgrade to per-activity tax codes + performance locations (Tax Locations API, preview) for admission-type activities.
const VAT_TAX_CODE = "txcd_20030000";
// Customer country for the checkout estimate, before we know the card's billing country
const VAT_ESTIMATE_COUNTRY = "HR";

// VAT on both the activity price and the platform's service fee (a taxable service too)
async function calculateVat(priceMinor: number, customerCountry: string, idempotencyKey?: string) {
  return await stripe.tax.calculations.create(
    {
      currency: "eur",
      line_items: [
        { amount: priceMinor, reference: "activity", tax_behavior: "exclusive", tax_code: VAT_TAX_CODE },
        {
          amount: calculatePlatformFeeMinor(priceMinor),
          reference: "service_fee",
          tax_behavior: "exclusive",
          tax_code: VAT_TAX_CODE,
        },
      ],
      customer_details: { address: { country: customerCountry }, address_source: "billing" },
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );
}

/**
 * Checkout breakdown for an activity price in EUR: service fee + VAT (VAT is zero if Stripe Tax
 * isn't active or has no registration). Computed with the same split as chargeReservation.
 */
export const estimateVat = action({
  args: { amount: v.number() },
  handler: async (
    ctx,
    { amount }
  ): Promise<{ serviceFee: number; tax: number; total: number; ratePercent: string | null }> => {
    const currentUser = await ctx.runQuery(api.users.current);
    if (!currentUser) throw new Error("Unauthorized");
    if (!(amount > 0) || amount > 100_000) throw new Error("Invalid amount");
    const priceCents = Math.round(amount * MINOR_UNITS_PER_MAJOR);
    let vatCents = 0;
    let ratePercent: string | null = null;
    try {
      const calc = await calculateVat(priceCents, VAT_ESTIMATE_COUNTRY);
      vatCents = calc.tax_amount_exclusive;
      ratePercent = calc.tax_breakdown?.[0]?.tax_rate_details?.percentage_decimal ?? null;
    } catch (error) {
      // Same fallback as chargeReservation, so the estimate never promises a different total
      console.error("Stripe Tax estimate failed; showing no VAT:", error);
    }
    const split = splitChargeWithVat(priceCents, vatCents);
    return {
      serviceFee: toMajorUnits(split.serviceFeeCents),
      tax: toMajorUnits(vatCents),
      total: toMajorUnits(split.chargeCents),
      ratePercent,
    };
  },
});

const supportedCountryCodes = new Set(
  STRIPE_SUPPORTED_COUNTRIES.map((country) => country.code)
);

function normalizeCountryCode(rawCountryCode: string): string {
  const normalized = rawCountryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error(
      "Invalid country code. Must be a 2-letter ISO country code."
    );
  }
  if (!supportedCountryCodes.has(normalized)) {
    throw new Error(
      "Country is not currently supported for Stripe Connect in this application."
    );
  }
  return normalized;
}

async function requireOrganiserOfOrganisation(
  ctx: ActionCtx,
  organisationId: Id<"organisations">
) {
  const currentUser = await ctx.runQuery(api.users.current);
  if (!currentUser) {
    throw new Error("User not found");
  }
  const organisation = await ctx.runQuery(
    internal.organisation.getByIdInternal,
    { organisationId }
  );
  if (!organisation || !organisation.organisersIDs.includes(currentUser._id)) {
    throw new Error("Forbidden: not an organiser of this organisation");
  }
  return { currentUser, organisation } as const;
}

async function organisationForActivity(
  ctx: ActionCtx,
  activityId: Id<"activities">
): Promise<Doc<"organisations"> | null> {
  return await ctx.runQuery(
    internal.organisation.getOrganisationForActivityInternal,
    { activityId }
  );
}

type OrganiserStripeOrganisation = {
  hasConnectedAccount: boolean;
  organisation: {
    _id: Id<"organisations">;
    stripeAccountId?: string;
  };
  stripeAccountId?: string;
};

type OrganiserStripeBalanceResponse = {
  hasConnectedAccount: boolean;
  payoutsEnabled: boolean;
  available: number;
  pending: number;
  currency: string;
};

type BalanceHistoryRange = "7d" | "30d" | "90d" | "all";

type OrganiserStripeBalanceHistoryPoint = {
  date: string;
  available: number;
  pending: number;
  grossInflow: number;
  payoutOutflow: number;
  net: number;
};

type OrganiserStripeBalanceHistoryResponse = {
  hasConnectedAccount: boolean;
  currency: string;
  range: BalanceHistoryRange;
  points: OrganiserStripeBalanceHistoryPoint[];
};

function formatDateKeyFromUnixSeconds(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildDateRangeKeys(startMs: number, endMs: number): string[] {
  const keys: string[] = [];
  const cursor = new Date(startMs);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(endMs);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

async function getOrganiserStripeOrganisation(
  ctx: ActionCtx
): Promise<OrganiserStripeOrganisation> {
  const currentUser = await ctx.runQuery(api.users.current);
  if (!currentUser || currentUser.role !== "organiser") {
    throw new Error("Forbidden: only organisers can access Stripe payouts");
  }

  const organisation = await ctx.runQuery(api.organisation.getOrganisationByOwnerId, {
    ownerId: currentUser._id,
  });

  if (!organisation) {
    throw new Error("No organiser organisation found");
  }

  if (!organisation.stripeAccountId) {
    return {
      hasConnectedAccount: false,
      organisation,
      stripeAccountId: undefined,
    } as const;
  }

  return {
    hasConnectedAccount: true,
    organisation,
    stripeAccountId: organisation.stripeAccountId,
  } as const;
}

async function getOrCreateStripeCustomerForPayer(
  payer: {
    email: string;
    name: string;
    lastname: string;
    userId: string;
  }
): Promise<Stripe.Customer> {
  const existingCustomers = await stripe.customers.list({
    email: payer.email,
    limit: 1,
  });
  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }
  return stripe.customers.create({
    email: payer.email,
    name: `${payer.name} ${payer.lastname}`.trim(),
    metadata: { userId: payer.userId },
  });
}

async function attachPaymentMethodToCustomer(
  paymentMethodId: string,
  customerId: string
): Promise<void> {
  try {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  } catch {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer && paymentMethod.customer !== customerId) {
      await stripe.paymentMethods.detach(paymentMethodId);
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    }
  }
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
  handler: async (
    ctx,
    { reservationId }
  ): Promise<{ clientSecret: string | null; setupIntentId: string }> => {
    const currentUser = await ctx.runQuery(api.users.current);
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    // Returns null unless the caller takes part in this reservation.
    const reservationData = await ctx.runQuery(
      api.reservations.getReservationCardData,
      { reservationId }
    );
    if (!reservationData) {
      throw new Error("Reservation not found");
    }

    const organisation = await organisationForActivity(
      ctx,
      reservationData.activity._id
    );
    if (!organisation) {
      throw new Error("Organisation not found");
    }

    try {
      // Saved on a customer for off-session use: the card is charged on the activity day.
      const customer = await getOrCreateStripeCustomerForPayer({
        email: currentUser.email,
        name: currentUser.name,
        lastname: currentUser.lastname,
        userId: currentUser._id,
      });
      const setupIntent = await stripe.setupIntents.create({
        customer: customer.id,
        usage: "off_session",
        payment_method_types: ["card"],
        metadata: {
          reservationId,
          activityId: reservationData.activity._id,
          organisationId: organisation._id,
          userId: currentUser._id,
        },
      });

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

// Record a payer's share after the card form. Stripe is the source of truth, not the client.
export const recordCardPayment = action({
  args: {
    reservationId: v.id("reservations"),
    setupIntentId: v.string(),
    personsPaidFor: v.int64(),
  },
  handler: async (
    ctx,
    { reservationId, setupIntentId, personsPaidFor }
  ): Promise<{ amount: number }> => {
    const currentUser = await ctx.runQuery(api.users.current);
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    if (
      setupIntent.status !== "succeeded" ||
      setupIntent.metadata?.userId !== currentUser._id ||
      setupIntent.metadata?.reservationId !== reservationId
    ) {
      throw new Error("Card authorisation could not be verified");
    }
    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;
    if (!paymentMethodId) {
      throw new Error("No card was saved");
    }

    return await ctx.runMutation(internal.reservations.recordPaymentInternal, {
      reservationId,
      userId: currentUser._id,
      personsPaidFor,
      stripeSetupIntentId: setupIntentId,
      stripePaymentMethodId: paymentMethodId,
    });
  },
});

// Charge every saved card on the activity day (scheduled by the hourly cron).
// Safe to re-run: the idempotency key stops a second charge for the same row.
export const chargeReservation = internalAction({
  args: {
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { reservationId }): Promise<null> => {
    const resMeta = await ctx.runQuery(
      internal.reservations.getReservationActivityIdInternal,
      { reservationId }
    );
    if (!resMeta) {
      return null;
    }
    const organisation = await organisationForActivity(ctx, resMeta.activityId);
    if (!organisation) {
      throw new Error("Organisation not found");
    }
    const stripeAccountId: string | undefined = organisation.stripeAccountId;

    const payments = await ctx.runQuery(
      internal.reservations.getReservationPaymentsInternal,
      { reservationId }
    );

    for (const row of payments) {
      if (row.capturedAt || row.amount <= 0) continue;
      // Declined cards: retry once a day, at most MAX_CHARGE_ATTEMPTS times (repeated declines get cards flagged)
      const attempt = row.chargeAttempts ?? 0;
      if (attempt >= MAX_CHARGE_ATTEMPTS) continue;
      if (row.chargeFailedAt && Date.now() - row.chargeFailedAt < CHARGE_RETRY_INTERVAL_MS) continue;
      try {
        // Older rows were held at payment time; capture those holds.
        if (row.stripePaymentIntentId) {
          await ctx.runAction(internal.stripe.capturePaymentIntent, {
            paymentIntentId: row.stripePaymentIntentId,
            reservationId,
          });
          continue;
        }

        const pmId = row.stripePaymentMethodId;
        if (!pmId || !row.user) {
          console.error(`Payment row ${row._id} has no saved card or payer`);
          continue;
        }

        const amountCents = Math.round(row.amount * 100);
        // Stripe rejects charges under 0.50 EUR.
        if (amountCents < 50) {
          console.warn(`Skipping payment ${row._id}: below Stripe minimum`);
          continue;
        }

        // Cards saved by createSetupIntent already sit on a customer; older ones need attaching.
        const paymentMethod = await stripe.paymentMethods.retrieve(pmId);
        let customerId =
          typeof paymentMethod.customer === "string"
            ? paymentMethod.customer
            : paymentMethod.customer?.id;
        if (!customerId) {
          const customer = await getOrCreateStripeCustomerForPayer({
            email: row.user.email,
            name: row.user.name,
            lastname: row.user.lastname,
            userId: row.userId,
          });
          await attachPaymentMethodToCustomer(pmId, customer.id);
          customerId = customer.id;
        }

        // VAT on top, taxed by the card's billing country. Same idempotency key on retry returns the
        // same calculation, so the PaymentIntent params (and its idempotency key) stay identical.
        const customerCountry =
          paymentMethod.billing_details?.address?.country ?? paymentMethod.card?.country ?? VAT_ESTIMATE_COUNTRY;
        let vat: Stripe.Tax.Calculation | null = null;
        try {
          vat = await calculateVat(amountCents, customerCountry, `vat-${row._id}-${attempt}`);
        } catch (error) {
          console.error(`Stripe Tax failed for payment ${row._id}; charging without VAT:`, error);
        }
        const vatCents = vat?.tax_amount_exclusive ?? 0;

        // One PaymentIntent per payer, so refunds go back to the card that paid.
        const split = splitChargeWithVat(amountCents, vatCents);
        const params: Stripe.PaymentIntentCreateParams = {
          amount: split.chargeCents,
          currency: "eur",
          payment_method_types: ["card"],
          payment_method: pmId,
          customer: customerId,
          confirm: true,
          off_session: true,
          // Stripe emails the payer a receipt (with the VAT breakdown from the linked tax calculation)
          receipt_email: row.user.email || undefined,
          description: `${resMeta.activityName} · ${resMeta.date} ${resMeta.time}`,
          metadata: {
            reservationId: String(reservationId),
            reservationPaymentId: String(row._id),
            activityId: String(resMeta.activityId),
            organisationId: String(organisation._id),
            userId: String(row.userId),
            vatCents: String(vatCents),
          },
          // Stripe records the tax transaction on success and reverses it on refunds
          ...(vat && { hooks: { inputs: { tax: { calculation: vat.id } } } }),
        };
        if (stripeAccountId) {
          // The platform keeps its service fee and the VAT it must remit; the organiser gets the full price
          params.application_fee_amount = split.applicationFeeCents;
          params.transfer_data = { destination: stripeAccountId };
        }

        const paymentIntent = await stripe.paymentIntents.create(params, {
          // One key per attempt: within an attempt a re-run can't charge twice, and a declined
          // attempt (no money moved) doesn't block the next day's retry
          idempotencyKey: `charge-${row._id}-${attempt}`,
        });
        await ctx.runMutation(internal.reservations.patchReservationPaymentIntentId, {
          paymentId: row._id,
          paymentIntentId: paymentIntent.id,
        });
        if (paymentIntent.status === "succeeded") {
          await ctx.runMutation(internal.stripe.applyPaymentCaptureDb, {
            paymentIntentId: paymentIntent.id,
            reservationId,
          });
        }
      } catch (error) {
        console.error(`Charging payment row ${row._id} failed:`, error);
        // Only card errors are known to have moved no money; anything else is left for the next run
        if (error instanceof Stripe.errors.StripeCardError) {
          await ctx.runMutation(internal.reservations.recordChargeFailure, {
            paymentId: row._id,
            reason: error.message,
          });
        }
      }
    }
    return null;
  },
});

/** DB updates after a successful Stripe capture (called from capturePaymentIntent). */
export const applyPaymentCaptureDb = internalMutation({
  args: {
    paymentIntentId: v.string(),
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { paymentIntentId, reservationId }) => {
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    const payments = await ctx.db
      .query("reservationPayments")
      .withIndex("byReservation", (q) => q.eq("reservationId", reservationId))
      .collect();

    const now = Date.now();
    let updated = false;
    for (const p of payments) {
      if (p.stripePaymentIntentId === paymentIntentId && !p.capturedAt) {
        await ctx.db.patch(p._id, { capturedAt: now });
        updated = true;
      }
    }

    if (updated) {
      await ctx.runMutation(internal.reservations.checkAndUpdateFulfilledStatus, {
        reservationId,
      });
    }

    return { success: true };
  },
});

/** Stripe capture + DB update (must be an action — uses Stripe Node SDK). */
export const capturePaymentIntent = internalAction({
  args: {
    paymentIntentId: v.string(),
    reservationId: v.id("reservations"),
  },
  handler: async (ctx, { paymentIntentId, reservationId }) => {
    try {
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
      await ctx.runMutation(internal.stripe.applyPaymentCaptureDb, {
        paymentIntentId,
        reservationId,
      });
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
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    switch (paymentIntent.status) {
      case "succeeded":
        await stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            // Destination charge: pull the organiser's transfer and the platform fee back too,
            // otherwise the platform alone funds the whole refund
            ...(paymentIntent.transfer_data && { reverse_transfer: true, refund_application_fee: true }),
          },
          { idempotencyKey: `refund-${paymentIntentId}` }
        );
        break;
      case "requires_capture":
      case "requires_payment_method":
      case "requires_confirmation":
      case "requires_action":
        // Not charged yet: cancelling releases the hold.
        await stripe.paymentIntents.cancel(paymentIntentId);
        break;
      case "canceled":
        break;
      default:
        // e.g. "processing": leave refundedAt unset so it shows as not refunded.
        throw new Error(
          `Cannot refund PaymentIntent ${paymentIntentId} in status ${paymentIntent.status}`
        );
    }

    await ctx.runMutation(internal.reservations.updatePaymentRefundedAt, {
      paymentIntentId,
      reservationId,
      refundedAt: Date.now(),
    });
    return { success: true };
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
      routingNumber,
    } = args;

    if (!organisationId || !country || !businessType || !email) {
      throw new Error("Missing required fields");
    }

    const { organisation } = await requireOrganiserOfOrganisation(
      ctx,
      organisationId
    );

    try {
      // Check if account already exists
      if (organisation.stripeAccountId) {
        return {
          success: true,
          stripeAccountId: organisation.stripeAccountId,
          message: "Stripe account already exists",
        };
      }

      const countryCode = normalizeCountryCode(country);

      // Format phone number to E.164 format (required)
      if (!phone || !phone.trim()) {
        throw new Error("Phone number is required");
      }

      // Remove spaces and separators, preserve leading plus.
      const cleaned = phone.replace(/[\s\-().]/g, "");

      let formattedPhone: string;
      // If it already starts with +, use it as is
      if (cleaned.startsWith("+")) {
        formattedPhone = cleaned;
      } else {
        formattedPhone = `+${cleaned.replace(/[^\d]/g, "")}`;
      }

      // Basic E.164 validation: should start with + and have 7-15 digits after
      // Stripe accepts 7-15 digits
      const digitsAfterPlus = formattedPhone.slice(1);
      if (!/^\d{7,15}$/.test(digitsAfterPlus)) {
        throw new Error(
          "Phone number must be in E.164 format with 7-15 digits after the country code (e.g., +1234567890)."
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
      const externalAccountCountry = normalizeCountryCode(
        (bankCountry && bankCountry.trim()) || countryCode
      );
      
      if (externalAccountToken) {
        accountParams.external_account = externalAccountToken;
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
          
        } else {
          throw new Error("Invalid IBAN format");
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

          // Remove phone everywhere and retry
          delete accountParams.individual?.phone;
          delete accountParams.business_profile?.support_phone;

          // Retry without phone number
          account = await stripe.accounts.create(accountParams);
        } else {
          // Re-throw if it's not a phone number error
          throw createError;
        }
      }

      await ctx.runMutation(internal.organisation.updateStripeAccountInternal, {
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

    const { organisation } = await requireOrganiserOfOrganisation(
      ctx,
      organisationId
    );

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
      const countryCode = normalizeCountryCode(country || "HR");

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

        await ctx.runMutation(internal.organisation.updateStripeAccountInternal, {
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

    const { organisation } = await requireOrganiserOfOrganisation(
      ctx,
      organisationId
    );

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
        const owner = await ctx.runQuery(internal.users.getUserByIdInternal, {
          userId: ownerId,
        });

        if (owner) {
          // Parse address
          const parsedAddress = parseAddressString(
            organisation.address,
            account.country || "HR"
          );

          const ownerEmail = organisation.organisationEmail || (account.email && account.email !== null ? account.email : undefined);
          updateParams.individual = {
            first_name: owner.name,
            last_name: owner.lastname,
            email: ownerEmail,
            address: parsedAddress,
          };
        } else {
          // If no owner found, still update address
          const parsedAddress = parseAddressString(
            organisation.address,
            account.country || "HR"
          );
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
        const parsedAddress = parseAddressString(
          organisation.address,
          account.country || "HR"
        );
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
                  country: account.country || "HR",
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

    const { organisation } = await requireOrganiserOfOrganisation(
      ctx,
      organisationId
    );

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

export const getOrganiserStripeBalance = action({
  args: {},
  handler: async (ctx): Promise<OrganiserStripeBalanceResponse> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const orgStripeData = await getOrganiserStripeOrganisation(ctx);

    if (!orgStripeData.hasConnectedAccount || !orgStripeData.stripeAccountId) {
      return {
        hasConnectedAccount: false,
        payoutsEnabled: false,
        available: 0,
        pending: 0,
        currency: "EUR",
      };
    }

    const [stripeBalance, stripeAccount]: [Stripe.Balance, Stripe.Account] = await Promise.all([
      stripe.balance.retrieve({}, { stripeAccount: orgStripeData.stripeAccountId }),
      stripe.accounts.retrieve(orgStripeData.stripeAccountId),
    ]);

    const availableBalances = stripeBalance.available ?? [];
    const pendingBalances = stripeBalance.pending ?? [];
    const preferredCurrency = "eur";
    const fallbackCurrency =
      availableBalances[0]?.currency ?? pendingBalances[0]?.currency ?? preferredCurrency;
    const selectedCurrency =
      availableBalances.find((entry) => entry.currency === preferredCurrency)?.currency ??
      fallbackCurrency;

    const availableMinor =
      availableBalances
        .filter((entry) => entry.currency === selectedCurrency)
        .reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
    const pendingMinor =
      pendingBalances
        .filter((entry) => entry.currency === selectedCurrency)
        .reduce((sum, entry) => sum + entry.amount, 0) ?? 0;

    return {
      hasConnectedAccount: true,
      payoutsEnabled: Boolean(stripeAccount.payouts_enabled),
      available: availableMinor / 100,
      pending: pendingMinor / 100,
      currency: selectedCurrency.toUpperCase(),
    };
  },
});

export const getOrganiserStripeBalanceHistory = action({
  args: {
    range: v.optional(
      v.union(v.literal("7d"), v.literal("30d"), v.literal("90d"), v.literal("all"))
    ),
  },
  handler: async (
    ctx,
    { range = "30d" }
  ): Promise<OrganiserStripeBalanceHistoryResponse> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const orgStripeData = await getOrganiserStripeOrganisation(ctx);
    if (!orgStripeData.hasConnectedAccount || !orgStripeData.stripeAccountId) {
      return {
        hasConnectedAccount: false,
        currency: "EUR",
        range,
        points: [],
      };
    }

    const stripeAccountId = orgStripeData.stripeAccountId;
    const [stripeBalance] = await Promise.all([
      stripe.balance.retrieve({}, { stripeAccount: stripeAccountId }),
    ]);

    const availableBalances = stripeBalance.available ?? [];
    const pendingBalances = stripeBalance.pending ?? [];
    const preferredCurrency = "eur";
    const fallbackCurrency =
      availableBalances[0]?.currency ?? pendingBalances[0]?.currency ?? preferredCurrency;
    const selectedCurrency =
      availableBalances.find((entry) => entry.currency === preferredCurrency)?.currency ??
      fallbackCurrency;

    const currentAvailableMinor = availableBalances
      .filter((entry) => entry.currency === selectedCurrency)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const currentPendingMinor = pendingBalances
      .filter((entry) => entry.currency === selectedCurrency)
      .reduce((sum, entry) => sum + entry.amount, 0);

    const nowMs = Date.now();
    const rangeDays: Record<Exclude<BalanceHistoryRange, "all">, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };

    const rangeStartMs =
      range === "all"
        ? 0
        : nowMs - rangeDays[range] * 24 * 60 * 60 * 1000;
    const historyStartMs =
      range === "all"
        ? 0
        : rangeStartMs - HISTORY_LOOKBACK_BUFFER_DAYS * 24 * 60 * 60 * 1000;

    const allTransactions: Stripe.BalanceTransaction[] = [];
    let startingAfter: string | undefined;

    for (let page = 0; page < MAX_BALANCE_TRANSACTION_PAGES; page += 1) {
      const list = await stripe.balanceTransactions.list(
        {
          limit: 100,
          ...(historyStartMs > 0
            ? { created: { gte: Math.floor(historyStartMs / 1000) } }
            : {}),
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        },
        { stripeAccount: stripeAccountId }
      );

      allTransactions.push(
        ...list.data.filter((txn) => txn.currency === selectedCurrency)
      );

      if (!list.has_more || list.data.length === 0) {
        break;
      }
      startingAfter = list.data[list.data.length - 1].id;
    }

    const transactions = allTransactions.sort((a, b) => a.created - b.created);
    const allAvailableOnKeys = transactions
      .map((txn) => txn.available_on)
      .filter((value): value is number => typeof value === "number")
      .map((unix) => formatDateKeyFromUnixSeconds(unix));
    const earliestAvailableOnKey = allAvailableOnKeys[0];
    const effectiveStartMs =
      range === "all" && earliestAvailableOnKey
        ? new Date(`${earliestAvailableOnKey}T00:00:00.000Z`).getTime()
        : rangeStartMs;
    const dateKeys = buildDateRangeKeys(effectiveStartMs, nowMs);
    if (dateKeys.length === 0) {
      return {
        hasConnectedAccount: true,
        currency: selectedCurrency.toUpperCase(),
        range,
        points: [],
      };
    }

    const firstDateKey = dateKeys[0];
    const availableDeltaByDay = new Map<string, number>();
    const pendingDeltaByDay = new Map<string, number>();
    const inflowByDay = new Map<string, number>();
    const outflowByDay = new Map<string, number>();
    const netByDay = new Map<string, number>();

    for (const txn of transactions) {
      const createdKey = formatDateKeyFromUnixSeconds(txn.created);
      const availableOnKey = formatDateKeyFromUnixSeconds(txn.available_on);
      const amountMinor = txn.amount;

      availableDeltaByDay.set(
        availableOnKey,
        (availableDeltaByDay.get(availableOnKey) ?? 0) + amountMinor
      );
      pendingDeltaByDay.set(
        createdKey,
        (pendingDeltaByDay.get(createdKey) ?? 0) + amountMinor
      );
      pendingDeltaByDay.set(
        availableOnKey,
        (pendingDeltaByDay.get(availableOnKey) ?? 0) - amountMinor
      );

      netByDay.set(createdKey, (netByDay.get(createdKey) ?? 0) + amountMinor);
      if (amountMinor > 0) {
        inflowByDay.set(createdKey, (inflowByDay.get(createdKey) ?? 0) + amountMinor);
      }
      if (amountMinor < 0 && (txn.type === "payout" || txn.type === "transfer")) {
        outflowByDay.set(
          createdKey,
          (outflowByDay.get(createdKey) ?? 0) + Math.abs(amountMinor)
        );
      }
    }

    let startAvailableMinor = currentAvailableMinor;
    let startPendingMinor = currentPendingMinor;
    for (const key of dateKeys) {
      startAvailableMinor -= availableDeltaByDay.get(key) ?? 0;
      startPendingMinor -= pendingDeltaByDay.get(key) ?? 0;
    }

    const points: OrganiserStripeBalanceHistoryPoint[] = [];
    let runningAvailableMinor = startAvailableMinor;
    let runningPendingMinor = startPendingMinor;

    for (const key of dateKeys) {
      runningAvailableMinor += availableDeltaByDay.get(key) ?? 0;
      runningPendingMinor += pendingDeltaByDay.get(key) ?? 0;

      const grossInflowMinor = inflowByDay.get(key) ?? 0;
      const payoutOutflowMinor = outflowByDay.get(key) ?? 0;
      const netMinor = netByDay.get(key) ?? 0;

      if (key < firstDateKey) {
        continue;
      }

      points.push({
        date: key,
        available: roundCurrency(toMajorUnits(runningAvailableMinor)),
        pending: roundCurrency(toMajorUnits(runningPendingMinor)),
        grossInflow: roundCurrency(toMajorUnits(grossInflowMinor)),
        payoutOutflow: roundCurrency(toMajorUnits(payoutOutflowMinor)),
        net: roundCurrency(toMajorUnits(netMinor)),
      });
    }

    return {
      hasConnectedAccount: true,
      currency: selectedCurrency.toUpperCase(),
      range,
      points,
    };
  },
});

export const requestOrganiserPayout = action({
  args: {
    amount: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { amount, currency }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payout amount must be greater than 0");
    }

    const orgStripeData = await getOrganiserStripeOrganisation(ctx);
    if (!orgStripeData.hasConnectedAccount || !orgStripeData.stripeAccountId) {
      throw new Error("Stripe account is not connected");
    }

    const stripeAccountId = orgStripeData.stripeAccountId;
    const [stripeBalance, stripeAccount] = await Promise.all([
      stripe.balance.retrieve({}, { stripeAccount: stripeAccountId }),
      stripe.accounts.retrieve(stripeAccountId),
    ]);

    if (!stripeAccount.payouts_enabled) {
      throw new Error("Payouts are not enabled for this Stripe account yet");
    }

    const payoutCurrency = (currency || "EUR").toLowerCase();
    const availableMinor = (stripeBalance.available ?? [])
      .filter((entry) => entry.currency === payoutCurrency)
      .reduce((sum, entry) => sum + entry.amount, 0);

    const requestedMinor = Math.round(amount * 100);
    if (requestedMinor <= 0) {
      throw new Error("Payout amount is too small");
    }
    if (requestedMinor > availableMinor) {
      throw new Error("Insufficient available balance for this payout request");
    }

    const payout = await stripe.payouts.create(
      {
        amount: requestedMinor,
        currency: payoutCurrency,
      },
      { stripeAccount: stripeAccountId }
    );

    return {
      payoutId: payout.id,
      amount: payout.amount / 100,
      currency: payout.currency.toUpperCase(),
      status: payout.status,
      arrivalDate: payout.arrival_date ? payout.arrival_date * 1000 : null,
    };
  },
});

// Organiser payments table. Built from our own rows so it needs no Stripe call per payment.
export const getStripePaymentIntentsForOrganiser = action({
  args: {},
  handler: async (ctx): Promise<OrganiserPaymentRow[]> => {
    const currentUser = await ctx.runQuery(api.users.current);
    if (!currentUser || currentUser.role !== "organiser") {
      return [];
    }
    return await ctx.runQuery(internal.reservations.getOrganiserPaymentRows, {
      userId: currentUser._id,
    });
  },
});

type OrganiserPaymentRow = {
  paymentIntentId: string;
  reservationId: Id<"reservations">;
  teamId: Id<"teams"> | null;
  teamName: string;
  payerName: string;
  personsPaidFor: number;
  activityName: string;
  activityAddress: string;
  date: string;
  time: string;
  status: "on_hold" | "paid" | "canceled" | "pending" | "refunded";
  stripeStatus: string;
  amount: number;
  collectedAmount: number;
  remainingAmount: number;
  currency: string;
  createdAt: number;
  capturedAt?: number;
  refundedAt?: number;
};

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
