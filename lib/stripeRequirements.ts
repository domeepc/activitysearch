// Stripe Connect reports missing info as field paths (e.g. "individual.verification.document").
// Turn them into short steps an organiser understands, merging fields that are one task (dob.day/month/year).

const RULES: Array<[RegExp, string]> = [
  [/^external_account/, "Bank account for payouts"],
  [/^tos_acceptance\./, "Accept Stripe's terms of service"],
  [/^business_type$/, "Business type"],
  [/^business_profile\.url$/, "Business website"],
  [/^business_profile\.mcc$/, "Business category"],
  [/^business_profile\.product_description$/, "Short description of your activities"],
  [/^business_profile\.support_/, "Customer support contact"],
  [/^settings\.payments\.statement_descriptor/, "Name shown on customers' card statements"],
  [/^company\.owners_provided$/, "Confirm the business owners"],
  [/^company\.directors_provided$/, "Confirm the business directors"],
  [/^company\.executives_provided$/, "Confirm the business executives"],
  [/^company\.name/, "Registered business name"],
  [/^company\.tax_id/, "Business tax ID"],
  [/^company\.address\./, "Business address"],
  [/^company\.phone$/, "Business phone number"],
  [/^company\.verification\.document/, "Business registration document"],
  [/\.(first_name|last_name)$/, "Legal name"],
  [/\.dob\./, "Date of birth"],
  [/\.address\./, "Home address"],
  [/\.phone$/, "Phone number"],
  [/\.email$/, "Email address"],
  [/\.(id_number|ssn_last_4)$/, "Personal ID number"],
  [/\.verification\.additional_document/, "Proof of address"],
  [/\.verification\.document/, "Photo ID"],
  [/\.relationship\./, "Role in the business"],
];

// Whose details a person-level field is about
function personLabel(path: string): string | null {
  if (path.startsWith("individual.")) return null; // the organiser themself
  if (path.startsWith("representative.")) return "account representative";
  if (/^(owners|person_[^.]+)\./.test(path)) return "owner or director";
  if (/^(directors|executives)\./.test(path)) return path.split(".")[0].slice(0, -1);
  return null;
}

export function describeStripeRequirement(path: string): string {
  const rule = RULES.find(([pattern]) => pattern.test(path));
  if (!rule) {
    // Unknown field: show its last meaningful part, humanised
    const last = path.split(".").filter((p) => !/^(day|month|year|line1|line2)$/.test(p)).pop() ?? path;
    const text = last.replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  const who = path.startsWith("company.") ? null : personLabel(path);
  return who ? `${rule[1]} (${who})` : rule[1];
}

/** Unique, readable steps for a list of Stripe requirement paths, in first-seen order */
export function describeStripeRequirements(paths: string[]): string[] {
  return [...new Set(paths.map(describeStripeRequirement))];
}
