import { expect, test, vi } from "vitest";

vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
const { splitChargeWithVat } = await import("./stripe");

test("customer pays the service fee and VAT; the organiser receives the full price", () => {
  // €6.00 activity: €0.30 service fee, 25% VAT on €6.30 = €1.58
  expect(splitChargeWithVat(600, 158)).toEqual({
    serviceFeeCents: 30,
    chargeCents: 788,
    applicationFeeCents: 188,
    organiserCents: 600,
  });
  // without VAT the organiser still gets the full price
  expect(splitChargeWithVat(600, 0)).toMatchObject({ chargeCents: 630, organiserCents: 600 });
});
