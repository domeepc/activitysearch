import { describe, expect, it } from "vitest";
import { describeStripeRequirements as describe_ } from "./stripeRequirements";

describe("describeStripeRequirements", () => {
  it("merges related fields into one readable step", () => {
    expect(
      describe_(["individual.dob.day", "individual.dob.month", "individual.dob.year", "external_account", "tos_acceptance.date", "tos_acceptance.ip"])
    ).toEqual(["Date of birth", "Bank account for payouts", "Accept Stripe's terms of service"]);
  });

  it("says whose details are needed", () => {
    expect(describe_(["person_1AbC.verification.document", "representative.address.city", "company.address.city"])).toEqual([
      "Photo ID (owner or director)",
      "Home address (account representative)",
      "Business address",
    ]);
  });

  it("falls back to a humanised field name", () => {
    expect(describe_(["individual.political_exposure"])).toEqual(["Political exposure"]);
  });
});
