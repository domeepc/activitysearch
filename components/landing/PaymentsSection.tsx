import { CreditCard, Zap, BadgeCheck } from "lucide-react";

const points = [
  {
    icon: Zap,
    title: "Fast checkout",
    description:
      "Save a payment method and confirm reservations in a few taps—no friction at the door.",
  },
  {
    icon: CreditCard,
    title: "Powered by Stripe",
    description:
      "Card details are handled by Stripe’s secure infrastructure. We never store full card numbers on our servers.",
  },
  {
    icon: BadgeCheck,
    title: "Clear, reliable payouts",
    description:
      "Organisers get a straightforward flow for getting paid, with visibility into each booking.",
  },
] as const;

export function PaymentsSection() {
  return (
    <section className="bg-white py-14">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-900 text-white shadow-sm">
          <div className="grid gap-8 p-8 md:grid-cols-2 md:p-12">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                Payments
              </p>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Simple, efficient payments
              </h2>
              <p className="text-sm text-zinc-300 md:text-base">
                Whether you are booking your next session or running a venue,
                payments are designed to be quick for participants and dependable
                for organisers—<span className="font-medium text-white">powered by Stripe</span>.
              </p>
            </div>
            <ul className="flex flex-col gap-4">
              {points.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
                    <Icon className="h-5 w-5 text-white" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="mt-1 text-sm text-zinc-300">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
