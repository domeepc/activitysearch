import { Check } from "lucide-react";

const points = [
  {
    title: "Fast checkout",
    description: "Save a payment method and confirm reservations in a few taps — no friction at the door.",
  },
  {
    title: "Powered by Stripe",
    description: "Card details are handled by Stripe's secure infrastructure. We never store full card numbers.",
  },
  {
    title: "Clear payouts",
    description: "Organisers get a straightforward flow for getting paid, with full visibility into each booking.",
  },
];

export function PaymentsSection() {
  return (
    <section aria-labelledby="payments-h" className="flex h-full flex-col gap-6 rounded-4xl bg-blue-600 p-6 text-white md:p-9">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-blue-100">06 — Payments</p>
      <h2 id="payments-h" className="text-[clamp(2.1rem,4vw,3.5rem)] font-extrabold leading-none tracking-[-0.04em]">
        Simple, reliable payments.
      </h2>
      <div aria-hidden="true" className="flex flex-col gap-2 rounded-2xl bg-zinc-950/25 p-4">
        <span className="flex justify-between text-[13px]">
          <span>Your team · 3 of 6 paid</span>
          <b>50%</b>
        </span>
        <span className="h-2 overflow-hidden rounded-full bg-white/25">
          <span className="block h-full w-1/2 rounded-full bg-white" />
        </span>
      </div>
      <ul className="flex flex-col gap-4">
        {points.map(({ title, description }) => (
          <li key={title} className="flex gap-3">
            <Check className="mt-1 size-[18px] shrink-0" strokeWidth={2.5} aria-hidden="true" />
            <span>
              <span className="block text-[15px] font-semibold">{title}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-blue-100">{description}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
